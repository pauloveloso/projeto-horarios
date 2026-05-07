"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function HomePage() {
  const [carregando, setCarregando] = useState(true);
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
          supabase.from("aulas").select("*"),
          supabase.from("turmas").select("*").order("codigo"),
          supabase.from("cursos").select("*").order("nome"),
          supabase.from("professores").select("*").order("nome"),
          supabase.from("disciplinas").select("*").order("nome"),
          supabase.from("espacos").select("*").order("nome"),
          supabase.from("categorias_espacos").select("*").order("nome"),
          supabase.from("slots_horarios").select("*").order("hora_inicio"),
        ]);

        setDados({
          aulas,
          turmas,
          cursos,
          professores,
          disciplinas,
          espacos,
          categorias,
          slots,
        });
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
      } finally {
        setCarregando(false);
      }
    }
    carregarTudo();
  }, []);

  const formatarHora = (hora: string) => (hora ? hora.substring(0, 5) : "");

  // Agrupamento lógico por Turnos
  const turnos = [
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

  // Renderização de opções agrupadas (UX)
  const renderOpcoesTurmas = () => {
    return dados.cursos.map((curso: any) => {
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
    });
  };

  const renderOpcoesEspacos = () => {
    return dados.categorias.map((cat: any) => {
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
    });
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

  if (carregando) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-10">
      {/* HEADER - OCULTO NA IMPRESSÃO */}
      <header className="bg-green-800 text-white p-6 shadow-md print:hidden">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <h1 className="text-2xl font-black italic tracking-tighter">
              SGH{" "}
              <span className="font-light not-italic text-green-200">
                | IFNMG
              </span>
            </h1>
            <p className="text-sm font-medium text-green-100 uppercase tracking-widest">
              Portal de Horários
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 bg-green-900/40 p-4 rounded-xl border border-green-700/50">
            <div className="flex bg-green-950 rounded-lg p-1">
              {(["TURMA", "PROFESSOR", "ESPACO"] as const).map((t) => (
                <button
                  key={t}
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
              className="bg-white text-gray-800 rounded-lg p-2 text-sm font-bold outline-none border-none w-full sm:w-[280px] shadow-inner truncate"
            >
              <option value="">Escolha...</option>
              {tipoFiltro === "TURMA" && renderOpcoesTurmas()}
              {tipoFiltro === "PROFESSOR" &&
                dados.professores.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              {tipoFiltro === "ESPACO" && renderOpcoesEspacos()}
            </select>

            <button
              onClick={() => window.print()}
              disabled={!idSelecionado}
              className="bg-white text-green-800 px-6 py-2 rounded-lg font-black text-sm shadow hover:bg-green-50 transition-all active:scale-95 disabled:opacity-30"
            >
              GERAR PDF / IMPRIMIR
            </button>
          </div>
        </div>
      </header>

      {/* ÁREA DA GRADE */}
      <main className="max-w-7xl mx-auto mt-6 p-2">
        {!idSelecionado ? (
          <div className="h-[60vh] flex flex-col items-center justify-center text-gray-300 border-4 border-dashed border-gray-100 rounded-3xl">
            <span className="text-8xl mb-4">📅</span>
            <p className="text-xl font-black text-gray-400 text-center px-4">
              Selecione uma opção acima para visualizar o horário.
            </p>
          </div>
        ) : (
          <div className="space-y-6 print:space-y-0">
            {/* Título da Grade */}
            <div className="text-center py-4 print:py-0 print:mb-4">
              <h2 className="text-3xl font-black text-gray-800 uppercase print:text-xl">
                {obterTituloGrade()}
              </h2>
              <div className="hidden print:block text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                IFNMG Campus Januária • Gerado em{" "}
                {new Date().toLocaleDateString("pt-BR")} às{" "}
                {new Date().toLocaleTimeString("pt-BR")}
              </div>
            </div>

            {/* TABELAS POR TURNO */}
            {turnos.map(
              (turno, index) =>
                turno.slots.length > 0 && (
                  <div
                    key={turno.nome}
                    className={`overflow-hidden bg-white border border-gray-200 rounded-lg print:border-gray-300 print:rounded-none print:mb-0 ${index > 0 ? "print:break-before-page" : ""}`}
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
                              key={dia.id}
                              className="p-2 border-r border-gray-200 text-center"
                            >
                              {dia.nome}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {turno.slots.map((slot: any) => (
                          <tr key={slot.id} className="h-16 print:h-14">
                            <td className="p-1 border-r border-gray-200 text-center bg-gray-50/50">
                              <div className="font-black text-gray-700 text-sm">
                                {formatarHora(slot.hora_inicio)}
                              </div>
                              <div className="text-[10px] text-gray-400">
                                {formatarHora(slot.hora_fim)}
                              </div>
                            </td>

                            {diasSemana.map((dia) => {
                              const aula = dados.aulas.find((a: any) => {
                                const mesmoTempo =
                                  a.dia_semana === dia.id &&
                                  String(a.slot_horario_id) === String(slot.id);
                                if (!mesmoTempo) return false;
                                if (tipoFiltro === "TURMA")
                                  return (
                                    String(a.turma_id) === String(idSelecionado)
                                  );
                                if (tipoFiltro === "PROFESSOR")
                                  return (
                                    String(a.professor_id) ===
                                    String(idSelecionado)
                                  );
                                if (tipoFiltro === "ESPACO")
                                  return (
                                    String(a.espaco_id) ===
                                    String(idSelecionado)
                                  );
                                return false;
                              });

                              if (!aula)
                                return (
                                  <td
                                    key={dia.id}
                                    className="border-r border-gray-100 print:border-gray-300"
                                  ></td>
                                );

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
                              const curso = dados.cursos.find(
                                (c: any) => c.id === turma?.curso_id,
                              );

                              return (
                                <td
                                  key={dia.id}
                                  className="p-1 border-r border-gray-100 align-top print:border-gray-300"
                                >
                                  <div
                                    className="h-full w-full rounded p-1.5 flex flex-col justify-center border border-black/5 print:border-gray-300"
                                    style={{
                                      backgroundColor:
                                        curso?.cor_identificacao || "#f9fafb",
                                    }}
                                  >
                                    <div className="font-black text-xs leading-tight text-gray-900 print:text-[12px] mb-0.5 uppercase">
                                      {disc?.sigla ? `${disc.sigla} - ` : ""}
                                      {disc?.nome}
                                    </div>

                                    <div className="space-y-0.5">
                                      {tipoFiltro !== "PROFESSOR" && (
                                        <div className="text-[9px] font-bold text-gray-700/90 print:text-[10px] truncate uppercase">
                                          👤 {prof?.nome || "A definir"}
                                        </div>
                                      )}
                                      {tipoFiltro !== "TURMA" && (
                                        <div className="text-[9px] font-bold text-gray-700/90 print:text-[10px] uppercase">
                                          👥 {turma?.codigo}
                                        </div>
                                      )}
                                      {tipoFiltro !== "ESPACO" && (
                                        <div className="text-[9px] font-bold text-gray-700/90 print:text-[10px] truncate uppercase">
                                          📍 {sala?.nome || "S/S"}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ),
            )}
          </div>
        )}
      </main>

      {/* RODAPÉ INFORMATIVO COM ACESSO À GESTÃO */}
      <footer className="max-w-7xl mx-auto p-8 text-center print:hidden border-t border-gray-100 mt-12">
        <div className="flex flex-col items-center gap-4">
          <div className="text-gray-400 text-xs leading-relaxed max-w-md">
            Para gerar um PDF, selecione o filtro desejado e utilize a função de
            impressão do navegador.
            <br />
            Certifique-se de que a opção "Gráficos de segundo plano" está ativa.
          </div>

          <Link
            href="/login"
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 text-gray-400 hover:text-green-700 hover:border-green-200 hover:bg-green-50 transition-all text-xs font-bold group"
          >
            <span className="opacity-60 group-hover:opacity-100">🔒</span>
            Acesso Restrito à Gestão
          </Link>
        </div>
      </footer>

      {/* CSS GLOBAL PARA IMPRESSÃO */}
      <style jsx global>{`
        @media print {
          @page {
            size: landscape;
            margin: 0.5cm;
          }
          body {
            background: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print\:hidden {
            display: none !important;
          }
          .print\:break-before-page {
            break-before: page;
            page-break-before: always;
            margin-top: 0 !important;
          }
          tr {
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}
