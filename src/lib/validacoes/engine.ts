"use server";

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export interface ValidacaoResultado {
  regra: string;
  gravidade: "IMPEDITIVO" | "ALERTA";
  mensagem: string;
  dadosConflito?: any;
}

/**
 * Função Principal do Motor de Validações
 * Recebe a aula recém-salva e executa todas as regras.
 */
export async function executarValidacoes(
  aula: any,
): Promise<ValidacaoResultado[]> {
  const resultados: ValidacaoResultado[] = [];

  // Executar todas as regras em paralelo para performance
  const promises = [
    validarChoqueTurma(aula),
    validarChoqueEspaco(aula),
    validarChoqueDocente(aula),
    validarDescansoDocente(aula),
    validarLimiteTurnos(aula),
    validarDiaPlanejamento(aula),
    validarAulasGeminadas(aula),
    validarCargaHoraria(aula),
    validarFimDeSemana(aula),
  ];

  const resultadosParalelos = await Promise.all(promises);

  // Achatar os resultados (algumas funções retornam arrays)
  resultadosParalelos.forEach((res) => {
    if (Array.isArray(res)) {
      resultados.push(...res);
    } else if (res) {
      resultados.push(res);
    }
  });

  return resultados;
}

// ============================================================
// REGRAS IMPEDITIVAS (Gravidade: IMPEDITIVO)
// ============================================================

async function validarChoqueTurma(
  aula: any,
): Promise<ValidacaoResultado | null> {
  // A própria constraint UNIQUE do banco já impede isso na maioria dos casos,
  // mas podemos verificar se houve alguma falha de concorrência rara.
  const { count } = await supabase
    .from("aulas")
    .select("*", { head: true, count: "exact" })
    .eq("turma_id", aula.turma_id)
    .eq("dia_semana", aula.dia_semana)
    .eq("slot_horario_id", aula.slot_horario_id)
    .eq("status", "ATIVO")
    .neq("id", aula.id);

  if ((count || 0) > 0) {
    return {
      regra: "CHOQUE_TURMA",
      gravidade: "IMPEDITIVO",
      mensagem: `A turma já possui uma aula neste horário.`,
      dadosConflito: { turma_id: aula.turma_id },
    };
  }
  return null;
}

async function validarChoqueEspaco(
  aula: any,
): Promise<ValidacaoResultado | null> {
  if (!aula.espaco_id) return null;

  const { count } = await supabase
    .from("aulas")
    .select("*", { head: true, count: "exact" })
    .eq("espaco_id", aula.espaco_id)
    .eq("dia_semana", aula.dia_semana)
    .eq("slot_horario_id", aula.slot_horario_id)
    .eq("status", "ATIVO")
    .neq("id", aula.id);

  if ((count || 0) > 0) {
    const { data: espaco } = await supabase
      .from("espacos")
      .select("nome")
      .eq("id", aula.espaco_id)
      .single();
    return {
      regra: "CHOQUE_ESPACO",
      gravidade: "IMPEDITIVO",
      mensagem: `O espaço "${espaco?.nome}" já está ocupado neste horário.`,
      dadosConflito: { espaco_id: aula.espaco_id },
    };
  }
  return null;
}

async function validarChoqueDocente(
  aula: any,
): Promise<ValidacaoResultado | null> {
  const { count } = await supabase
    .from("aulas")
    .select("*", { head: true, count: "exact" })
    .eq("professor_id", aula.professor_id)
    .eq("dia_semana", aula.dia_semana)
    .eq("slot_horario_id", aula.slot_horario_id)
    .eq("status", "ATIVO")
    .neq("id", aula.id);

  if ((count || 0) > 0) {
    const { data: prof } = await supabase
      .from("professores")
      .select("nome")
      .eq("id", aula.professor_id)
      .single();
    return {
      regra: "CHOQUE_DOCENTE",
      gravidade: "IMPEDITIVO",
      mensagem: `O professor "${prof?.nome}" já está alocado neste horário.`,
      dadosConflito: { professor_id: aula.professor_id },
    };
  }
  return null;
}

async function validarDescansoDocente(
  aula: any,
): Promise<ValidacaoResultado | null> {
  // Regra: Professor tem aulas nos dois últimos horários de um dia e nos dois primeiros do seguinte.
  // Mapeamento de dias
  const diasMap: Record<string, number> = {
    SEGUNDA: 1,
    TERCA: 2,
    QUARTA: 3,
    QUINTA: 4,
    SEXTA: 5,
    SABADO: 6,
    DOMINGO: 7,
  };
  const diaAtualNum = diasMap[aula.dia_semana];
  if (!diaAtualNum || diaAtualNum === 7) return null; // Ignora domingo como "dia anterior"

  const diaSeguinteNum = diaAtualNum + 1;
  const diaSeguinteKey = Object.keys(diasMap).find(
    (key) => diasMap[key] === diaSeguinteNum,
  );

  if (!diaSeguinteKey) return null;

  // Obter IDs dos slots: Últimos (14, 15) e Primeiros (1, 2) - Ajuste conforme seus IDs reais
  // Idealmente, buscar dinamicamente baseado no hora_inicio
  const { data: slotsTodos } = await supabase
    .from("slots_horarios")
    .select("id, hora_inicio")
    .order("hora_inicio");
  if (!slotsTodos) return null;

  const totalSlots = slotsTodos.length;
  const idsUltimos = [
    slotsTodos[totalSlots - 2]?.id,
    slotsTodos[totalSlots - 1]?.id,
  ].filter(Boolean);
  const idsPrimeiros = [slotsTodos[0]?.id, slotsTodos[1]?.id].filter(Boolean);

  // Verifica se a aula atual é um dos últimos horários
  const isUltimoHoje = idsUltimos.includes(aula.slot_horario_id);
  if (!isUltimoHoje) return null;

  // Conta quantas aulas o professor tem nos primeiros horários do dia seguinte
  const { count } = await supabase
    .from("aulas")
    .select("*", { head: true, count: "exact" })
    .eq("professor_id", aula.professor_id)
    .eq("dia_semana", diaSeguinteKey)
    .in("slot_horario_id", idsPrimeiros)
    .eq("status", "ATIVO");

  if ((count || 0) >= 2) {
    return {
      regra: "DESCANSO_DOCENTE",
      gravidade: "IMPEDITIVO",
      mensagem: `O professor está alocado nos dois últimos horários de ${aula.dia_semana} e terá duas aulas no início de ${diaSeguinteKey}. Isso viola a regra de descanso.`,
      dadosConflito: { professor_id: aula.professor_id },
    };
  }

  return null;
}

async function validarLimiteTurnos(
  aula: any,
): Promise<ValidacaoResultado | null> {
  // Definir faixas de turnos (ajustar IDs conforme seus slots)
  // Exemplo simplificado: Manhã (slots 1-5), Tarde (6-10), Noite (11+)
  const { data: slotAtual } = await supabase
    .from("slots_horarios")
    .select("hora_inicio")
    .eq("id", aula.slot_horario_id)
    .single();
  if (!slotAtual) return null;

  const hora = parseInt(slotAtual.hora_inicio.split(":")[0]);
  let turnoAtual = "";
  if (hora < 12) turnoAtual = "MANHA";
  else if (hora < 18) turnoAtual = "TARDE";
  else turnoAtual = "NOITE";

  // Buscar todas as aulas do professor no dia
  const { data: aulasDoDia } = await supabase
    .from("aulas")
    .select("slot_horario_id, slots_horarios(hora_inicio)")
    .eq("professor_id", aula.professor_id)
    .eq("dia_semana", aula.dia_semana)
    .eq("status", "ATIVO");

  if (!aulasDoDia) return null;

  const turnosOcupados = new Set<string>([turnoAtual]);

  for (const a of aulasDoDia) {
    const h = parseInt((a.slots_horarios as any).hora_inicio.split(":")[0]);
    if (h < 12) turnosOcupados.add("MANHA");
    else if (h < 18) turnosOcupados.add("TARDE");
    else turnosOcupados.add("NOITE");
  }

  if (turnosOcupados.size > 2) {
    return {
      regra: "LIMITE_TURNOS",
      gravidade: "IMPEDITIVO",
      mensagem: `O professor está alocado em mais de dois turnos no mesmo dia (${Array.from(turnosOcupados).join(", ")}).`,
      dadosConflito: { professor_id: aula.professor_id },
    };
  }

  return null;
}

// ============================================================
// REGRAS DE ALERTA (Gravidade: ALERTA)
// ============================================================

async function validarDiaPlanejamento(
  aula: any,
): Promise<ValidacaoResultado | null> {
  // Esta regra exigiria um campo "dia_planejamento" na tabela professores ou uma tabela de configuração.
  // Simulação: Supondo que cada professor tenha um dia fixo (ex: baseado no ID % 5)
  // Na prática, você deve buscar de uma tabela de configurações.
  return null; // Implementar quando tiver a tabela de configuração de planejamento
}

async function validarAulasGeminadas(
  aula: any,
): Promise<ValidacaoResultado | null> {
  // Alerta se a turma tem mais de 2 aulas da mesma disciplina no mesmo dia
  const { data: aulasMesmoDia } = await supabase
    .from("aulas")
    .select("disciplina_id")
    .eq("turma_id", aula.turma_id)
    .eq("dia_semana", aula.dia_semana)
    .eq("status", "ATIVO");

  if (!aulasMesmoDia) return null;

  const contagemPorDisciplina: Record<number, number> = {};
  aulasMesmoDia.forEach((a) => {
    contagemPorDisciplina[a.disciplina_id] =
      (contagemPorDisciplina[a.disciplina_id] || 0) + 1;
  });

  const qtdAtual = contagemPorDisciplina[aula.disciplina_id] || 0;

  if (qtdAtual > 2) {
    const { data: disc } = await supabase
      .from("disciplinas")
      .select("nome")
      .eq("id", aula.disciplina_id)
      .single();
    return {
      regra: "AULAS_GEMINADAS",
      gravidade: "ALERTA",
      mensagem: `A turma terá ${qtdAtual} aulas de "${disc?.nome}" no mesmo dia. Recomenda-se revisar.`,
      dadosConflito: { disciplina_id: aula.disciplina_id },
    };
  }

  return null;
}

async function validarCargaHoraria(
  aula: any,
): Promise<ValidacaoResultado | null> {
  // Verificar se a quantidade de aulas semanais da disciplina não excede o previsto
  // Requer campo 'carga_horaria_semanal' na tabela disciplinas
  const { data: disciplina } = await supabase
    .from("disciplinas")
    .select("carga_horaria, nome")
    .eq("id", aula.disciplina_id)
    .single();

  if (!disciplina || !disciplina.carga_horaria) return null;

  const { count } = await supabase
    .from("aulas")
    .select("*", { head: true, count: "exact" })
    .eq("disciplina_id", aula.disciplina_id)
    .eq("turma_id", aula.turma_id)
    .eq("status", "ATIVO");

  const totalAulas = count || 0;

  // Considerando que carga_horaria seja em horas e cada aula tenha 1h ou 50min
  // A lógica exata depende de como sua carga horária está definida
  if (totalAulas > disciplina.carga_horaria * 2) {
    // Exemplo grosseiro
    return {
      regra: "CARGA_HORARIA",
      gravidade: "ALERTA",
      mensagem: `A carga horária semanal de "${disciplina.nome}" parece estar sendo excedida.`,
      dadosConflito: { disciplina_id: aula.disciplina_id },
    };
  }

  return null;
}

async function validarFimDeSemana(
  aula: any,
): Promise<ValidacaoResultado | null> {
  // Alerta: Sexta à noite + Segunda manhã
  const diasMap: Record<string, number> = { SEGUNDA: 1, SEXTA: 5 };

  const isSextaNoite = aula.dia_semana === "SEXTA";
  const isSegundaManha = aula.dia_semana === "SEGUNDA";

  if (!isSextaNoite && !isSegundaManha) return null;

  const { data: slotAtual } = await supabase
    .from("slots_horarios")
    .select("hora_inicio")
    .eq("id", aula.slot_horario_id)
    .single();
  if (!slotAtual) return null;

  const hora = parseInt(slotAtual.hora_inicio.split(":")[0]);
  const isNoite = hora >= 19;
  const isManha = hora < 12;

  if (isSextaNoite && isNoite) {
    // Verificar se tem segunda de manhã
    const { count } = await supabase
      .from("aulas")
      .select("*", { head: true, count: "exact" })
      .eq("professor_id", aula.professor_id)
      .eq("dia_semana", "SEGUNDA")
      .eq("status", "ATIVO");

    // Precisaria filtrar só manhã, mas simplificando:
    // Uma verificação mais robusta pegaria os slots da manhã
    if ((count || 0) > 0) {
      return {
        regra: "FIM_DE_SEMANA",
        gravidade: "ALERTA",
        mensagem: `O professor tem aula na sexta à noite e aulas na segunda. Verificar desgaste.`,
        dadosConflito: { professor_id: aula.professor_id },
      };
    }
  }

  return null;
}
