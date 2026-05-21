"use client";

import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import jsPDF from "jspdf";
import html2canvas from "html2canvas-pro";

export default function FichasMatriculaPage() {
  const [carregando, setCarregando] = useState(true);
  const [exportando, setExportando] = useState(false);
  const conteudoRef = useRef<HTMLDivElement>(null);

  // Listas estruturais do banco
  const [versoes, setVersoes] = useState<any[]>([]);
  const [semestres, setSemestres] = useState<string[]>([]);
  const [cursos, setCursos] = useState<any[]>([]);
  const [slotsTotais, setSlotsTotais] = useState<any[]>([]);

  // Filtros selecionados
  const [semestreSelecionado, setSemestreSelecionado] = useState<string>("");
  const [cursoSelecionado, setCursoSelecionado] = useState<string>("");

  // Dados processados para renderização
  const [paginas, setPaginas] = useState<any[]>([]);
  const [versaoAtivaDetalhes, setVersaoAtivaDetalhes] = useState<any>(null);

  const diasSemana = [
    { id: "SEGUNDA", nome: "SEGUNDA" },
    { id: "TERCA", nome: "TERÇA" },
    { id: "QUARTA", nome: "QUARTA" },
    { id: "QUINTA", nome: "QUINTA" },
    { id: "SEXTA", nome: "SEXTA" },
  ];

  const formatarSemestre = (sem: string) => {
    if (!sem || !sem.includes(".")) return sem;
    const [ano, periodo] = sem.split(".");
    return `${periodo}º SEMESTRE LETIVO / ${ano}`;
  };

  useEffect(() => {
    async function carregarFiltros() {
      const [{ data: versoesData }, { data: cursosData }, { data: slotsData }] =
        await Promise.all([
          supabase
            .from("versoes_grade")
            .select("*")
            .order("data_inicio_vigencia", { ascending: false }),
          supabase.from("cursos").select("*").order("nome"),
          supabase.from("slots_horarios").select("*").order("hora_inicio"),
        ]);

      if (slotsData) setSlotsTotais(slotsData);

      if (cursosData && cursosData.length > 0) {
        setCursos(cursosData);
        // Removida a autoseleção do curso para iniciar vazio
      }

      if (versoesData && versoesData.length > 0) {
        setVersoes(versoesData);
        const semestresUnicos = Array.from(
          new Set(versoesData.map((v) => v.semestre)),
        ).filter(Boolean) as string[];
        setSemestres(semestresUnicos);
        if (semestresUnicos.length > 0) {
          setSemestreSelecionado(semestresUnicos[0]);
        }
      } else {
        setCarregando(false);
      }
    }
    carregarFiltros();
  }, []);

  useEffect(() => {
    if (
      !semestreSelecionado ||
      !cursoSelecionado ||
      versoes.length === 0 ||
      slotsTotais.length === 0
    ) {
      setPaginas([]);
      setCarregando(false);
      return;
    }

    async function processarFichas() {
      setCarregando(true);
      try {
        const versoesDoSemestre = versoes.filter(
          (v) => v.semestre === semestreSelecionado,
        );
        if (versoesDoSemestre.length === 0) {
          setPaginas([]);
          setVersaoAtivaDetalhes(null);
          setCarregando(false);
          return;
        }

        const versaoAtiva = versoesDoSemestre[0];
        setVersaoAtivaDetalhes(versaoAtiva);

        const [
          { data: turmas },
          { data: aulas },
          { data: professores },
          { data: disciplinas },
          { data: espacos },
        ] = await Promise.all([
          supabase
            .from("turmas")
            .select("*")
            .eq("curso_id", cursoSelecionado)
            .order("codigo"),
          supabase.from("aulas").select("*").eq("versao_id", versaoAtiva.id),
          supabase.from("professores").select("*"),
          supabase.from("disciplinas").select("*"),
          supabase.from("espacos").select("*"),
        ]);

        const cursoObjeto = cursos.find(
          (c) => String(c.id) === String(cursoSelecionado),
        );
        const turmaIds = turmas?.map((t) => String(t.id)) || [];
        const aulasDoCurso = (aulas || []).filter((a) =>
          turmaIds.includes(String(a.turma_id)),
        );

        const turnosBase = [
          {
            id: "MAT",
            nome: "MATUTINO",
            slots: slotsTotais.filter((s) => s.hora_inicio < "12:00"),
          },
          {
            id: "VESP",
            nome: "VESPERTINO",
            slots: slotsTotais.filter(
              (s) => s.hora_inicio >= "12:00" && s.hora_inicio < "18:00",
            ),
          },
          {
            id: "NOT",
            nome: "NOTURNO",
            slots: slotsTotais.filter((s) => s.hora_inicio >= "18:00"),
          },
        ];

        const paginasProcessadas: any[] = [];

        (turmas || []).forEach((turma) => {
          const aulasDaTurma = aulasDoCurso.filter(
            (a) => String(a.turma_id) === String(turma.id),
          );

          turnosBase.forEach((turno) => {
            const slotIdsDoTurno = turno.slots.map((s) => String(s.id));
            const aulasNoTurno = aulasDaTurma.filter((a) =>
              slotIdsDoTurno.includes(String(a.slot_horario_id)),
            );

            const slotsDaPagina = turno.slots.filter((s, index) => {
              if (index < 4) return true;
              return aulasNoTurno.some(
                (a) => String(a.slot_horario_id) === String(s.id),
              );
            });

            if (aulasNoTurno.length > 0) {
              paginasProcessadas.push({
                id: `${turma.id}-${turno.id}`,
                turma: {
                  ...turma,
                  curso_nome: cursoObjeto?.nome || "Curso Desconhecido",
                },
                turnoNome: turno.nome,
                slots: slotsDaPagina,
                aulas: aulasNoTurno.map((a) => ({
                  ...a,
                  disciplina_nome:
                    disciplinas?.find(
                      (d) => String(d.id) === String(a.disciplina_id),
                    )?.nome || "",
                  professor_nome:
                    professores?.find(
                      (p) => String(p.id) === String(a.professor_id),
                    )?.nome || "A definir",
                  espaco_nome:
                    espacos?.find((e) => String(e.id) === String(a.espaco_id))
                      ?.nome || "S/S",
                })),
              });
            }
          });
        });

        setPaginas(paginasProcessadas);
      } catch (error) {
        console.error("Erro ao processar dados das fichas:", error);
      } finally {
        setCarregando(false);
      }
    }

    processarFichas();
  }, [semestreSelecionado, cursoSelecionado, versoes, slotsTotais, cursos]);

  const formatarHora = (hora: string) => (hora ? hora.substring(0, 5) : "");

  // ==========================================
  // FUNÇÃO DE EXPORTAÇÃO "FOTO" PARA PDF (OTIMIZADA)
  // ==========================================
  const exportarParaPDF = async () => {
    if (paginas.length === 0) return;
    setExportando(true);

    try {
      const cursoObjeto = cursos.find(
        (c) => String(c.id) === String(cursoSelecionado),
      );
      const nomeCursoLimpo =
        cursoObjeto?.nome.replace(/[^a-zA-Z0-9]/g, "_") || "curso";

      // Instancia o PDF com a compressão nativa ativada
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
        compress: true,
      });

      // Volta o scroll da página ao topo
      window.scrollTo(0, 0);

      // Laço iterando pelo número de páginas
      for (let i = 0; i < paginas.length; i++) {
        const folhaElement = document.getElementById(`folha-pdf-${i}`);

        if (!folhaElement) continue;

        // Captura a imagem
        const canvas = await html2canvas(folhaElement, {
          scale: 1.5,
          useCORS: true,
          logging: false,
          scrollY: 0,
          x: 0,
          y: 0,
          backgroundColor: "#ffffff",
        });

        const imgData = canvas.toDataURL("image/jpeg", 0.75);

        if (i > 0) pdf.addPage();

        // Insere a foto no PDF sinalizando que é JPEG
        pdf.addImage(imgData, "JPEG", 0, 0, 297, 210);
      }

      pdf.save(`FICHAS_MATRICULA_${nomeCursoLimpo}_${semestreSelecionado}.pdf`);
    } catch (error) {
      console.error("Erro ao processar exportação para o PDF:", error);
      alert(
        "Ocorreu um erro ao gerar o PDF. Verifique os detalhes no console.",
      );
    } finally {
      setExportando(false);
    }
  };

  const FolhaMatricula = ({
    pagina,
    index,
  }: {
    pagina: any;
    index: number;
  }) => {
    return (
      <div
        id={`folha-pdf-${index}`}
        className="bg-white text-black font-sans relative print-page-container p-8 border border-gray-300 my-4 shadow-md box-border"
      >
        <div>
          {/* CABEÇALHO PADRÃO IFNMG */}
          <div className="flex items-center justify-center gap-6 mb-3 border-b border-gray-400 pb-2">
            <img
              src="/logo-ifnmg.png"
              alt="Logo IFNMG"
              className="h-12 w-auto object-contain block"
            />
            <div className="text-center">
              <h1 className="font-black text-xs uppercase leading-tight">
                Instituto Federal
              </h1>
              <h2 className="font-bold text-[11px] uppercase leading-tight">
                Norte de Minas Gerais
              </h2>
              <h3 className="font-bold text-[11px] uppercase leading-tight">
                Campus Januária
              </h3>
            </div>
          </div>

          <div className="text-center mb-3 flex flex-col gap-0.5 text-xs text-gray-900">
            <h4 className="font-black text-xs uppercase tracking-wide">
              REQUERIMENTO DE RENOVAÇÃO DE MATRÍCULA
            </h4>
            <p className="font-bold uppercase">
              COORDENAÇÃO DO CURSO DE {pagina.turma.curso_nome}
            </p>
            <p className="font-bold uppercase">
              {formatarSemestre(versaoAtivaDetalhes?.semestre)}
            </p>
            <p className="font-black text-xl mt-0.5 tracking-wider text-black">
              {pagina.turma.codigo}
            </p>
          </div>

          {/* TABELA DE HORÁRIOS */}
          <div className="mb-2">
            <table className="w-full border-collapse border border-black text-[10px]">
              <thead>
                <tr className="bg-gray-200 font-bold">
                  <th className="border border-black p-1 w-24 text-center text-xs">
                    HORÁRIO
                  </th>
                  {diasSemana.map((dia) => (
                    <th
                      key={dia.id}
                      className="border border-black p-1 uppercase text-center text-xs"
                    >
                      {dia.nome}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagina.slots.map((slot: any, index: number) => {
                  let intervalo = null;
                  if (index > 0) {
                    const fimAnterior = pagina.slots[index - 1].hora_fim;
                    if (slot.hora_inicio !== fimAnterior) {
                      intervalo = (
                        <tr
                          key={`intervalo-${index}`}
                          className="bg-gray-100 font-bold"
                        >
                          <td
                            colSpan={6}
                            className="border border-black p-1 text-center uppercase tracking-widest text-[9px]"
                          >
                            INTERVALO: {formatarHora(fimAnterior)} às{" "}
                            {formatarHora(slot.hora_inicio)}
                          </td>
                        </tr>
                      );
                    }
                  }

                  return (
                    <React.Fragment key={slot.id}>
                      {intervalo}
                      <tr>
                        <td className="border border-black p-1 text-center font-bold align-middle bg-gray-50/30 text-xs">
                          {formatarHora(slot.hora_inicio)}
                          <br />
                          às
                          <br />
                          {formatarHora(slot.hora_fim)}
                        </td>
                        {diasSemana.map((dia) => {
                          const aula = pagina.aulas.find(
                            (a: any) =>
                              a.dia_semana === dia.id &&
                              String(a.slot_horario_id) === String(slot.id),
                          );

                          return (
                            <td
                              key={dia.id}
                              className="border border-black p-1 align-middle text-center w-1/5 bg-white"
                            >
                              {aula ? (
                                <div className="flex flex-col h-full justify-center items-center text-center py-0.5">
                                  <div className="font-bold uppercase leading-tight text-[10px] mb-0.5">
                                    (&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;){" "}
                                    {aula.disciplina_nome}
                                  </div>
                                  <div className="text-[9px] uppercase leading-tight text-gray-700">
                                    {aula.espaco_nome} / {aula.professor_nome}
                                  </div>
                                  <div className="font-bold text-[9px] tracking-wide mt-1 pt-0.5 border-t border-gray-100 flex justify-center gap-3 w-full">
                                    <span>1(&nbsp;&nbsp;)</span>{" "}
                                    <span>2(&nbsp;&nbsp;)</span>{" "}
                                    <span>3(&nbsp;&nbsp;)</span>{" "}
                                    <span>4(&nbsp;&nbsp;)</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="min-h-[3.8rem]"></div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* INSTRUÇÕES E LEGENDA */}
          <div className="mb-2 text-[10px] text-justify border border-black p-2 leading-tight bg-gray-50">
            <p className="mb-0.5">
              A matrícula é responsabilidade do acadêmico. Antes de efetivá-la,
              leia os Regulamentos dos Cursos Superiores do IFNMG. Após fazer a
              escolha da disciplina,{" "}
              <strong>
                ANULAR os quadros das disciplinas que NÃO serão cursadas
              </strong>
              .
            </p>
            <p className="mb-0.5">
              <strong>Em destaque:</strong> disciplinas que são pré-requisitos
              para disciplinas futuras. Recomenda-se prioridade.
            </p>
            <p className="font-bold">
              Legenda: 1 Regular; 2 Adiantamento; 3 Optativa/Curso; 4 Optativa
              Extra-curso.
            </p>
          </div>
        </div>

        {/* CONTÊINER DE ASSINATURAS */}
        <div className="pt-2 text-sm border-t border-gray-300 mt-4 dynamic-footer">
          <div className="grid grid-cols-2 gap-12 mt-1">
            <div>
              <div className="border-b border-black h-5 mb-1"></div>
              <p className="text-[10px] font-bold uppercase text-center text-gray-600">
                Assinatura do Acadêmico/Responsável
              </p>
            </div>
            <div className="flex gap-6">
              <div className="flex-1">
                <div className="border-b border-black h-5 mb-1 flex items-end text-[11px] text-gray-400 pl-2">
                  ____ / ____ / ________
                </div>
                <p className="text-[10px] font-bold uppercase text-gray-600 pl-2">
                  Data
                </p>
              </div>
              <div className="flex-1">
                <div className="border-b border-black h-5 mb-1 flex items-end text-[11px] text-gray-400 pl-2">
                  _________________
                </div>
                <p className="text-[10px] font-bold uppercase text-gray-600 pl-2">
                  Turma
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (carregando && versoes.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
          .print-page-container {
            width: 297mm;
            height: 210mm;
            max-width: 297mm;
            max-height: 210mm;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }

          .dynamic-footer {
            margin-top: auto;
          }
        `,
        }}
      />

      <div className="min-h-screen bg-gray-50 p-2 text-gray-900">
        <header className="bg-green-900 p-4 shadow-md sticky top-0 z-50 border-b border-green-800 rounded-xl max-w-7xl mx-auto my-2 text-white">
          <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <Link
                href="/painel"
                className="bg-white/20 hover:bg-white/30 px-3 py-2 rounded text-xs font-bold transition-colors text-white"
              >
                ⬅ Painel
              </Link>
              <div>
                <h1 className="text-base font-black uppercase tracking-tight text-white">
                  Fichas de Matrícula
                </h1>
                <p className="text-[10px] text-green-200 font-medium uppercase tracking-wider">
                  Módulo de Exportação Fotográfica para PDF
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 justify-end">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-green-200 uppercase tracking-wider">
                  Semestre:
                </label>
                <select
                  value={semestreSelecionado}
                  onChange={(e) => setSemestreSelecionado(e.target.value)}
                  className="bg-green-800 border border-green-700 text-white rounded px-3 py-2 text-sm font-bold outline-none cursor-pointer focus:border-green-400"
                >
                  {semestres.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-green-200 uppercase tracking-wider">
                  Curso:
                </label>
                <select
                  value={cursoSelecionado}
                  onChange={(e) => setCursoSelecionado(e.target.value)}
                  className="bg-green-800 border border-green-700 text-white rounded px-3 py-2 text-sm font-bold outline-none cursor-pointer focus:border-green-400 max-w-[250px] truncate"
                >
                  <option value="">Selecione um curso...</option>
                  {cursos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={exportarParaPDF}
                disabled={carregando || exportando || paginas.length === 0}
                className="bg-green-500 hover:bg-green-400 disabled:bg-gray-700 text-white px-5 py-2.5 rounded-lg font-black text-xs uppercase tracking-widest transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm"
              >
                {exportando ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    GERANDO...
                  </>
                ) : (
                  <>
                    <span>📄</span> EXPORTAR PDF ({paginas.length}{" "}
                    {paginas.length === 1 ? "Página" : "Páginas"})
                  </>
                )}
              </button>
            </div>
          </div>
        </header>

        <main className="py-4 flex flex-col items-center overflow-x-auto">
          {carregando ? (
            <div className="flex justify-center my-20">
              <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : !cursoSelecionado ? (
            <div className="text-center py-20 text-gray-500 bg-white max-w-xl mx-auto rounded-xl shadow border border-gray-200 p-6 my-10 w-full">
              <span className="text-5xl block mb-4">🏫</span>
              <p className="font-bold text-lg text-gray-700">
                Selecione um curso
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Escolha o curso no filtro acima para visualizar e exportar as
                fichas de matrícula.
              </p>
            </div>
          ) : paginas.length === 0 ? (
            <div className="text-center py-20 text-gray-500 bg-white max-w-xl mx-auto rounded-xl shadow border border-gray-200 p-6 my-10 w-full">
              <span className="text-5xl block mb-4">📄</span>
              <p className="font-bold text-lg text-gray-700">
                Nenhum horário localizado.
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Não existem aulas cadastradas para o curso selecionado na versão
                do semestre {semestreSelecionado}.
              </p>
            </div>
          ) : (
            <div
              ref={conteudoRef}
              className="bg-transparent flex flex-col gap-8"
            >
              {paginas.map((pagina, index) => (
                <FolhaMatricula key={pagina.id} pagina={pagina} index={index} />
              ))}
            </div>
          )}
        </main>
      </div>
    </>
  );
}
