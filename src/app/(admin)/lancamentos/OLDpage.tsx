"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";

interface LinhaLancamento {
  id: string;
  turma_id: string;
  disciplina_id: string;
  professor_id: string;
  dia_semana: string;
  slot_horario_id: string;
  espaco_id: string;
}

export default function LancamentosModoPlanilha() {
  const [professores, setProfessores] = useState<any[]>([]);
  const [disciplinas, setDisciplinas] = useState<any[]>([]);
  const [turmas, setTurmas] = useState<any[]>([]);
  const [espacos, setEspacos] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);

  const [linhas, setLinhas] = useState<LinhaLancamento[]>([]);
  const [carregando, setCarregando] = useState(true);

  // ==========================================================================
  // MOTOR DE ALERTAS AVANÇADO (SOFT VALIDATION)
  // ==========================================================================
  const mapaDeConflitos = useMemo(() => {
    const conflitos = new Map<string, string[]>();
    // Filtra apenas as linhas que já têm o mínimo necessário para serem analisadas
    const linhasValidas = linhas.filter(
      (l) => l.dia_semana && l.slot_horario_id,
    );

    // --- 🛠️ HELPERS DE TEMPO E TURNO 🛠️ ---
    // Busca os dados reais do horário (hora_inicio, hora_fim)
    const getSlot = (id: string) => slots.find((s) => s.id === id);

    // Define o turno baseado na hora de início (07h às 11h = Manhã | 13h às 17h = Tarde | 18h+ = Noite)
    const getTurno = (hora_inicio: string) => {
      if (!hora_inicio) return null;
      const hora = parseInt(hora_inicio.split(":")[0]);
      if (hora <= 12) return "MANHA";
      if (hora < 18) return "TARDE";
      return "NOITE";
    };

    // Identifica se é a Primeira Aula do dia (ex: começa até as 08:00)
    const isPrimeiraDaManha = (hora_inicio: string) => {
      if (!hora_inicio) return false;
      return parseInt(hora_inicio.split(":")[0]) <= 8;
    };

    // Identifica se é a Última Aula da noite (ex: termina às 22:00 ou depois)
    const isUltimaDaNoite = (hora_fim: string) => {
      if (!hora_fim) return false;
      return parseInt(hora_fim.split(":")[0]) >= 22;
    };

    // Mapa lógico para descobrir qual é o dia "Anterior" e o "Seguinte"
    const mapaDias: Record<string, number> = {
      SEGUNDA: 1,
      TERCA: 2,
      QUARTA: 3,
      QUINTA: 4,
      SEXTA: 5,
      SABADO: 6,
    };
    const getDiaAnterior = (dia: string) =>
      Object.keys(mapaDias).find((k) => mapaDias[k] === mapaDias[dia] - 1);
    const getDiaSeguinte = (dia: string) =>
      Object.keys(mapaDias).find((k) => mapaDias[k] === mapaDias[dia] + 1);

    // --- 🔎 VARREDURA DE REGRAS (LINHA A LINHA) 🔎 ---
    linhasValidas.forEach((aulaAtual) => {
      const errosDaLinha: string[] = [];
      const slotAtual = getSlot(aulaAtual.slot_horario_id);

      if (!slotAtual) return;
      const turnoAtual = getTurno(slotAtual.hora_inicio);

      // Contadores para as regras acumulativas (Regras 4 e 5)
      let turnosDoProfessorNoDia = new Set<string>();
      let aulasDestaDisciplinaNoDia = 0;

      linhasValidas.forEach((outraAula) => {
        if (aulaAtual.id === outraAula.id) return; // Não compara a linha com ela mesma

        const outroSlot = getSlot(outraAula.slot_horario_id);
        if (!outroSlot) return;

        const mesmoDia = aulaAtual.dia_semana === outraAula.dia_semana;
        const mesmoHorario =
          aulaAtual.slot_horario_id === outraAula.slot_horario_id;

        // 🛑 REGRAS 1, 2 e 3: CHOQUES DIRETOS (Mesmo Dia e Mesmo Horário)
        if (mesmoDia && mesmoHorario) {
          if (
            aulaAtual.professor_id &&
            aulaAtual.professor_id === outraAula.professor_id
          ) {
            errosDaLinha.push(
              "Choque 1: Professor já alocado em outra turma neste horário.",
            );
          }
          if (aulaAtual.turma_id && aulaAtual.turma_id === outraAula.turma_id) {
            errosDaLinha.push(
              "Choque 2: Turma já possui outra disciplina neste horário.",
            );
          }
          if (
            aulaAtual.espaco_id &&
            aulaAtual.espaco_id === outraAula.espaco_id
          ) {
            errosDaLinha.push(
              "Choque 3: Sala/Laboratório já ocupado neste horário.",
            );
          }
        }

        // 🛑 REGRA 4: LIMITE DE TURNOS DO PROFESSOR (Máx 2 por dia)
        if (
          mesmoDia &&
          aulaAtual.professor_id &&
          aulaAtual.professor_id === outraAula.professor_id
        ) {
          const outroTurno = getTurno(outroSlot.hora_inicio);
          if (outroTurno) turnosDoProfessorNoDia.add(outroTurno);
        }

        // 🛑 REGRA 5: LIMITE DE AULAS GEMINADAS (Máx 2 por dia da mesma disciplina na turma)
        if (
          mesmoDia &&
          aulaAtual.turma_id &&
          aulaAtual.turma_id === outraAula.turma_id
        ) {
          if (
            aulaAtual.disciplina_id &&
            aulaAtual.disciplina_id === outraAula.disciplina_id
          ) {
            aulasDestaDisciplinaNoDia++;
          }
        }

        // 🛑 REGRA 6: PERÍODO DE DESCANSO (Dobradinha Noite -> Manhã)
        if (
          aulaAtual.professor_id &&
          aulaAtual.professor_id === outraAula.professor_id
        ) {
          const diaAnterior = getDiaAnterior(aulaAtual.dia_semana);
          const diaSeguinte = getDiaSeguinte(aulaAtual.dia_semana);

          // Se a aula ATUAL é Primeira da Manhã, a OUTRA aula não pode ter sido a Última da Noite de ontem
          if (
            isPrimeiraDaManha(slotAtual.hora_inicio) &&
            outraAula.dia_semana === diaAnterior &&
            isUltimaDaNoite(outroSlot.hora_fim)
          ) {
            errosDaLinha.push(
              "Regra Trabalhista: Sem descanso legal (Professor lecionou no último horário da noite passada).",
            );
          }

          // Se a aula ATUAL é Última da Noite, a OUTRA aula não pode ser a Primeira da Manhã de amanhã
          if (
            isUltimaDaNoite(slotAtual.hora_fim) &&
            outraAula.dia_semana === diaSeguinte &&
            isPrimeiraDaManha(outroSlot.hora_inicio)
          ) {
            errosDaLinha.push(
              "Regra Trabalhista: Sem descanso legal (Professor alocado no primeiro horário de amanhã).",
            );
          }
        }
      });

      // --- Fechamento das regras acumulativas ---
      if (turnoAtual) turnosDoProfessorNoDia.add(turnoAtual); // Conta o próprio turno atual
      if (turnosDoProfessorNoDia.size > 2) {
        errosDaLinha.push(
          `Limite Excedido: Professor alocado em ${turnosDoProfessorNoDia.size} turnos hoje.`,
        );
      }

      if (aulasDestaDisciplinaNoDia + 1 > 2) {
        // +1 conta a própria aula atual
        errosDaLinha.push(
          "Limite Excedido: Mais de 2 aulas (geminadas) da mesma disciplina para esta turma hoje.",
        );
      }

      // Se houver qualquer erro, adiciona ao mapa final sem repetições
      if (errosDaLinha.length > 0) {
        conflitos.set(aulaAtual.id, [...new Set(errosDaLinha)]);
      }
    });

    return conflitos;
  }, [linhas, slots]); // O React atualiza isso vivo se as linhas ou a tabela de horários mudarem

  // ==========================================================================
  // CARREGAMENTO INICIAL E CONEXÃO REALTIME (WEBSOCKETS)
  // ==========================================================================
  useEffect(() => {
    async function inicializarSistema() {
      setCarregando(true);

      // 1. Busca os dados de base e os lançamentos já existentes
      const [
        { data: profs },
        { data: discips },
        { data: turms },
        { data: espcs },
        { data: slts },
        { data: auls },
      ] = await Promise.all([
        supabase.from("professores").select("*").order("nome"),
        supabase.from("disciplinas").select("*").order("nome"),
        supabase.from("turmas").select("*").order("codigo"),
        supabase.from("espacos").select("*").order("nome"),
        supabase.from("slots_horarios").select("*").order("ordem"),
        supabase.from("aulas").select("*"),
      ]);

      if (profs) setProfessores(profs);
      if (discips) setDisciplinas(discips);
      if (turms) setTurmas(turms);
      if (espcs) setEspacos(espcs);
      if (slts) setSlots(slts);

      // 2. Monta a planilha com os dados do banco
      let linhasSalvas: LinhaLancamento[] = [];
      if (auls) {
        linhasSalvas = auls.map((a: any) => ({
          id: a.id,
          turma_id: a.turma_id || "",
          disciplina_id: a.disciplina_id || "",
          professor_id: a.professor_id || "",
          dia_semana: a.dia_semana || "",
          slot_horario_id: a.slot_horario_id || "",
          espaco_id: a.espaco_id || "",
        }));
      }

      // Adiciona 5 linhas em branco para começar
      const linhasEmBranco = Array.from({ length: 5 }, () => ({
        id: crypto.randomUUID(),
        turma_id: "",
        disciplina_id: "",
        professor_id: "",
        dia_semana: "",
        slot_horario_id: "",
        espaco_id: "",
      }));

      setLinhas([...linhasSalvas, ...linhasEmBranco]);
      setCarregando(false);
    }

    inicializarSistema();

    // 3. O CORAÇÃO DO REALTIME: Escutando o Supabase ao vivo
    const canalAulas = supabase
      .channel("mudancas_aulas")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "aulas" },
        (payload) => {
          setLinhas((linhasAtuais) => {
            // Se outro usuário INSERIU uma nova aula
            if (payload.eventType === "INSERT") {
              const existe = linhasAtuais.find((l) => l.id === payload.new.id);
              if (existe) return linhasAtuais; // Evita duplicar se fomos nós que salvamos

              const novaLinha: LinhaLancamento = {
                id: payload.new.id,
                turma_id: payload.new.turma_id || "",
                disciplina_id: payload.new.disciplina_id || "",
                professor_id: payload.new.professor_id || "",
                dia_semana: payload.new.dia_semana || "",
                slot_horario_id: payload.new.slot_horario_id || "",
                espaco_id: payload.new.espaco_id || "",
              };
              return [novaLinha, ...linhasAtuais];
            }

            // Se outro usuário ATUALIZOU uma aula
            if (payload.eventType === "UPDATE") {
              return linhasAtuais.map((l) =>
                l.id === payload.new.id
                  ? {
                      ...l,
                      turma_id: payload.new.turma_id || "",
                      disciplina_id: payload.new.disciplina_id || "",
                      professor_id: payload.new.professor_id || "",
                      dia_semana: payload.new.dia_semana || "",
                      slot_horario_id: payload.new.slot_horario_id || "",
                      espaco_id: payload.new.espaco_id || "",
                    }
                  : l,
              );
            }

            // Se outro usuário DELETOU uma aula
            if (payload.eventType === "DELETE") {
              return linhasAtuais.filter((l) => l.id !== payload.old.id);
            }

            return linhasAtuais;
          });
        },
      )
      .subscribe();

    // Limpa a conexão WebSocket quando o usuário sai da página
    return () => {
      supabase.removeChannel(canalAulas);
    };
  }, []);

  // ==========================================================================
  // FUNÇÕES DE MANIPULAÇÃO DA PLANILHA E SALVAMENTO
  // ==========================================================================
  const adicionarLinha = () => {
    setLinhas([
      ...linhas,
      {
        id: crypto.randomUUID(),
        turma_id: "",
        disciplina_id: "",
        professor_id: "",
        dia_semana: "",
        slot_horario_id: "",
        espaco_id: "",
      },
    ]);
  };

  const removerLinha = async (id: string) => {
    setLinhas(linhas.filter((l) => l.id !== id));
    await supabase.from("aulas").delete().eq("id", id);
  };

  const duplicarLinha = (id_original: string) => {
    // 1. Encontra a linha que o usuário quer copiar
    const linhaParaCopiar = linhas.find((l) => l.id === id_original);
    if (!linhaParaCopiar) return;

    // 2. Cria a cópia exata, mas com um NOVO ID
    const novaLinha: LinhaLancamento = {
      ...linhaParaCopiar,
      id: crypto.randomUUID(),
    };

    // 3. Descobre a posição da linha original para inserir a cópia logo abaixo dela
    const indexOriginal = linhas.findIndex((l) => l.id === id_original);
    const novasLinhas = [...linhas];
    novasLinhas.splice(indexOriginal + 1, 0, novaLinha);

    setLinhas(novasLinhas);
  };

  const atualizarCampo = (
    id: string,
    campo: keyof LinhaLancamento,
    valor: string,
  ) => {
    setLinhas(linhas.map((l) => (l.id === id ? { ...l, [campo]: valor } : l)));
  };

  const salvarLote = async () => {
    const linhasParaSalvar = linhas.filter(
      (l) =>
        l.turma_id ||
        l.disciplina_id ||
        l.professor_id ||
        l.dia_semana ||
        l.slot_horario_id ||
        l.espaco_id,
    );

    if (linhasParaSalvar.length === 0) {
      alert(
        "A planilha está vazia. Preencha pelo menos um dado antes de salvar.",
      );
      return;
    }

    const dadosSupabase = linhasParaSalvar.map((l) => {
      const estaCompleto = Boolean(
        l.turma_id &&
        l.disciplina_id &&
        l.professor_id &&
        l.dia_semana &&
        l.slot_horario_id &&
        l.espaco_id,
      );
      return {
        id: l.id,
        turma_id: l.turma_id || null,
        disciplina_id: l.disciplina_id || null,
        professor_id: l.professor_id || null,
        espaco_id: l.espaco_id || null,
        slot_horario_id: l.slot_horario_id || null,
        dia_semana: l.dia_semana || null,
        status: estaCompleto ? "COMPLETO" : "INCOMPLETO",
      };
    });

    const { error } = await supabase
      .from("aulas")
      .upsert(dadosSupabase, { onConflict: "id" });

    if (error) {
      alert("Houve um erro ao tentar salvar os dados. Verifique a conexão.");
    } else {
      // Adiciona mais linhas em branco para manter o fluxo fluído após salvar
      const maisLinhasBranco = Array.from({ length: 3 }, () => ({
        id: crypto.randomUUID(),
        turma_id: "",
        disciplina_id: "",
        professor_id: "",
        dia_semana: "",
        slot_horario_id: "",
        espaco_id: "",
      }));
      setLinhas([...linhasParaSalvar, ...maisLinhasBranco]);
    }
  };

  // ==========================================================================
  // RENDERIZAÇÃO DA INTERFACE (UI)
  // ==========================================================================
  if (carregando)
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500 font-medium">
        Carregando a planilha do banco de dados...
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-[1400px] mx-auto space-y-6">
        <header className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              Lançamento de Horários
            </h1>
            <p className="text-sm text-gray-500 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Modo Colaborativo (Ao Vivo)
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={adicionarLinha}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium border border-gray-300"
            >
              + Adicionar Linha
            </button>
            <button
              onClick={salvarLote}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium shadow-sm"
            >
              Salvar Lançamentos
            </button>
          </div>
        </header>

        <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="w-full">
            {/* O 'table-fixed' força a tabela a respeitar os limites da tela */}
            <table className="w-full text-left border-collapse table-fixed">
              <thead>
                <tr className="bg-green-700 text-white text-xs uppercase tracking-wider">
                  {/* Distribuição percentual estratégica das larguras */}
                  <th className="p-3 border-r border-green-600 w-[10%]">
                    Turma
                  </th>
                  <th className="p-3 border-r border-green-600 w-[25%]">
                    Disciplina
                  </th>
                  <th className="p-3 border-r border-green-600 w-[20%]">
                    Professor
                  </th>
                  <th className="p-3 border-r border-green-600 w-[12%]">Dia</th>
                  <th className="p-3 border-r border-green-600 w-[15%]">
                    Horário
                  </th>
                  <th className="p-3 border-r border-green-600 w-[12%]">
                    Sala
                  </th>
                  <th className="p-3 text-center w-20">Ação</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {linhas.map((linha) => {
                  const temDado =
                    linha.turma_id ||
                    linha.disciplina_id ||
                    linha.professor_id ||
                    linha.dia_semana ||
                    linha.slot_horario_id ||
                    linha.espaco_id;
                  const estaCompleta =
                    linha.turma_id &&
                    linha.disciplina_id &&
                    linha.professor_id &&
                    linha.dia_semana &&
                    linha.slot_horario_id &&
                    linha.espaco_id;
                  const linhaRascunho = temDado && !estaCompleta;

                  const erros = mapaDeConflitos
                    ? mapaDeConflitos.get(linha.id)
                    : [];
                  const temConflito = erros && erros.length > 0;

                  let corLinha =
                    "border-b hover:bg-gray-50 transition-colors group";
                  if (temConflito) {
                    corLinha =
                      "border-b bg-red-50 hover:bg-red-100 transition-colors group border-red-200";
                  } else if (linhaRascunho) {
                    corLinha =
                      "border-b bg-yellow-50/30 hover:bg-yellow-50 transition-colors group";
                  }

                  return (
                    <tr key={linha.id} className={corLinha}>
                      <td className="p-2 border-r border-gray-200 overflow-hidden">
                        <select
                          value={linha.turma_id}
                          onChange={(e) =>
                            atualizarCampo(linha.id, "turma_id", e.target.value)
                          }
                          className="w-full truncate bg-transparent border-0 border-b border-transparent focus:border-green-500 focus:ring-0 text-sm p-1 outline-none"
                          title={
                            turmas.find((t) => t.id === linha.turma_id)
                              ?.codigo || "Selecione..."
                          }
                        >
                          <option value="">Selecione...</option>
                          {turmas.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.codigo}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2 border-r border-gray-200 overflow-hidden">
                        <select
                          value={linha.disciplina_id}
                          onChange={(e) =>
                            atualizarCampo(
                              linha.id,
                              "disciplina_id",
                              e.target.value,
                            )
                          }
                          className="w-full truncate bg-transparent border-0 border-b border-transparent focus:border-green-500 focus:ring-0 text-sm p-1 outline-none"
                          title={
                            disciplinas.find(
                              (d) => d.id === linha.disciplina_id,
                            )?.nome || "Selecione..."
                          }
                        >
                          <option value="">Selecione...</option>
                          {disciplinas.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.nome}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2 border-r border-gray-200 overflow-hidden">
                        <select
                          value={linha.professor_id}
                          onChange={(e) =>
                            atualizarCampo(
                              linha.id,
                              "professor_id",
                              e.target.value,
                            )
                          }
                          className="w-full truncate bg-transparent border-0 border-b border-transparent focus:border-green-500 focus:ring-0 text-sm p-1 outline-none"
                          title={
                            professores.find((p) => p.id === linha.professor_id)
                              ?.nome || "Selecione..."
                          }
                        >
                          <option value="">Selecione...</option>
                          {professores.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nome}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2 border-r border-gray-200 overflow-hidden">
                        <select
                          value={linha.dia_semana}
                          onChange={(e) =>
                            atualizarCampo(
                              linha.id,
                              "dia_semana",
                              e.target.value,
                            )
                          }
                          className="w-full truncate bg-transparent border-0 border-b border-transparent focus:border-green-500 focus:ring-0 text-sm p-1 outline-none"
                        >
                          <option value="">Selecione...</option>
                          <option value="SEGUNDA">Segunda-feira</option>
                          <option value="TERCA">Terça-feira</option>
                          <option value="QUARTA">Quarta-feira</option>
                          <option value="QUINTA">Quinta-feira</option>
                          <option value="SEXTA">Sexta-feira</option>
                          <option value="SABADO">Sábado</option>
                        </select>
                      </td>
                      <td className="p-2 border-r border-gray-200 overflow-hidden">
                        <select
                          value={linha.slot_horario_id}
                          onChange={(e) =>
                            atualizarCampo(
                              linha.id,
                              "slot_horario_id",
                              e.target.value,
                            )
                          }
                          className="w-full truncate bg-transparent border-0 border-b border-transparent focus:border-green-500 focus:ring-0 text-sm p-1 outline-none"
                        >
                          <option value="">Selecione...</option>
                          {slots.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.hora_inicio} - {s.hora_fim}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2 border-r border-gray-200 overflow-hidden">
                        <select
                          value={linha.espaco_id}
                          onChange={(e) =>
                            atualizarCampo(
                              linha.id,
                              "espaco_id",
                              e.target.value,
                            )
                          }
                          className="w-full truncate bg-transparent border-0 border-b border-transparent focus:border-green-500 focus:ring-0 text-sm p-1 outline-none"
                          title={
                            espacos.find((e) => e.id === linha.espaco_id)
                              ?.nome || "Selecione..."
                          }
                        >
                          <option value="">Selecione...</option>
                          {espacos.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.nome}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td
                        className={`p-2 text-center transition-colors ${temConflito ? "bg-red-100/50" : "bg-gray-50 group-hover:bg-gray-100"}`}
                      >
                        <div className="flex items-center justify-center gap-1 relative">
                          {temConflito && (
                            <span
                              className="text-red-600 font-bold cursor-help text-lg"
                              title={erros?.join("\n")}
                            >
                              ⚠️
                            </span>
                          )}
                          <button
                            onClick={() => duplicarLinha(linha.id)}
                            className="text-gray-400 hover:text-blue-600 font-bold px-1 py-1 rounded text-lg transition-colors"
                            title="Duplicar linha (Aulas Geminadas)"
                          >
                            ⧉
                          </button>
                          <button
                            onClick={() => removerLinha(linha.id)}
                            className="text-gray-400 hover:text-red-600 font-bold px-1 py-1 rounded transition-colors"
                            title="Remover linha"
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
