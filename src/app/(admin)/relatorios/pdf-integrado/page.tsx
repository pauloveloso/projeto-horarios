"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import jsPDF from "jspdf";
import html2canvas from "html2canvas-pro";

export default function ExportarPDFIntegradoPage() {
  const [carregando, setCarregando] = useState(true);
  const [gerandoPDF, setGerandoPDF] = useState(false);
  const [versoes, setVersoes] = useState<any[]>([]);
  const [versaoSelecionada, setVersaoSelecionada] = useState("");
  const [dados, setDados] = useState<any>(null);

  const relatorioRef = useRef<HTMLDivElement>(null);

  const dias = [
    { id: "SEGUNDA", label: "SEGUNDA" },
    { id: "TERCA", label: "TERÇA" },
    { id: "QUARTA", label: "QUARTA" },
    { id: "QUINTA", label: "QUINTA" },
    { id: "SEXTA", label: "SEXTA" },
  ];

  const horasPermitidas = [
    "07:30",
    "08:20",
    "09:25",
    "10:15",
    "13:30",
    "14:20",
    "15:25",
    "16:15",
  ];

  useEffect(() => {
    async function carregarVersoes() {
      const { data } = await supabase
        .from("versoes_grade")
        .select("*")
        .order("data_inicio_vigencia", { ascending: false });
      if (data && data.length > 0) {
        setVersoes(data);
        const ativa = data.find((v) => v.status === "PUBLICADA") || data[0];
        if (ativa) setVersaoSelecionada(ativa.id);
      } else {
        setCarregando(false);
      }
    }
    carregarVersoes();
  }, []);

  const carregarRelatorio = async () => {
    if (!versaoSelecionada) return;
    setCarregando(true);

    try {
      const [
        { data: aulas },
        { data: turmas },
        { data: cursos },
        { data: professores },
        { data: disciplinas },
        { data: espacos },
        { data: slots },
      ] = await Promise.all([
        supabase
          .from("aulas")
          .select("*")
          .eq("versao_id", versaoSelecionada)
          .limit(5000),
        supabase.from("turmas").select("*").order("codigo").limit(2000),
        supabase.from("cursos").select("*"),
        supabase.from("professores").select("*").limit(2000),
        supabase.from("disciplinas").select("*").limit(5000),
        supabase.from("espacos").select("*").limit(1000),
        supabase.from("slots_horarios").select("*").order("hora_inicio"),
      ]);

      const cursosIntegrados =
        cursos?.filter((c) => {
          const modalidade = (c.modalidade || "").toUpperCase();
          return modalidade === "INTEGRADO";
        }) || [];

      const slotsFiltrados =
        slots?.filter((s) =>
          horasPermitidas.includes(s.hora_inicio.substring(0, 5)),
        ) || [];

      const anos = ["1", "2", "3"];
      const gruposParaImpressao: any[] = [];

      cursosIntegrados.forEach((curso) => {
        anos.forEach((ano) => {
          const turmasDoGrupo =
            turmas?.filter((t) => {
              if (String(t.curso_id) !== String(curso.id)) return false;
              const codigo = (t.codigo || "").toUpperCase();
              return (
                codigo.includes(` ${ano}`) ||
                codigo.includes(`-${ano}`) ||
                codigo.includes(`${ano}º`)
              );
            }) || [];

          if (turmasDoGrupo.length > 0) {
            gruposParaImpressao.push({
              id: `${curso.id}-${ano}`,
              nomeGrupo: `${curso.nome} - ${ano}º Ano`,
              turmas: turmasDoGrupo,
            });
          }
        });
      });

      setDados({
        aulas: aulas || [],
        grupos: gruposParaImpressao,
        professores,
        disciplinas,
        espacos,
        slots: slotsFiltrados,
      });
    } catch (error) {
      console.error("Erro:", error);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarRelatorio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versaoSelecionada]);

  const getAulasNoSlot = (turmaId: string, diaId: string, slotId: string) => {
    return (
      dados?.aulas?.filter(
        (a: any) =>
          String(a.turma_id) === String(turmaId) &&
          a.dia_semana === diaId &&
          String(a.slot_horario_id) === String(slotId),
      ) || []
    );
  };

  const gerarPDF = async () => {
    if (!relatorioRef.current) return;
    setGerandoPDF(true);

    try {
      const elementosTurma =
        relatorioRef.current.querySelectorAll(".pdf-bloco-turma");

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
        compress: true,
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const usableHeight = pdfHeight - margin * 2;

      let currentY = margin;
      let isFirstPage = true;

      for (let i = 0; i < elementosTurma.length; i++) {
        const elemento = elementosTurma[i] as HTMLElement;

        const canvas = await html2canvas(elemento, {
          scale: 1.5,
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff",
        });

        const imgData = canvas.toDataURL("image/jpeg", 0.75);

        const imgWidth = pdfWidth - margin * 2;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        if (currentY + imgHeight <= usableHeight + margin) {
          if (!isFirstPage && currentY === margin) {
            // Primeira imagem da nova página
          }
        } else {
          if (!isFirstPage) {
            pdf.addPage();
            currentY = margin;
          }
        }

        pdf.addImage(
          imgData,
          "JPEG",
          margin,
          currentY,
          imgWidth,
          imgHeight,
          undefined,
          "FAST",
        );

        // Espaçamento pequeno entre as tabelas
        currentY += imgHeight + 4;
        isFirstPage = false;
      }

      pdf.save(`Horarios_Integrado_IFNMG.pdf`);
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      alert("Ocorreu um erro ao gerar o PDF. Tente novamente.");
    } finally {
      setGerandoPDF(false);
    }
  };

  if (carregando && !dados)
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-500 font-bold text-lg animate-pulse">
            Gerando Relatório Técnico Integrado...
          </p>
        </div>
      </div>
    );

  return (
    <div className="space-y-6 pb-20">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl font-black text-green-800">
            Relatório Integrado (Oficial)
          </h1>
          <p className="text-xs text-gray-500 font-bold uppercase mt-1">
            Exportação em Alta Resolução (PDF Dinâmico)
          </p>
        </div>
        <div className="flex flex-wrap gap-4 w-full md:w-auto">
          <select
            value={versaoSelecionada}
            onChange={(e) => setVersaoSelecionada(e.target.value)}
            disabled={gerandoPDF}
            className="border border-green-300 rounded p-2 text-sm font-bold bg-green-50 text-green-800 outline-none disabled:opacity-50"
          >
            {versoes.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nome} ({v.semestre})
              </option>
            ))}
          </select>
          <button
            onClick={gerarPDF}
            disabled={gerandoPDF || !dados || dados.grupos.length === 0}
            className="bg-green-600 text-white px-6 py-2 rounded font-black text-sm shadow hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[160px] transition-all"
          >
            {gerandoPDF ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Processando...
              </span>
            ) : (
              "📄 BAIXAR PDF"
            )}
          </button>
        </div>
      </div>

      <div className="bg-white p-2 rounded shadow-sm border border-gray-100 overflow-x-auto overflow-y-hidden">
        <div ref={relatorioRef} className="w-full min-w-[900px] bg-white p-4">
          {dados?.grupos.map((grupo: any) => (
            <div key={grupo.id} className="mb-0">
              {grupo.turmas.map((turma: any) => (
                <div
                  key={turma.id}
                  className="pdf-bloco-turma mb-4 bg-white box-border"
                >
                  {/* CABEÇALHO COMPACTO NO PADRÃO SUPERIOR */}
                  <div className="text-center mb-1 flex flex-col gap-0 text-gray-900 border-b border-gray-400 pb-1">
                    <h2 className="font-bold text-xs uppercase leading-tight text-black">
                      IFNMG - Campus Januária | Quadro de Horário:{" "}
                      {grupo.nomeGrupo}
                    </h2>
                    <h3 className="font-black text-sm tracking-wide text-black uppercase mt-0.5">
                      TURMA: {turma.codigo}
                    </h3>
                  </div>

                  <table className="w-full border-collapse border border-black table-fixed text-black bg-white">
                    <thead>
                      <tr className="bg-gray-200 font-bold h-5">
                        <th className="border border-black py-0 px-1 w-[8%] text-[10px] text-center leading-none uppercase">
                          HORÁRIO
                        </th>
                        {dias.map((d) => (
                          <th
                            key={d.id}
                            className="border border-black py-0 px-1 w-[18.4%] text-[10px] text-center leading-none uppercase"
                          >
                            {d.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {dados.slots.map((slot: any) => {
                        const linhaTemChoque = dias.some(
                          (dia) =>
                            getAulasNoSlot(turma.id, dia.id, slot.id).length >
                            1,
                        );

                        return (
                          <tr key={slot.id} className="h-auto">
                            <td className="border border-black p-0.5 text-center font-bold bg-gray-100 align-middle text-black text-[10px] leading-tight">
                              {slot.hora_inicio.substring(0, 5)}
                              <br />
                              {slot.hora_fim.substring(0, 5)}
                            </td>
                            {dias.map((dia) => {
                              const aulasNoSlot = getAulasNoSlot(
                                turma.id,
                                dia.id,
                                slot.id,
                              );

                              if (aulasNoSlot.length === 0) {
                                return (
                                  <td
                                    key={dia.id}
                                    className="border border-black p-0.5 bg-white"
                                  ></td>
                                );
                              }

                              const isSplit = aulasNoSlot.length > 1;
                              const isSingleInTallRow =
                                linhaTemChoque && !isSplit;

                              return (
                                <td
                                  key={dia.id}
                                  className={`border border-black p-0.5 bg-white ${isSingleInTallRow ? "align-middle" : "align-top"}`}
                                >
                                  {/* CONTEÚDO CENTRALIZADO E COM FONTES LEVEMENTE MAIORES */}
                                  <div className="flex flex-col w-full h-full justify-center items-center text-center gap-0.5">
                                    {aulasNoSlot.map(
                                      (aula: any, index: number) => {
                                        const disc = dados.disciplinas?.find(
                                          (d: any) =>
                                            String(d.id) ===
                                            String(aula.disciplina_id),
                                        );
                                        const prof = dados.professores?.find(
                                          (p: any) =>
                                            String(p.id) ===
                                            String(aula.professor_id),
                                        );
                                        const sala = dados.espacos?.find(
                                          (e: any) =>
                                            String(e.id) ===
                                            String(aula.espaco_id),
                                        );

                                        return (
                                          <div
                                            key={aula.id}
                                            className={`flex flex-col justify-center items-center w-full ${isSplit && index > 0 ? "border-t border-dashed border-gray-400 pt-0.5 mt-0.5" : ""}`}
                                          >
                                            <span
                                              className="font-bold text-[11px] leading-[1.1] uppercase text-black"
                                              title={disc?.nome}
                                            >
                                              {disc?.nome}
                                            </span>
                                            <span
                                              className="text-[10px] text-gray-800 font-medium leading-[1.1] uppercase"
                                              title={prof?.nome}
                                            >
                                              {prof?.nome}
                                            </span>
                                            <span
                                              className="text-[10px] text-gray-600 leading-[1.1] uppercase"
                                              title={sala?.nome}
                                            >
                                              {sala?.nome || "S/S"}
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
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
