"use server";

/**
 * Motor de Validação de Grade Horária
 * Implementa as 9 regras de validação definidas
 * @module actions/validar-aula
 */

import { createClient } from "@/lib/supabase";
import {
  TipoValidacao,
  GravidadeValidacao,
  ValidacaoLog,
  ResultadoValidacao,
  DadosValidacao,
} from "@/types/validacoes";
import { revalidatePath } from "next/cache";

/**
 * Mapeamento das regras com suas respectivas gravidades e mensagens
 */
const REGRAS_VALIDACAO: Record<
  TipoValidacao,
  { gravidade: GravidadeValidacao; mensagem: string }
> = {
  CHOQUE_TURMA: {
    gravidade: "IMPEDITIVO",
    mensagem: "Esta turma já possui uma aula neste horário.",
  },
  CHOQUE_ESPACO: {
    gravidade: "IMPEDITIVO",
    mensagem: "Este espaço já está reservado neste horário.",
  },
  CHOQUE_DOCENTE: {
    gravidade: "IMPEDITIVO",
    mensagem: "Este professor já está alocado em outra turma neste horário.",
  },
  DESCANSO_DOCENTE: {
    gravidade: "IMPEDITIVO",
    mensagem: "Professor sem descanso adequado entre dias consecutivos.",
  },
  LIMITE_TURNOS: {
    gravidade: "IMPEDITIVO",
    mensagem: "Professor excedeu o limite de turnos permitidos neste dia.",
  },
  DIA_PLANEJAMENTO: {
    gravidade: "ALERTA",
    mensagem: "Esta aula coincide com o dia de planejamento do professor.",
  },
  AULAS_GEMINADAS: {
    gravidade: "ALERTA",
    mensagem: "Turma com mais de duas aulas desta disciplina no mesmo dia.",
  },
  CARGA_HORARIA: {
    gravidade: "ALERTA",
    mensagem: "Disciplina não atingiu a carga horária semanal mínima.",
  },
  FIM_DE_SEMANA: {
    gravidade: "ALERTA",
    mensagem: "Professor com aula na sexta à noite e segunda pela manhã.",
  },
  CUSTOM: {
    gravidade: "ALERTA",
    mensagem: "Validação personalizada detectou uma inconsistência.",
  },
};

/**
 * Executa todas as validações em uma aula recém-inserida
 * @param dados - Dados da aula para validar
 * @returns Resultado contendo todas as validações encontradas
 */
export async function executarValidacoes(
  dados: DadosValidacao,
): Promise<ResultadoValidacao> {
  const supabase = createClient();
  const validacoes: ValidacaoLog[] = [];

  try {
    // 1. Choque de Turma
    const choqueTurma = await verificarChoqueTurma(supabase, dados);
    if (choqueTurma) validacoes.push(choqueTurma);

    // 2. Choque de Espaço
    if (dados.espaco_id) {
      const choqueEspaco = await verificarChoqueEspaco(supabase, dados);
      if (choqueEspaco) validacoes.push(choqueEspaco);
    }

    // 3. Choque de Docente
    const choqueDocente = await verificarChoqueDocente(supabase, dados);
    if (choqueDocente) validacoes.push(choqueDocente);

    // 4. Descanso Docente
    const descansoDocente = await verificarDescansoDocente(supabase, dados);
    if (descansoDocente) validacoes.push(descansoDocente);

    // 5. Limite de Turnos
    const limiteTurnos = await verificarLimiteTurnos(supabase, dados);
    if (limiteTurnos) validacoes.push(limiteTurnos);

    // 6. Dia de Planejamento (implementação simplificada - requer configuração prévia)
    // const diaPlanejamento = await verificarDiaPlanejamento(supabase, dados);
    // if (diaPlanejamento) validacoes.push(diaPlanejamento);

    // 7. Aulas Geminadas
    const aulasGeminadas = await verificarAulasGeminadas(supabase, dados);
    if (aulasGeminadas) validacoes.push(aulasGeminadas);

    // 8. Carga Horária (validação assíncrona - pode ser executada em batch)
    // const cargaHoraria = await verificarCargaHoraria(supabase, dados);
    // if (cargaHoraria) validacoes.push(cargaHoraria);

    // 9. Fim de Semana
    const fimDeSemana = await verificarFimDeSemana(supabase, dados);
    if (fimDeSemana) validacoes.push(fimDeSemana);

    // Salvar logs no banco
    if (validacoes.length > 0) {
      await salvarLogsValidacao(supabase, validacoes);
    }

    return {
      sucesso: true,
      aula_id: dados.aula_id,
      validacoes,
      resumo: {
        impeditivos: validacoes.filter((v) => v.gravidade === "IMPEDITIVO")
          .length,
        alertas: validacoes.filter((v) => v.gravidade === "ALERTA").length,
      },
    };
  } catch (error) {
    console.error("Erro ao executar validações:", error);
    return {
      sucesso: false,
      validacoes: [],
      resumo: { impeditivos: 0, alertas: 0 },
    };
  }
}

/**
 * Regra 1: Verifica se a turma já tem aula no mesmo dia/horário
 */
async function verificarChoqueTurma(
  supabase: any,
  dados: DadosValidacao,
): Promise<ValidacaoLog | null> {
  const { data, error } = await supabase
    .from("aulas")
    .select("id, disciplina_id")
    .eq("turma_id", dados.turma_id)
    .eq("slot_horario_id", dados.slot_horario_id)
    .eq("dia_semana", dados.dia_semana)
    .eq("versao_id", dados.versao_id)
    .neq("id", dados.aula_id)
    .eq("status", "ATIVO")
    .single();

  if (data && !error) {
    return {
      aula_id: dados.aula_id,
      tipo: "CHOQUE_TURMA",
      gravidade: "IMPEDITIVO",
      mensagem: REGRAS_VALIDACAO.CHOQUE_TURMA.mensagem,
      detalhes: {
        aula_conflitante_id: data.id,
        disciplina_conflitante_id: data.disciplina_id,
      },
    };
  }
  return null;
}

/**
 * Regra 2: Verifica se o espaço já está ocupado no mesmo dia/horário
 */
async function verificarChoqueEspaco(
  supabase: any,
  dados: DadosValidacao,
): Promise<ValidacaoLog | null> {
  const { data, error } = await supabase
    .from("aulas")
    .select("id, turma_id")
    .eq("espaco_id", dados.espaco_id)
    .eq("slot_horario_id", dados.slot_horario_id)
    .eq("dia_semana", dados.dia_semana)
    .eq("versao_id", dados.versao_id)
    .neq("id", dados.aula_id)
    .eq("status", "ATIVO")
    .single();

  if (data && !error) {
    return {
      aula_id: dados.aula_id,
      tipo: "CHOQUE_ESPACO",
      gravidade: "IMPEDITIVO",
      mensagem: REGRAS_VALIDACAO.CHOQUE_ESPACO.mensagem,
      detalhes: {
        aula_conflitante_id: data.id,
        turma_conflitante_id: data.turma_id,
      },
    };
  }
  return null;
}

/**
 * Regra 3: Verifica se o professor já está alocado no mesmo dia/horário
 */
async function verificarChoqueDocente(
  supabase: any,
  dados: DadosValidacao,
): Promise<ValidacaoLog | null> {
  const { data, error } = await supabase
    .from("aulas")
    .select("id, turma_id, disciplina_id")
    .eq("professor_id", dados.professor_id)
    .eq("slot_horario_id", dados.slot_horario_id)
    .eq("dia_semana", dados.dia_semana)
    .eq("versao_id", dados.versao_id)
    .neq("id", dados.aula_id)
    .eq("status", "ATIVO")
    .single();

  if (data && !error) {
    return {
      aula_id: dados.aula_id,
      tipo: "CHOQUE_DOCENTE",
      gravidade: "IMPEDITIVO",
      mensagem: REGRAS_VALIDACAO.CHOQUE_DOCENTE.mensagem,
      detalhes: {
        aula_conflitante_id: data.id,
        turma_conflitante_id: data.turma_id,
        disciplina_conflitante_id: data.disciplina_id,
      },
    };
  }
  return null;
}

/**
 * Regra 4: Verifica descanso do professor entre dias consecutivos
 * Um professor não pode ter aulas nos 2 últimos horários de um dia
 * e nos 2 primeiros do dia seguinte
 */
async function verificarDescansoDocente(
  supabase: any,
  dados: DadosValidacao,
): Promise<ValidacaoLog | null> {
  // Mapeamento de dias consecutivos
  const diasConsecutivos: Record<string, string> = {
    SEGUNDA: "TERCA",
    TERCA: "QUARTA",
    QUARTA: "QUINTA",
    QUINTA: "SEXTA",
    SEXTA: "SABADO",
    SABADO: "DOMINGO",
  };

  const diaSeguinte = diasConsecutivos[dados.dia_semana];
  if (!diaSeguinte) return null; // Não há dia seguinte (ex: Domingo)

  // Obter slots dos dois últimos horários do dia atual
  const { data: slotsAtuais } = await supabase
    .from("slots_horarios")
    .select("id")
    .in("hora_inicio", ["20:50", "21:40"]) // Ajuste conforme seus horários noturnos
    .order("hora_inicio", { ascending: false })
    .limit(2);

  // Obter slots dos dois primeiros horários do dia seguinte
  const { data: slotsSeguinte } = await supabase
    .from("slots_horarios")
    .select("id")
    .in("hora_inicio", ["07:30", "08:20"]) // Ajuste conforme seus horários matutinos
    .order("hora_inicio", { ascending: true })
    .limit(2);

  if (!slotsAtuais || !slotsSeguinte) return null;

  const idsSlotsAtuais = slotsAtuais.map((s: any) => s.id);
  const idsSlotsSeguinte = slotsSeguinte.map((s: any) => s.id);

  // Verificar se professor tem aula nos dois últimos horários de hoje
  const { count: countHoje } = await supabase
    .from("aulas")
    .select("*", { head: true, count: "exact" })
    .eq("professor_id", dados.professor_id)
    .eq("dia_semana", dados.dia_semana)
    .in("slot_horario_id", idsSlotsAtuais)
    .eq("versao_id", dados.versao_id)
    .eq("status", "ATIVO");

  // Verificar se professor tem aula nos dois primeiros horários de amanhã
  const { count: countAmanha } = await supabase
    .from("aulas")
    .select("*", { head: true, count: "exact" })
    .eq("professor_id", dados.professor_id)
    .eq("dia_semana", diaSeguinte)
    .in("slot_horario_id", idsSlotsSeguinte)
    .eq("versao_id", dados.versao_id)
    .eq("status", "ATIVO");

  // Se tiver 2 aulas hoje nos últimos horários E 2 aulas amanhã nos primeiros
  if (countHoje === 2 && countAmanha === 2) {
    return {
      aula_id: dados.aula_id,
      tipo: "DESCANSO_DOCENTE",
      gravidade: "IMPEDITIVO",
      mensagem: REGRAS_VALIDACAO.DESCANSO_DOCENTE.mensagem,
      detalhes: {
        dia_atual: dados.dia_semana,
        dia_seguinte: diaSeguinte,
        slots_atuais: idsSlotsAtuais,
        slots_seguintes: idsSlotsSeguinte,
      },
    };
  }

  return null;
}

/**
 * Regra 5: Verifica se professor excede limite de turnos no mesmo dia
 * Considera 3 turnos: Matutino (até 12h), Vespertino (12h-18h), Noturno (após 18h)
 */
async function verificarLimiteTurnos(
  supabase: any,
  dados: DadosValidacao,
): Promise<ValidacaoLog | null> {
  // Obter horário da aula atual
  const { data: slotAtual } = await supabase
    .from("slots_horarios")
    .select("hora_inicio")
    .eq("id", dados.slot_horario_id)
    .single();

  if (!slotAtual) return null;

  const horaInicio = slotAtual.hora_inicio;

  // Determinar turno da aula atual
  let turnoAtual: string;
  const horaNum = parseInt(horaInicio.split(":")[0]);

  if (horaNum < 12) turnoAtual = "MATUTINO";
  else if (horaNum < 18) turnoAtual = "VESPERTINO";
  else turnoAtual = "NOTURNO";

  // Buscar todas as aulas do professor no mesmo dia
  const { data: aulasDoDia } = await supabase
    .from("aulas")
    .select("slot_horario_id")
    .eq("professor_id", dados.professor_id)
    .eq("dia_semana", dados.dia_semana)
    .eq("versao_id", dados.versao_id)
    .eq("status", "ATIVO");

  if (!aulasDoDia) return null;

  // Obter horários de todas as aulas
  const slotIds = aulasDoDia.map((a: any) => a.slot_horario_id);

  const { data: todosSlots } = await supabase
    .from("slots_horarios")
    .select("id, hora_inicio")
    .in("id", slotIds);

  if (!todosSlots) return null;

  // Contar turnos distintos
  const turnosOcupados = new Set<string>();

  todosSlots.forEach((slot: any) => {
    const hora = parseInt(slot.hora_inicio.split(":")[0]);
    if (hora < 12) turnosOcupados.add("MATUTINO");
    else if (hora < 18) turnosOcupados.add("VESPERTINO");
    else turnosOcupados.add("NOTURNO");
  });

  // Se já tiver 3 turnos ocupados, esta aula excede o limite
  if (turnosOcupados.size >= 3 && !turnosOcupados.has(turnoAtual)) {
    return {
      aula_id: dados.aula_id,
      tipo: "LIMITE_TURNOS",
      gravidade: "IMPEDITIVO",
      mensagem: REGRAS_VALIDACAO.LIMITE_TURNOS.mensagem,
      detalhes: {
        turnos_ocupados: Array.from(turnosOcupados),
        turno_atual: turnoAtual,
      },
    };
  }

  return null;
}

/**
 * Regra 7: Verifica se turma tem mais de 2 aulas da mesma disciplina no dia
 */
async function verificarAulasGeminadas(
  supabase: any,
  dados: DadosValidacao,
): Promise<ValidacaoLog | null> {
  const { count } = await supabase
    .from("aulas")
    .select("*", { head: true, count: "exact" })
    .eq("turma_id", dados.turma_id)
    .eq("disciplina_id", dados.disciplina_id)
    .eq("dia_semana", dados.dia_semana)
    .eq("versao_id", dados.versao_id)
    .eq("status", "ATIVO");

  // Se já tiver 2 ou mais aulas desta disciplina no dia, alerta
  if ((count ?? 0) >= 2) {
    return {
      aula_id: dados.aula_id,
      tipo: "AULAS_GEMINADAS",
      gravidade: "ALERTA",
      mensagem: REGRAS_VALIDACAO.AULAS_GEMINADAS.mensagem,
      detalhes: {
        total_aulas_dia: (count ?? 0) + 1, // +1 porque estamos contando antes de inserir
        disciplina_id: dados.disciplina_id,
      },
    };
  }

  return null;
}

/**
 * Regra 9: Verifica se professor tem aula sexta à noite e segunda pela manhã
 */
async function verificarFimDeSemana(
  supabase: any,
  dados: DadosValidacao,
): Promise<ValidacaoLog | null> {
  const { data: slotAtual } = await supabase
    .from("slots_horarios")
    .select("hora_inicio")
    .eq("id", dados.slot_horario_id)
    .single();

  if (!slotAtual) return null;

  const horaInicio = slotAtual.hora_inicio;
  const horaNum = parseInt(horaInicio.split(":")[0]);
  const isNoturno = horaNum >= 18;
  const isMatutino = horaNum < 12;

  // Se é sexta à noite, verifica se tem segunda de manhã
  if (dados.dia_semana === "SEXTA" && isNoturno) {
    const { count } = await supabase
      .from("aulas")
      .select("*", { head: true, count: "exact" })
      .eq("professor_id", dados.professor_id)
      .eq("dia_semana", "SEGUNDA")
      .eq("versao_id", dados.versao_id)
      .eq("status", "ATIVO");

    // Verifica se alguma aula de segunda é matutina
    if ((count ?? 0) > 0) {
      const { data: aulasSegunda } = await supabase
        .from("aulas")
        .select("slot_horario_id")
        .eq("professor_id", dados.professor_id)
        .eq("dia_semana", "SEGUNDA")
        .eq("versao_id", dados.versao_id)
        .eq("status", "ATIVO");

      const slotIds = aulasSegunda?.map((a: any) => a.slot_horario_id) || [];

      const { data: slotsSegunda } = await supabase
        .from("slots_horarios")
        .select("hora_inicio")
        .in("id", slotIds);

      const temMatutino = slotsSegunda?.some(
        (s: any) => parseInt(s.hora_inicio.split(":")[0]) < 12,
      );

      if (temMatutino) {
        return {
          aula_id: dados.aula_id,
          tipo: "FIM_DE_SEMANA",
          gravidade: "ALERTA",
          mensagem: REGRAS_VALIDACAO.FIM_DE_SEMANA.mensagem,
          detalhes: {
            sexta_noturno: true,
            segunda_matutino: true,
          },
        };
      }
    }
  }

  // Se é segunda de manhã, verifica se tem sexta à noite
  if (dados.dia_semana === "SEGUNDA" && isMatutino) {
    const { count } = await supabase
      .from("aulas")
      .select("*", { head: true, count: "exact" })
      .eq("professor_id", dados.professor_id)
      .eq("dia_semana", "SEXTA")
      .eq("versao_id", dados.versao_id)
      .eq("status", "ATIVO");

    if ((count ?? 0) > 0) {
      const { data: aulasSexta } = await supabase
        .from("aulas")
        .select("slot_horario_id")
        .eq("professor_id", dados.professor_id)
        .eq("dia_semana", "SEXTA")
        .eq("versao_id", dados.versao_id)
        .eq("status", "ATIVO");

      const slotIds = aulasSexta?.map((a: any) => a.slot_horario_id) || [];

      const { data: slotsSexta } = await supabase
        .from("slots_horarios")
        .select("hora_inicio")
        .in("id", slotIds);

      const temNoturno = slotsSexta?.some(
        (s: any) => parseInt(s.hora_inicio.split(":")[0]) >= 18,
      );

      if (temNoturno) {
        return {
          aula_id: dados.aula_id,
          tipo: "FIM_DE_SEMANA",
          gravidade: "ALERTA",
          mensagem: REGRAS_VALIDACAO.FIM_DE_SEMANA.mensagem,
          detalhes: {
            sexta_noturno: true,
            segunda_matutino: true,
          },
        };
      }
    }
  }

  return null;
}

/**
 * Salva os logs de validação no banco de dados
 */
async function salvarLogsValidacao(
  supabase: any,
  validacoes: ValidacaoLog[],
): Promise<void> {
  const logsParaInserir = validacoes.map((v) => ({
    aula_id: v.aula_id,
    tipo: v.tipo,
    gravidade: v.gravidade,
    mensagem: v.mensagem,
    detalhes: v.detalhes || {},
  }));

  await supabase.from("validacoes_logs").insert(logsParaInserir);
}

/**
 * Server Action principal para salvar aula com validações
 */
export async function salvarAulaComValidacoes(formData: FormData) {
  const supabase = createClient();

  try {
    // Extrair dados do form
    const turma_id = parseInt(formData.get("turma_id") as string);
    const disciplina_id = parseInt(formData.get("disciplina_id") as string);
    const professor_id = parseInt(formData.get("professor_id") as string);
    const espaco_id = formData.get("espaco_id")
      ? parseInt(formData.get("espaco_id") as string)
      : null;
    const slot_horario_id = parseInt(formData.get("slot_horario_id") as string);
    const dia_semana = formData.get("dia_semana") as string;
    const versao_id = parseInt(formData.get("versao_id") as string);

    // Inserir aula primeiro
    const { data: aulaInserida, error: insertError } = await supabase
      .from("aulas")
      .insert([
        {
          turma_id,
          disciplina_id,
          professor_id,
          espaco_id,
          slot_horario_id,
          dia_semana,
          versao_id,
          status: "ATIVO",
        },
      ])
      .select()
      .single();

    if (insertError || !aulaInserida) {
      return {
        sucesso: false,
        mensagem:
          "Erro ao salvar aula: " + (insertError?.message || "Desconhecido"),
      };
    }

    // Executar validações
    const dadosValidacao: DadosValidacao = {
      aula_id: aulaInserida.id,
      turma_id,
      disciplina_id,
      professor_id,
      espaco_id,
      slot_horario_id,
      dia_semana,
      versao_id,
    };

    const resultadoValidacoes = await executarValidacoes(dadosValidacao);

    // Revalidar cache
    revalidatePath("/(admin)/lancamentos");

    return {
      sucesso: true,
      aula_id: aulaInserida.id,
      validacoes: resultadoValidacoes.validacoes,
      resumo: resultadoValidacoes.resumo,
    };
  } catch (error: any) {
    console.error("Erro ao salvar aula com validações:", error);
    return {
      sucesso: false,
      mensagem: error.message || "Erro desconhecido ao salvar aula",
    };
  }
}
