"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function HomePage() {
  const [carregando, setCarregando] = useState(true);
  const [logado, setLogado] = useState(false);

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

  useEffect(() => {
    async function carregarVersoes() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const isLogado = !!session;
      setLogado(isLogado);

      const { data } = await supabase
        .from("versoes_grade")
        .select("*")
        .order("data_inicio_vigencia", { ascending: false });

      if (data && data.length > 0) {
        const versoesFiltradas = isLogado
          ? data
          : data.filter((v) => v.status !== "RASCUNHO");
        setVersoes(versoesFiltradas);

        const hoje = new Date().toISOString().split("T")[0];
        const ativa =
          versoesFiltradas.find(
            (v) => v.status === "PUBLICADA" && v.data_inicio_vigencia <= hoje,
          ) || versoesFiltradas[0];
        if (ativa) setVersaoSelecionada(ativa.id);
      } else {
        setCarregando(false);
      }
    }
    carregarVersoes();
  }, []);

  useEffect(() => {
    if (!versaoSelecionada) return;
    async function carregarTudo() {
      setCarregando(true);
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
          turmas,
          cursos,
          professores,
          disciplinas,
          espacos,
          categorias,
          slots,
        });
      } catch (error) {
        console.error(error);
      } finally {
        setCarregando(false);
      }
    }
    carregarTudo();
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

  // --- NOVA LÓGICA DE TURNOS ---
  // 1. Pegar todas as aulas do filtro selecionado
  const aulasDoFiltro = dados.aulas.filter((a: any) => {
    if (tipoFiltro === "TURMA")
      return String(a.turma_id) === String(idSelecionado);
    if (tipoFiltro === "PROFESSOR")
      return String(a.professor_id) === String(idSelecionado);
    return String(a.espaco_id) === String(idSelecionado);
  });

  // 2. Mapear os IDs dos slots ocupados por essas aulas
  const slotsOcupadosIds = new Set(
    aulasDoFiltro.map((a: any) => String(a.slot_horario_id)),
  );

  // 3. Estruturar os turnos
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

  // 4. Filtrar para manter apenas os turnos que possuem pelo menos um slot ocupado
  const turnosOcupados = todosTurnos.filter((turno) =>
    turno.slots.some((slot: any) => slotsOcupadosIds.has(String(slot.id))),
  );

  if (carregando && !versaoSelecionada) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-10">
      <header className="bg-green-800 text-white p-6 shadow-md print:hidden">
        <div className="max-w-7xl mx-auto flex flex-col xl:flex-row justify-between items-center gap-6">
          {/* LADO ESQUERDO DO HEADER */}
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl font-black italic tracking-tighter">
                SGH{" "}
                <span className="font-light not-italic text-green-200">
                  | IFNMG
                </span>
              </h1>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-1">
                <p className="text-sm font-medium text-green-100 uppercase tracking-widest">
                  Portal de Horários
                </p>

                {versoes.length > 0 && (
                  <select
                    value={versaoSelecionada}
                    onChange={(e) => {
                      setVersaoSelecionada(e.target.value);
                      setIdSelecionado("");
                    }}
                    className="bg-green-900 text-green-100 text-[11px] font-bold uppercase rounded border border-green-700 px-2 py-1 outline-none cursor-pointer hover:bg-green-700 transition-colors"
                  >
                    {versoes.map((v, idx) => {
                      const hoje = new Date().toISOString().split("T")[0];
                      let sufixo = "";

                      if (v.status === "RASCUNHO") {
                        sufixo = "(Rascunho)";
                      } else if (v.status === "PUBLICADA") {
                        if (v.data_inicio_vigencia > hoje) {
                          sufixo = "(Prévia)";
                        } else {
                          const atual = versoes.find(
                            (ver) =>
                              ver.status === "PUBLICADA" &&
                              ver.data_inicio_vigencia <= hoje,
                          );
                          sufixo =
                            atual && atual.id === v.id
                              ? "(Atual)"
                              : "(Arquivada)";
                        }
                      }

                      return (
                        <option
                          key={`versao-${v.id || idx}`}
                          value={v.id}
                          className="bg-white text-gray-800"
                        >
                          {v.nome} - {v.semestre} {sufixo}
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* LADO DIREITO DO HEADER (AÇÕES E NAVEGAÇÃO) */}
          <div className="flex flex-wrap xl:flex-nowrap items-center justify-center gap-4 bg-green-900/40 p-4 rounded-xl border border-green-700/50 w-full xl:w-auto">
            {/* BOTÃO ROTA DE RESERVAS */}
            <Link
              href="/reservas"
              className="bg-yellow-400 text-green-950 px-5 py-2.5 rounded-lg font-black text-sm shadow-md hover:bg-yellow-300 hover:shadow-lg hover:-translate-y-0.5 transition-all active:scale-95 flex items-center gap-2 border border-yellow-500 whitespace-nowrap"
            >
              <span>📆</span> Reservar Espaço
            </Link>

            {/* SEPARADOR VISUAL */}
            <div className="hidden xl:block w-px h-8 bg-green-700/50 mx-2"></div>

            {/* FILTROS E BUSCA */}
            <div className="flex bg-green-950 rounded-lg p-1">
              {(["TURMA", "PROFESSOR", "ESPACO"] as const).map((t) => (
                <button
                  key={`btn-filtro-${t}`}
                  onClick={() => {
                    setTipoFiltro(t);
                    setIdSelecionado("");
                  }}
                  className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${tipoFiltro === t ? "bg-green-600 text-white shadow-sm" : "text-green-400 hover:text-white"}`}
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
              className="bg-white text-gray-800 rounded-lg p-2 text-sm font-bold outline-none border-none w-full sm:w-[250px] shadow-inner truncate h-10"
            >
              <option value="">Escolha...</option>
              {tipoFiltro === "TURMA" &&
                dados.cursos.map((curso: any, cIdx: number) => {
                  const turmasDoCurso = dados.turmas.filter(
                    (t: any) => String(t.curso_id) === String(curso.id),
                  );
                  if (turmasDoCurso.length === 0) return null;
                  return (
                    <optgroup
                      key={`curso-${curso.id || cIdx}`}
                      label={curso.nome}
                    >
                      {turmasDoCurso.map((t: any, tIdx: number) => (
                        <option key={`turma-${t.id || tIdx}`} value={t.id}>
                          {t.codigo}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              {tipoFiltro === "PROFESSOR" &&
                dados.professores.map((p: any, pIdx: number) => (
                  <option key={`prof-${p.id || pIdx}`} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              {tipoFiltro === "ESPACO" &&
                dados.categorias.map((cat: any, catIdx: number) => {
                  const espacosDaCat = dados.espacos.filter(
                    (e: any) => String(e.categoria_id) === String(cat.id),
                  );
                  if (espacosDaCat.length === 0) return null;
                  return (
                    <optgroup key={`cat-${cat.id || catIdx}`} label={cat.nome}>
                      {espacosDaCat.map((e: any, eIdx: number) => (
                        <option key={`espaco-${e.id || eIdx}`} value={e.id}>
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
              className="bg-white text-green-800 px-4 py-2 rounded-lg font-black text-xs shadow hover:bg-green-50 transition-all active:scale-95 disabled:opacity-30 h-10"
              title="Gerar PDF / Imprimir"
            >
              🖨️ IMPRIMIR
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto mt-6 p-2 relative">
        {carregando && idSelecionado && (
          <div className="absolute inset-0 z-10 bg-white/50 backdrop-blur-sm flex items-center justify-center rounded-xl">
            <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        {!idSelecionado ? (
          <div className="h-[60vh] flex flex-col items-center justify-center text-gray-300 border-4 border-dashed border-gray-100 rounded-3xl">
            <span className="text-8xl mb-4">📅</span>
            <p className="text-xl font-black text-gray-400 text-center px-4">
              Selecione uma opção acima para visualizar o horário.
            </p>
          </div>
        ) : (
          <div className="space-y-6 print:space-y-0">
            <div className="text-center py-4 print:py-0 print:mb-4">
              <h2 className="text-3xl font-black text-gray-800 uppercase print:text-xl">
                {obterTituloGrade()}
              </h2>
              {infoVersao && (
                <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mt-1">
                  Vigência: A partir de{" "}
                  {formatarData(infoVersao.data_inicio_vigencia)}
                  {infoVersao.status === "RASCUNHO" && (
                    <span className="text-yellow-600 ml-2">
                      (Modo Rascunho)
                    </span>
                  )}
                </p>
              )}
            </div>

            {/* MENSAGEM SE NÃO HOUVER AULAS */}
            {turnosOcupados.length === 0 ? (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center text-gray-500 my-8">
                <span className="text-5xl block mb-4">📭</span>
                <p className="text-lg font-bold text-gray-700">
                  Nenhum horário cadastrado
                </p>
                <p className="text-sm mt-1">
                  Não foram encontradas aulas para esta seleção na versão atual
                  da grade.
                </p>
              </div>
            ) : (
              /* RENDERIZA APENAS OS TURNOS OCUPADOS */
              turnosOcupados.map((turno, tIdx) => (
                <div
                  key={`turno-${turno.nome}-${tIdx}`}
                  className={`overflow-hidden bg-white border border-gray-200 rounded-lg print:border-gray-300 print:rounded-none print:mb-0 ${tIdx > 0 ? "print:break-before-page" : ""}`}
                >
                  <div className="bg-gray-100 p-2 text-center border-b border-gray-200 print:bg-gray-50">
                    <h3 className="text-sm font-black uppercase text-gray-600 tracking-widest">
                      {turno.nome}
                    </h3>
                  </div>
                  <table className="w-full border-collapse table-fixed">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-black uppercase text-gray-500">
                        <th className="p-2 w-24 border-r border-gray-200 text-center">
                          Horário
                        </th>
                        {diasSemana.map((dia) => (
                          <th
                            key={`th-${dia.id}`}
                            className="p-2 border-r border-gray-200 text-center"
                          >
                            {dia.nome}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {turno.slots.map((slot: any, sIdx: number) => {
                        const linhaTemChoque = diasSemana.some(
                          (dia) => getAulasPublico(dia.id, slot.id).length > 1,
                        );

                        return (
                          <tr
                            key={`slot-${slot.id || sIdx}`}
                            className={`${linhaTemChoque ? "h-24 print:h-20" : "h-16 print:h-14"}`}
                          >
                            <td className="p-1 border-r border-gray-200 text-center bg-gray-50/50 align-middle">
                              <div className="font-black text-gray-700 text-sm">
                                {formatarHora(slot.hora_inicio)}
                              </div>
                              <div className="text-[10px] text-gray-400">
                                {formatarHora(slot.hora_fim)}
                              </div>
                            </td>

                            {diasSemana.map((dia) => {
                              const aulasNoSlot = getAulasPublico(
                                dia.id,
                                slot.id,
                              );

                              if (aulasNoSlot.length === 0) {
                                return (
                                  <td
                                    key={`td-${dia.id}-vazio`}
                                    className="border-r border-gray-100 print:border-gray-300"
                                  ></td>
                                );
                              }

                              const isSplit = aulasNoSlot.length > 1;
                              const isSingleInTallRow =
                                linhaTemChoque && !isSplit;

                              return (
                                <td
                                  key={`td-${dia.id}`}
                                  className={`p-1 border-r border-gray-100 print:border-gray-300 ${isSingleInTallRow ? "align-middle" : "align-top"}`}
                                >
                                  <div
                                    className={`flex flex-col w-full gap-1 ${isSplit ? "h-full" : ""}`}
                                  >
                                    {aulasNoSlot.map(
                                      (aula: any, aIdx: number) => {
                                        const disc = dados.disciplinas.find(
                                          (d: any) =>
                                            d.id === aula.disciplina_id,
                                        );
                                        const prof = dados.professores.find(
                                          (p: any) =>
                                            p.id === aula.professor_id,
                                        );
                                        const sala = dados.espacos.find(
                                          (e: any) => e.id === aula.espaco_id,
                                        );
                                        const turma = dados.turmas.find(
                                          (t: any) => t.id === aula.turma_id,
                                        );

                                        return (
                                          <div
                                            key={`aula-${aula.id || aIdx}-${aIdx}`}
                                            className={`w-full rounded flex flex-col justify-center border border-black/5 print:border-gray-300 min-h-0
                                                ${isSplit ? "flex-1 p-1 bg-gray-50" : isSingleInTallRow ? "px-1.5 py-2 bg-gray-200/50" : "p-1.5 bg-gray-50"}
                                              `}
                                          >
                                            <div
                                              className={`font-black leading-tight text-gray-900 mb-0.5 uppercase truncate ${isSplit ? "text-[10px] print:text-[10px]" : "text-xs print:text-[12px]"}`}
                                            >
                                              {disc?.nome}
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                              {tipoFiltro !== "PROFESSOR" && (
                                                <div
                                                  className={`font-bold text-gray-700/90 truncate uppercase ${isSplit ? "text-[8px] print:text-[8px]" : "text-[9px] print:text-[10px]"}`}
                                                >
                                                  👤 {prof?.nome || "A definir"}
                                                </div>
                                              )}
                                              {tipoFiltro !== "TURMA" && (
                                                <div
                                                  className={`font-bold text-gray-700/90 uppercase ${isSplit ? "text-[8px] print:text-[8px]" : "text-[9px] print:text-[10px]"}`}
                                                >
                                                  👥 {turma?.codigo}
                                                </div>
                                              )}
                                              {tipoFiltro !== "ESPACO" && (
                                                <div
                                                  className={`font-bold text-gray-700/90 truncate uppercase ${isSplit ? "text-[8px] print:text-[8px]" : "text-[9px] print:text-[10px]"}`}
                                                >
                                                  📍 {sala?.nome || "S/S"}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      },
                                    )}
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
      </main>

      <footer className="max-w-7xl mx-auto p-8 text-center print:hidden border-t border-gray-100 mt-12">
        <div className="flex flex-col items-center gap-4">
          <div className="text-gray-400 text-xs leading-relaxed max-w-md">
            Para gerar um PDF, selecione o filtro desejado e utilize a função de
            impressão do navegador.
          </div>
          <Link
            href={logado ? "/painel" : "/login"}
            className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all text-xs font-bold group ${logado ? "bg-green-600 text-white border-green-500 hover:bg-green-700" : "border-gray-200 text-gray-400 hover:text-green-700 hover:border-green-200 hover:bg-green-50"}`}
          >
            <span
              className={logado ? "" : "opacity-60 group-hover:opacity-100"}
            >
              {logado ? "⬅" : "🔒"}
            </span>
            {logado ? "Voltar ao Painel de Gestão" : "Acesso Restrito à Gestão"}
          </Link>
        </div>
      </footer>
    </div>
  );
}
