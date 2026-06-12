"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import jsPDF from "jspdf";
import html2canvas from "html2canvas-pro";

export default function VisualizarHorariosAdminPage() {
  const [carregando, setCarregando] = useState(true);
  const [gerandoPDF, setGerandoPDF] = useState(false);

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

  const relatorioRef = useRef<HTMLDivElement>(null);

  const diasSemana = [
    { id: "SEGUNDA", nome: "SEGUNDA" },
    { id: "TERCA", nome: "TERÇA" },
    { id: "QUARTA", nome: "QUARTA" },
    { id: "QUINTA", nome: "QUINTA" },
    { id: "SEXTA", nome: "SEXTA" },
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

    const canal = supabase
      .channel(`realtime-aulas-${versaoSelecionada}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "aulas" },
        (payload) => {
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
      .subscribe();

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
      return `TURMA: ${dados.turmas.find((t: any) => t.id === idSelecionado)?.codigo}`;
    if (tipoFiltro === "PROFESSOR")
      return `PROFESSOR(A): ${dados.professores.find((p: any) => p.id === idSelecionado)?.nome}`;
    if (tipoFiltro === "ESPACO")
      return `ESPAÇO: ${dados.espacos.find((e: any) => e.id === idSelecionado)?.nome}`;
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
      nome: "MANHÃ",
      slots: dados.slots.filter((s: any) => s.hora_inicio < "12:00"),
    },
    {
      nome: "TARDE",
      slots: dados.slots.filter(
        (s: any) => s.hora_inicio >= "12:00" && s.hora_inicio < "18:00",
      ),
    },
    {
      nome: "NOITE",
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

  // ========================================================================
  // MOTOR DE EXPORTAÇÃO PDF - PÁGINA ÚNICA E COMPACTO
  // ========================================================================
  const gerarPDF = async () => {
    if (!relatorioRef.current) return;
    setGerandoPDF(true);

    try {
      const elemento = relatorioRef.current;

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
        compress: true,
      });

      const margin = 10;
      const maxPdfWidth = pdf.internal.pageSize.getWidth() - margin * 2;
      const maxPdfHeight = pdf.internal.pageSize.getHeight() - margin * 2;

      // QUALIDADE AUMENTADA (scale: 3)
      const canvas = await html2canvas(elemento, {
        scale: 3,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      // COMPRESSÃO MELHORADA (0.95)
      const imgData = canvas.toDataURL("image/jpeg", 0.95);

      const imgRatio = canvas.height / canvas.width;
      let imgWidth = maxPdfWidth;
      let imgHeight = imgWidth * imgRatio;

      if (imgHeight > maxPdfHeight) {
        imgHeight = maxPdfHeight;
        imgWidth = imgHeight / imgRatio;
      }

      const xOffset = margin + (maxPdfWidth - imgWidth) / 2;
      const yOffset = margin;

      pdf.addImage(
        imgData,
        "JPEG",
        xOffset,
        yOffset,
        imgWidth,
        imgHeight,
        undefined,
        "FAST",
      );

      const tituloSeguro =
        obterTituloGrade()
          .replace(/[^a-zA-Z0-9]/g, "_")
          .replace(/_+/g, "_")
          .toLowerCase() || "horarios";
      pdf.save(`IFNMG_${tituloSeguro}_Inspeção.pdf`);
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      alert("Ocorreu um erro ao exportar o PDF. Tente novamente.");
    } finally {
      setGerandoPDF(false);
    }
  };

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
            onClick={gerarPDF}
            disabled={
              !idSelecionado || turnosOcupados.length === 0 || gerandoPDF
            }
            className="bg-white text-green-800 px-4 py-2 rounded-lg font-black text-xs shadow hover:bg-green-50 disabled:opacity-30 h-9 flex items-center justify-center min-w-[130px]"
          >
            {gerandoPDF ? (
              <span className="flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-green-800 border-t-transparent rounded-full animate-spin"></div>
                GERANDO...
              </span>
            ) : (
              "🖨️ IMPRIMIR PDF"
            )}
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
          <div ref={relatorioRef} className="bg-white p-4">
            <div className="text-center py-4 bg-white border-b border-gray-400 mb-4">
              <h2 className="text-2xl font-black text-black uppercase tracking-wide">
                IFNMG - Campus Januária | Quadro de Horário
              </h2>
              <h3 className="text-xl font-bold text-black uppercase mt-1">
                {obterTituloGrade()}
              </h3>
              {infoVersao && (
                <p className="text-xs font-bold text-gray-600 uppercase tracking-widest mt-1">
                  Vigência: A partir de{" "}
                  {formatarData(infoVersao.data_inicio_vigencia)}
                  {infoVersao.status === "RASCUNHO" && (
                    <span className="text-red-600 ml-2">
                      (NÃO OFICIAL - RASCUNHO)
                    </span>
                  )}
                </p>
              )}
            </div>

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
              <div className="space-y-6">
                {turnosOcupados.map((turno, tIdx) => (
                  <div
                    key={`turno-${turno.nome}-${tIdx}`}
                    className="bg-white box-border"
                  >
                    <div className="text-center mb-1 border-b border-gray-400 pb-1">
                      <h3 className="font-black text-sm tracking-wide text-black uppercase mt-0.5">
                        TURNO: {turno.nome}
                      </h3>
                    </div>

                    <table className="w-full border-collapse border border-black table-fixed text-black bg-white">
                      <thead>
                        <tr className="bg-gray-200 font-bold h-5">
                          <th className="border border-black py-0 px-1 w-[8%] text-[10px] text-center leading-none uppercase">
                            HORÁRIO
                          </th>
                          {diasSemana.map((dia) => (
                            <th
                              key={`th-${dia.id}`}
                              className="border border-black py-0 px-1 w-[18.4%] text-[10px] text-center leading-none uppercase"
                            >
                              {dia.nome}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {turno.slots.map((slot: any) => {
                          const linhaTemChoque = diasSemana.some(
                            (dia) =>
                              getAulasPublico(dia.id, slot.id).length > 1,
                          );

                          return (
                            <tr key={`slot-${slot.id}`} className="h-auto">
                              <td className="border border-black p-0.5 text-center font-bold bg-gray-100 align-middle text-black text-[10px] leading-tight">
                                {formatarHora(slot.hora_inicio)}
                                <br />
                                {formatarHora(slot.hora_fim)}
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
                                      className="border border-black p-0.5 bg-white"
                                    ></td>
                                  );
                                }

                                const isSplit = aulasNoSlot.length > 1;
                                const isSingleInTallRow =
                                  linhaTemChoque && !isSplit;

                                return (
                                  <td
                                    key={`td-${dia.id}`}
                                    className={`border border-black p-0.5 bg-white ${isSingleInTallRow ? "align-middle" : "align-top"}`}
                                  >
                                    <div className="flex flex-col w-full h-full justify-center items-center text-center gap-0.5">
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
                                              key={`aula-${aula.id}-${aIdx}`}
                                              className={`flex flex-col justify-center items-center w-full ${isSplit && aIdx > 0 ? "border-t border-dashed border-gray-400 pt-0.5 mt-0.5" : ""}`}
                                            >
                                              <span
                                                className="font-bold text-[11px] leading-[1.1] uppercase text-black"
                                                title={disc?.nome}
                                              >
                                                {disc?.nome}
                                              </span>

                                              {tipoFiltro !== "TURMA" && (
                                                <span
                                                  className="text-[10px] text-gray-800 font-medium leading-[1.1] uppercase"
                                                  title={turma?.codigo}
                                                >
                                                  {turma?.codigo}
                                                </span>
                                              )}

                                              {tipoFiltro !== "PROFESSOR" && (
                                                <span
                                                  className="text-[10px] text-gray-800 font-medium leading-[1.1] uppercase"
                                                  title={prof?.nome}
                                                >
                                                  {prof?.nome || "A DEFINIR"}
                                                </span>
                                              )}

                                              {tipoFiltro !== "ESPACO" && (
                                                <span
                                                  className="text-[10px] text-gray-600 leading-[1.1] uppercase"
                                                  title={sala?.nome}
                                                >
                                                  {sala?.nome || "S/S"}
                                                </span>
                                              )}
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
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
