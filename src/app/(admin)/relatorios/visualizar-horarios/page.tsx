"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function VisualizarHorariosAdminPage() {
  const [carregando, setCarregando] = useState(true);

  const [versoes, setVersoes] = useState<any[]>([]);
  const [versaoSelecionada, setVersaoSelecionada] = useState<string>("");

  const [dados, setDados] = useState<any>({
    aulas: [],
    turmas: [],
    cursos: [],
    professores: [],
    disciplinas: [],
    espacos: [],
    categorias: [],
    slots: [],
  });

  const [tipoFiltro, setTipoFiltro] = useState<
    "TURMA" | "PROFESSOR" | "ESPACO"
  >("TURMA");
  const [idSelecionado, setIdSelecionado] = useState<string>("");

  const diasSemana = [
    { id: "SEGUNDA", nome: "Segunda" },
    { id: "TERCA", nome: "Terça" },
    { id: "QUARTA", nome: "Quarta" },
    { id: "QUINTA", nome: "Quinta" },
    { id: "SEXTA", nome: "Sexta" },
  ];

  // 1. CARREGA AS VERSÕES E SELECIONA O RASCUNHO POR PADRÃO
  useEffect(() => {
    async function carregarVersoes() {
      const { data } = await supabase
        .from("versoes_grade")
        .select("*")
        .order("data_inicio_vigencia", { ascending: false });

      if (data && data.length > 0) {
        setVersoes(data);

        // REGRA DE PADRÃO: Prioriza encontrar um RASCUNHO, senão pega a primeira
        const rascunho = data.find((v) => v.status === "RASCUNHO");
        if (rascunho) {
          setVersaoSelecionada(rascunho.id);
        } else {
          setVersaoSelecionada(data[0].id);
        }
      } else {
        setCarregando(false);
      }
    }
    carregarVersoes();
  }, []);

  // 2. BUSCA OS DADOS INICIAIS DA ESTRUTURA
  const carregarAulasEStrutura = async () => {
    try {
      const [
        { data: aulas },
        { data: turmas },
        { data: cursos },
        { data: professores },
        { data: disciplinas },
        { data: espacos },
        { data: categorias },
        { data: slots },
      ] = await Promise.all([
        supabase
          .from("aulas")
          .select("*")
          .eq("versao_id", versaoSelecionada)
          .limit(5000),
        supabase.from("turmas").select("*").order("codigo").limit(2000),
        supabase.from("cursos").select("*").order("nome"),
        supabase.from("professores").select("*").order("nome").limit(1000),
        supabase.from("disciplinas").select("*").order("nome").limit(5000),
        supabase.from("espacos").select("*").order("nome").limit(1000),
        supabase.from("categorias_espacos").select("*").order("nome"),
        supabase.from("slots_horarios").select("*").order("hora_inicio"),
      ]);

      setDados({
        aulas: aulas || [],
        turmas: turmas || [],
        cursos: cursos || [],
        professores: professores || [],
        disciplinas: disciplinas || [],
        espacos: espacos || [],
        categorias: categorias || [],
        slots: slots || [],
      });
    } catch (error) {
      console.error(error);
    } finally {
      setCarregando(false);
    }
  };

  // 3. EFEITO QUE GERENCIA A ESCUTA EM TEMPO REAL
  useEffect(() => {
    if (!versaoSelecionada) return;

    let montado = true;
    setCarregando(true);
    carregarAulasEStrutura();

    console.log(
      "🟢 Iniciando conexão WebSocket para a versão:",
      versaoSelecionada,
    );

    // Usa um nome de canal fixo por versão para evitar duplicidade no Hot Reload
    const canal = supabase
      .channel(`realtime-aulas-${versaoSelecionada}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "aulas" },
        (payload) => {
          console.log("🔔 EVENTO REALTIME CHEGOU DO BANCO:", payload);

          if (!montado) return;

          setDados((prev: any) => {
            let novasAulas = [...prev.aulas];

            if (payload.eventType === "INSERT") {
              if (String(payload.new.versao_id) === String(versaoSelecionada)) {
                const jaExiste = novasAulas.some(
                  (a) => String(a.id) === String(payload.new.id),
                );
                if (!jaExiste) novasAulas.push(payload.new);
              }
            } else if (payload.eventType === "DELETE") {
              novasAulas = novasAulas.filter(
                (a) => String(a.id) !== String(payload.old.id),
              );
            } else if (payload.eventType === "UPDATE") {
              if (String(payload.new.versao_id) === String(versaoSelecionada)) {
                const index = novasAulas.findIndex(
                  (a) => String(a.id) === String(payload.new.id),
                );
                if (index !== -1) {
                  novasAulas[index] = payload.new;
                } else {
                  novasAulas.push(payload.new);
                }
              } else {
                novasAulas = novasAulas.filter(
                  (a) => String(a.id) !== String(payload.new.id),
                );
              }
            }

            return { ...prev, aulas: novasAulas };
          });
        },
      )
      .subscribe((status) => {
        console.log("📡 Status do WebSocket:", status);
      });

    return () => {
      montado = false;
      supabase.removeChannel(canal);
    };
  }, [versaoSelecionada]);

  const formatarHora = (hora: string) => (hora ? hora.substring(0, 5) : "");
  const formatarData = (dataStr: string) => {
    if (!dataStr) return "";
    const data = new Date(dataStr);
    return new Date(
      data.getTime() + data.getTimezoneOffset() * 60000,
    ).toLocaleDateString("pt-BR");
  };

  const obterTituloGrade = () => {
    if (!idSelecionado) return "";
    if (tipoFiltro === "TURMA")
      return `Turma: ${dados.turmas.find((t: any) => t.id === idSelecionado)?.codigo}`;
    if (tipoFiltro === "PROFESSOR")
      return `Professor(a): ${dados.professores.find((p: any) => p.id === idSelecionado)?.nome}`;
    if (tipoFiltro === "ESPACO")
      return `Espaço: ${dados.espacos.find((e: any) => e.id === idSelecionado)?.nome}`;
    return "";
  };

  const infoVersao = versoes.find(
    (v) => String(v.id) === String(versaoSelecionada),
  );

  const getAulasPublico = (diaId: string, slotId: string) => {
    return dados.aulas.filter(
      (a: any) =>
        a.dia_semana === diaId &&
        String(a.slot_horario_id) === String(slotId) &&
        (tipoFiltro === "TURMA"
          ? String(a.turma_id) === String(idSelecionado)
          : tipoFiltro === "PROFESSOR"
            ? String(a.professor_id) === String(idSelecionado)
            : String(a.espaco_id) === String(idSelecionado)),
    );
  };

  const aulasDoFiltro = dados.aulas.filter((a: any) => {
    if (tipoFiltro === "TURMA")
      return String(a.turma_id) === String(idSelecionado);
    if (tipoFiltro === "PROFESSOR")
      return String(a.professor_id) === String(idSelecionado);
    return String(a.espaco_id) === String(idSelecionado);
  });

  const slotsOcupadosIds = new Set(
    aulasDoFiltro.map((a: any) => String(a.slot_horario_id)),
  );

  const todosTurnos = [
    {
      nome: "Manhã",
      slots: dados.slots.filter((s: any) => s.hora_inicio < "12:00"),
    },
    {
      nome: "Tarde",
      slots: dados.slots.filter(
        (s: any) => s.hora_inicio >= "12:00" && s.hora_inicio < "18:00",
      ),
    },
    {
      nome: "Noite",
      slots: dados.slots.filter((s: any) => s.hora_inicio >= "18:00"),
    },
  ];

  const turnosOcupados = todosTurnos
    .filter((turno) =>
      turno.slots.some((slot: any) => slotsOcupadosIds.has(String(slot.id))),
    )
    .map((turno) => {
      return {
        ...turno,
        slots: turno.slots.filter((slot: any, index: number) => {
          if (index < 4) return true;
          return slotsOcupadosIds.has(String(slot.id));
        }),
      };
    });

  if (carregando && !versaoSelecionada) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* BARRA DE FILTROS ADAPTADA PARA O CORPO INTERNO */}
      <div className="bg-green-900 p-4 shadow-sm rounded-xl text-white flex flex-col lg:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-base font-black uppercase tracking-tight text-white">
            Visualizador de Horários Interno
          </h1>
          <p className="text-[10px] text-green-200 font-medium uppercase tracking-wider">
            Monitoramento e Atualização em Tempo Real (WebSocket Ativo)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 justify-end w-full lg:w-auto">
          {versoes.length > 0 && (
            <select
              value={versaoSelecionada}
              onChange={(e) => {
                setVersaoSelecionada(e.target.value);
                setIdSelecionado("");
              }}
              className="bg-green-800 border border-green-700 text-white rounded p-2 text-xs font-bold outline-none cursor-pointer hover:bg-green-700 max-w-[200px]"
            >
              {versoes.map((v) => (
                <option key={v.id} value={v.id} className="text-gray-800">
                  {v.nome} ({v.status})
                </option>
              ))}
            </select>
          )}

          <div className="flex bg-green-950 rounded-lg p-1">
            {(["TURMA", "PROFESSOR", "ESPACO"] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTipoFiltro(t);
                  setIdSelecionado("");
                }}
                className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition-all ${tipoFiltro === t ? "bg-green-600 text-white" : "text-green-400 hover:text-white"}`}
              >
                {t === "TURMA"
                  ? "Turmas"
                  : t === "PROFESSOR"
                    ? "Professores"
                    : "Salas"}
              </button>
            ))}
          </div>

          <select
            value={idSelecionado}
            onChange={(e) => setIdSelecionado(e.target.value)}
            className="bg-white text-gray-800 rounded-lg p-2 text-xs font-bold outline-none w-full sm:w-[200px] truncate h-9"
          >
            <option value="">Escolha...</option>
            {tipoFiltro === "TURMA" &&
              dados.cursos.map((curso: any) => {
                const turmasDoCurso = dados.turmas.filter(
                  (t: any) => String(t.curso_id) === String(curso.id),
                );
                if (turmasDoCurso.length === 0) return null;
                return (
                  <optgroup key={curso.id} label={curso.nome}>
                    {turmasDoCurso.map((t: any) => (
                      <option key={t.id} value={t.id}>
                        {t.codigo}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            {tipoFiltro === "PROFESSOR" &&
              dados.professores.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            {tipoFiltro === "ESPACO" &&
              dados.categorias.map((cat: any) => {
                const espacosDaCat = dados.espacos.filter(
                  (e: any) => String(e.categoria_id) === String(cat.id),
                );
                if (espacosDaCat.length === 0) return null;
                return (
                  <optgroup key={cat.id} label={cat.nome}>
                    {espacosDaCat.map((e: any) => (
                      <option key={e.id} value={e.id}>
                        {e.nome}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
          </select>

          <button
            onClick={() => window.print()}
            disabled={!idSelecionado || turnosOcupados.length === 0}
            className="bg-white text-green-800 px-4 py-2 rounded-lg font-black text-xs shadow hover:bg-green-50 disabled:opacity-30 h-9"
          >
            🖨️ IMPRIMIR
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 relative min-h-[300px]">
        {carregando && idSelecionado && (
          <div className="absolute inset-0 z-10 bg-white/50 backdrop-blur-sm flex items-center justify-center rounded-xl">
            <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {!idSelecionado ? (
          <div className="h-[40vh] flex flex-col items-center justify-center text-gray-300 border-4 border-dashed border-gray-100 rounded-3xl">
            <span className="text-6xl mb-2">👁️</span>
            <p className="text-sm font-black text-gray-400 text-center">
              Selecione uma opção nos filtros acima para inspecionar a grade de
              horários.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-center pb-2 border-b border-gray-100">
              <h2 className="text-2xl font-black text-gray-800 uppercase">
                {obterTituloGrade()}
              </h2>
              {infoVersao && (
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                  Versão em Exibição: {infoVersao.nome} ({infoVersao.status}) •
                  Vigência: {formatarData(infoVersao.data_inicio_vigencia)}
                </p>
              )}
            </div>

            {turnosOcupados.length === 0 ? (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center text-gray-500">
                <span className="text-4xl block mb-2">📭</span>
                <p className="text-base font-bold text-gray-700">
                  Nenhum horário cadastrado
                </p>
                <p className="text-xs mt-1">
                  Não foram encontradas aulas registradas para esta seleção
                  nesta versão da grade.
                </p>
              </div>
            ) : (
              turnosOcupados.map((turno, tIdx) => (
                <div
                  key={turno.nome}
                  className="overflow-hidden bg-white border border-gray-200 rounded-lg"
                >
                  <div className="bg-gray-50 p-2 text-center border-b border-gray-200">
                    <h3 className="text-xs font-black uppercase text-gray-500 tracking-widest">
                      {turno.nome}
                    </h3>
                  </div>
                  <table className="w-full border-collapse table-fixed">
                    <thead>
                      <tr className="bg-gray-50/50 border-b border-gray-200 text-[10px] font-black uppercase text-gray-400">
                        <th className="p-2 w-24 border-r border-gray-200 text-center">
                          Horário
                        </th>
                        {diasSemana.map((dia) => (
                          <th
                            key={dia.id}
                            className="p-2 border-r border-gray-200 text-center"
                          >
                            {dia.nome}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {turno.slots.map((slot: any) => {
                        const linhaTemChoque = diasSemana.some(
                          (dia) => getAulasPublico(dia.id, slot.id).length > 1,
                        );
                        return (
                          <tr
                            key={slot.id}
                            className={linhaTemChoque ? "h-24" : "h-16"}
                          >
                            <td className="p-1 border-r border-gray-200 text-center bg-gray-50/30 align-middle">
                              <div className="font-black text-gray-700 text-xs">
                                {formatarHora(slot.hora_inicio)}
                              </div>
                              <div className="text-[9px] text-gray-400">
                                {formatarHora(slot.hora_fim)}
                              </div>
                            </td>
                            {diasSemana.map((dia) => {
                              const aulasNoSlot = getAulasPublico(
                                dia.id,
                                slot.id,
                              );
                              if (aulasNoSlot.length === 0)
                                return (
                                  <td
                                    key={dia.id}
                                    className="border-r border-gray-100"
                                  ></td>
                                );
                              const isSplit = aulasNoSlot.length > 1;
                              return (
                                <td
                                  key={dia.id}
                                  className={`p-1 border-r border-gray-100 ${linhaTemChoque && !isSplit ? "align-middle" : "align-top"}`}
                                >
                                  <div className="flex flex-col w-full gap-1 h-full">
                                    {aulasNoSlot.map((aula: any) => {
                                      const disc = dados.disciplinas.find(
                                        (d: any) => d.id === aula.disciplina_id,
                                      );
                                      const prof = dados.professores.find(
                                        (p: any) => p.id === aula.professor_id,
                                      );
                                      const sala = dados.espacos.find(
                                        (e: any) => e.id === aula.espaco_id,
                                      );
                                      const turma = dados.turmas.find(
                                        (t: any) => t.id === aula.turma_id,
                                      );
                                      return (
                                        <div
                                          key={aula.id}
                                          className={`w-full rounded p-1 border border-black/5 flex flex-col justify-center min-h-0 bg-gray-50/50`}
                                        >
                                          <div className="font-black text-[11px] leading-tight text-gray-900 uppercase truncate">
                                            {disc?.nome}
                                          </div>
                                          <div className="flex flex-col text-[9px] text-gray-500 font-bold uppercase truncate">
                                            {tipoFiltro !== "PROFESSOR" && (
                                              <div>
                                                👤 {prof?.nome || "A definir"}
                                              </div>
                                            )}
                                            {tipoFiltro !== "TURMA" && (
                                              <div>👥 {turma?.codigo}</div>
                                            )}
                                            {tipoFiltro !== "ESPACO" && (
                                              <div>
                                                📍 {sala?.nome || "S/S"}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
