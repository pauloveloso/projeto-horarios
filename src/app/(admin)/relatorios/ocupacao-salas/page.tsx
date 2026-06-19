"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import jsPDF from "jspdf";
import html2canvas from "html2canvas-pro";

export default function RelatorioOcupacaoSalasPage() {
  const [carregando, setCarregando] = useState(true);
  const [gerandoPDF, setGerandoPDF] = useState(false);

  const [versoes, setVersoes] = useState<any[]>([]);
  const [versaoSelecionada, setVersaoSelecionada] = useState<string>("");
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string>("");

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
        const rascunho = data.find((v) => v.status === "RASCUNHO");
        if (rascunho) setVersaoSelecionada(rascunho.id);
        else setVersaoSelecionada(data[0].id);
      } else {
        setCarregando(false);
      }
    }
    carregarVersoes();
  }, []);

  // 2. BUSCA OS DADOS DA ESTRUTURA E AS AULAS DA VERSÃO
  useEffect(() => {
    if (!versaoSelecionada) return;

    let montado = true;
    setCarregando(true);

    const carregarDados = async () => {
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

        if (montado) {
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
        }
      } catch (error) {
        console.error("Erro ao carregar dados do relatório:", error);
      } finally {
        if (montado) setCarregando(false);
      }
    };

    carregarDados();

    return () => {
      montado = false;
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

  const getAulasNoEspaco = (
    espacoId: string,
    diaId: string,
    slotId: string,
  ) => {
    return dados.aulas.filter(
      (a: any) =>
        String(a.espaco_id) === String(espacoId) &&
        a.dia_semana === diaId &&
        String(a.slot_horario_id) === String(slotId),
    );
  };

  const espacosFiltrados = dados.espacos.filter(
    (e: any) => String(e.categoria_id) === String(categoriaSelecionada),
  );

  const infoVersao = versoes.find(
    (v) => String(v.id) === String(versaoSelecionada),
  );
  const infoCategoria = dados.categorias.find(
    (c: any) => String(c.id) === String(categoriaSelecionada),
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

  // ========================================================================
  // MOTOR DE EXPORTAÇÃO PDF - 1 SALA POR PÁGINA (Prevenção de Limite de Memória)
  // ========================================================================
  const gerarPDF = async () => {
    setGerandoPDF(true);

    try {
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
        compress: true,
      });

      const marginX = 10;
      const marginY = 10;
      const maxPdfWidth = pdf.internal.pageSize.getWidth() - marginX * 2;
      const maxPdfHeight = pdf.internal.pageSize.getHeight() - marginY * 2;

      // Elementos do DOM a capturar
      const cabecalhoEl = document.getElementById("cabecalho-relatorio");
      const salasEls = document.querySelectorAll(".sala-print-container");

      if (!cabecalhoEl || salasEls.length === 0) {
        alert("Não há dados na tela para gerar o PDF.");
        setGerandoPDF(false);
        return;
      }

      // 1. CAPTURA O CABEÇALHO (Apenas 1 vez)
      const canvasCabecalho = await html2canvas(cabecalhoEl, {
        scale: 3,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });
      const imgCabecalho = canvasCabecalho.toDataURL("image/jpeg", 0.95);
      const ratioCabecalho = canvasCabecalho.height / canvasCabecalho.width;
      const cabecalhoW = maxPdfWidth;
      const cabecalhoH = cabecalhoW * ratioCabecalho;

      // 2. CAPTURA CADA SALA E ADICIONA NUMA PÁGINA NOVA
      for (let i = 0; i < salasEls.length; i++) {
        if (i > 0) pdf.addPage();

        // Cola o cabeçalho no topo da página atual
        pdf.addImage(
          imgCabecalho,
          "JPEG",
          marginX,
          marginY,
          cabecalhoW,
          cabecalhoH,
          undefined,
          "FAST",
        );

        const salaEl = salasEls[i] as HTMLElement;

        // Capta apenas a sala atual (impede o erro de Canvas gigante)
        const canvasSala = await html2canvas(salaEl, {
          scale: 3,
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff",
        });
        const imgSala = canvasSala.toDataURL("image/jpeg", 0.95);

        const ratioSala = canvasSala.height / canvasSala.width;
        let salaW = maxPdfWidth;
        let salaH = salaW * ratioSala;

        // Calcula o espaço que sobrou debaixo do cabeçalho
        const espacoDisponivelH = maxPdfHeight - cabecalhoH - 5;

        // Se a sala for maior que o papel, escala para baixo mantendo proporção
        if (salaH > espacoDisponivelH) {
          salaH = espacoDisponivelH;
          salaW = salaH / ratioSala;
        }

        const xOffset = marginX + (maxPdfWidth - salaW) / 2; // Centraliza a sala no meio da folha
        const yOffset = marginY + cabecalhoH + 5; // Cola 5mm abaixo do cabeçalho

        pdf.addImage(
          imgSala,
          "JPEG",
          xOffset,
          yOffset,
          salaW,
          salaH,
          undefined,
          "FAST",
        );
      }

      const tituloSeguro =
        infoCategoria?.nome
          .replace(/[^a-zA-Z0-9]/g, "_")
          .replace(/_+/g, "_")
          .toLowerCase() || "ocupacao";

      pdf.save(`IFNMG_Salas_${tituloSeguro}.pdf`);
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
      {/* BARRA DE FILTROS SUPERIOR */}
      <div className="bg-green-900 p-4 shadow-sm rounded-xl text-white flex flex-col lg:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-base font-black uppercase tracking-tight text-white">
            Consolidado de Ocupação de Espaços
          </h1>
          <p className="text-[10px] text-green-200 font-medium uppercase tracking-wider">
            Relatório de Infraestrutura por Categoria
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 justify-end w-full lg:w-auto">
          {versoes.length > 0 && (
            <select
              value={versaoSelecionada}
              onChange={(e) => setVersaoSelecionada(e.target.value)}
              className="bg-green-800 border border-green-700 text-white rounded p-2 text-xs font-bold outline-none cursor-pointer hover:bg-green-700 max-w-[200px]"
            >
              {versoes.map((v) => (
                <option key={v.id} value={v.id} className="text-gray-800">
                  {v.nome} ({v.status})
                </option>
              ))}
            </select>
          )}

          <select
            value={categoriaSelecionada}
            onChange={(e) => setCategoriaSelecionada(e.target.value)}
            className="bg-white text-gray-800 rounded-lg p-2 text-xs font-bold outline-none w-full sm:w-[250px] truncate h-9 cursor-pointer"
          >
            <option value="">Selecione uma Categoria...</option>
            {dados.categorias.map((cat: any) => (
              <option key={cat.id} value={cat.id}>
                {cat.nome}
              </option>
            ))}
          </select>

          <button
            onClick={gerarPDF}
            disabled={
              !categoriaSelecionada ||
              espacosFiltrados.length === 0 ||
              gerandoPDF
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
        {carregando && categoriaSelecionada && (
          <div className="absolute inset-0 z-10 bg-white/50 backdrop-blur-sm flex items-center justify-center rounded-xl">
            <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {!categoriaSelecionada ? (
          <div className="h-[40vh] flex flex-col items-center justify-center text-gray-300 border-4 border-dashed border-gray-100 rounded-3xl">
            <span className="text-6xl mb-2">🏢</span>
            <p className="text-sm font-black text-gray-400 text-center">
              Selecione uma Categoria de Espaço acima para gerar o relatório
              consolidado.
            </p>
          </div>
        ) : espacosFiltrados.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center text-gray-500 my-8">
            <span className="text-5xl block mb-4">📭</span>
            <p className="text-lg font-bold text-gray-700">
              Nenhum espaço cadastrado
            </p>
            <p className="text-sm mt-1">
              Não existem salas vinculadas a esta categoria.
            </p>
          </div>
        ) : (
          <div className="bg-white p-4">
            {/* CABEÇALHO DO RELATÓRIO (Isolado com ID para o PDF) */}
            <div
              id="cabecalho-relatorio"
              className="text-center py-4 bg-white border-b border-gray-400 mb-8"
            >
              <h2 className="text-2xl font-black text-black uppercase tracking-wide">
                IFNMG - Campus Januária | Ocupação de Espaços
              </h2>
              <h3 className="text-xl font-bold text-black uppercase mt-1">
                CATEGORIA: {infoCategoria?.nome}
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

            {/* LISTAGEM DE SALAS (Cada uma vira uma página) */}
            <div className="space-y-12">
              {espacosFiltrados.map((espaco: any) => {
                const aulasDesteEspaco = dados.aulas.filter(
                  (a: any) => String(a.espaco_id) === String(espaco.id),
                );

                const slotsOcupadosIds = new Set(
                  aulasDesteEspaco.map((a: any) => String(a.slot_horario_id)),
                );

                // Mapeia os 3 turnos, forçando 4 horários padrão e testando ocupação a partir do 5º
                const turnosParaExibir = todosTurnos.map((turno) => ({
                  ...turno,
                  slots: turno.slots.filter((slot: any, index: number) => {
                    if (index < 4) return true;
                    return slotsOcupadosIds.has(String(slot.id));
                  }),
                }));

                return (
                  // A classe .sala-print-container é usada pelo algoritmo do PDF para separar as páginas
                  <div
                    key={espaco.id}
                    className="sala-print-container bg-white break-inside-avoid shadow-sm sm:shadow-none sm:border-0 border border-gray-200 p-2 sm:p-0 rounded"
                  >
                    <div className="bg-gray-200 border border-black border-b-0 p-2 text-center">
                      <h3 className="font-black text-sm tracking-widest text-black uppercase">
                        SALA: {espaco.nome}{" "}
                        {espaco.capacidade
                          ? `(Capacidade: ${espaco.capacidade} lugares)`
                          : ""}
                      </h3>
                    </div>

                    <div className="space-y-0">
                      {turnosParaExibir.map((turno, tIdx) => (
                        <div key={`turno-${turno.nome}-${tIdx}`}>
                          <div className="bg-gray-50 border border-black border-b-0 border-t-0 p-1 text-center">
                            <span className="font-bold text-[11px] tracking-wider text-gray-800 uppercase">
                              TURNO: {turno.nome}
                            </span>
                          </div>

                          <table className="w-full border-collapse border border-black table-fixed text-black bg-white">
                            <thead>
                              <tr className="bg-gray-100 font-bold h-5">
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
                              {turno.slots.map((slot: any) => (
                                <tr key={`slot-${slot.id}`} className="h-auto">
                                  <td className="border border-black p-0.5 text-center font-bold bg-gray-50 align-middle text-black text-[10px] leading-tight">
                                    {formatarHora(slot.hora_inicio)}
                                    <br />
                                    {formatarHora(slot.hora_fim)}
                                  </td>

                                  {diasSemana.map((dia) => {
                                    const aulasNoSlot = getAulasNoEspaco(
                                      espaco.id,
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

                                    return (
                                      <td
                                        key={`td-${dia.id}`}
                                        className="border border-black p-0.5 bg-white align-top"
                                      >
                                        <div className="flex flex-col w-full h-full justify-center items-center text-center gap-0.5">
                                          {aulasNoSlot.map(
                                            (aula: any, aIdx: number) => {
                                              const disc =
                                                dados.disciplinas.find(
                                                  (d: any) =>
                                                    d.id === aula.disciplina_id,
                                                );
                                              const prof =
                                                dados.professores.find(
                                                  (p: any) =>
                                                    p.id === aula.professor_id,
                                                );
                                              const turma = dados.turmas.find(
                                                (t: any) =>
                                                  t.id === aula.turma_id,
                                              );

                                              return (
                                                <div
                                                  key={`aula-${aula.id}-${aIdx}`}
                                                  className={`flex flex-col justify-center items-center w-full ${
                                                    isSplit && aIdx > 0
                                                      ? "border-t border-dashed border-gray-400 pt-0.5 mt-0.5"
                                                      : ""
                                                  }`}
                                                >
                                                  <span
                                                    className="font-bold text-[11px] leading-[1.1] uppercase text-black"
                                                    title={disc?.nome}
                                                  >
                                                    {disc?.nome}
                                                  </span>
                                                  <span
                                                    className="text-[10px] text-gray-800 font-medium leading-[1.1] uppercase"
                                                    title={turma?.codigo}
                                                  >
                                                    {turma?.codigo}
                                                  </span>
                                                  <span
                                                    className="text-[10px] text-gray-600 leading-[1.1] uppercase"
                                                    title={prof?.nome}
                                                  >
                                                    {prof?.nome || "A DEFINIR"}
                                                  </span>
                                                </div>
                                              );
                                            },
                                          )}
                                        </div>
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
