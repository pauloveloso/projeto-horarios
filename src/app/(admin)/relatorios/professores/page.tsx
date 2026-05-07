"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function RelatorioProfessoresPage() {
  const [carregando, setCarregando] = useState(true);
  const [professores, setProfessores] = useState<any[]>([]);
  const [aulas, setAulas] = useState<any[]>([]);
  const [filtro, setFiltro] = useState("");

  useEffect(() => {
    carregarRelatorio();
  }, []);

  const carregarRelatorio = async () => {
    setCarregando(true);
    try {
      const [{ data: dProf }, { data: dAulas }] = await Promise.all([
        supabase.from("professores").select("*").order("nome"),
        supabase.from("aulas").select("professor_id"),
      ]);

      if (dProf) setProfessores(dProf);
      if (dAulas) setAulas(dAulas);
    } catch (error) {
      console.error("Erro ao carregar relatório:", error);
    } finally {
      setCarregando(false);
    }
  };

  const relatorioCompleto = professores
    .map((prof) => {
      const totalAulas = aulas.filter(
        (a) => String(a.professor_id) === String(prof.id),
      ).length;
      return { ...prof, totalAulas };
    })
    .filter((p) => p.nome.toLowerCase().includes(filtro.toLowerCase()));

  if (carregando) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 h-screen flex flex-col">
      {/* CABEÇALHO PADRÃO */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden shrink-0 mt-6">
        <div>
          <h1 className="text-2xl font-black text-green-800">
            Carga Horária dos Docentes
          </h1>
          <p className="text-sm text-gray-500 font-medium mt-1">
            Controle de ocupação e distribuição de aulas no campus.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <input
            type="text"
            placeholder="Buscar professor..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="border border-gray-300 rounded p-2 text-sm outline-none focus:ring-2 focus:ring-green-500 w-full sm:w-64"
          />
          <button
            onClick={() => window.print()}
            className="bg-green-600 text-white px-5 py-2.5 rounded shadow-sm text-sm font-bold hover:bg-green-700 transition-colors shrink-0"
          >
            Imprimir Relatório 📄
          </button>
        </div>
      </div>

      {/* FORMATO DE LISTA COM CABEÇALHO FIXO */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex-1 flex flex-col print:shadow-none print:border-gray-300 print:overflow-visible print:block">
        {/* Container que permite rolagem apenas no corpo da tabela */}
        <div className="overflow-y-auto flex-1 max-h-[calc(100vh-220px)] print:max-h-none print:overflow-visible">
          <table className="w-full text-left border-collapse relative">
            <thead className="sticky top-0 z-10 print:static">
              <tr className="text-xs uppercase tracking-wider text-gray-500 shadow-sm print:shadow-none">
                {/* Foi adicionado o bg-gray-50 direto no TH para ele não ficar transparente ao rolar */}
                <th className="p-4 font-black bg-gray-50 border-b border-gray-200 print:bg-gray-100">
                  Docente
                </th>
                <th className="p-4 font-black text-center bg-gray-50 border-b border-gray-200 print:bg-gray-100">
                  Dia de Planejamento
                </th>
                <th className="p-4 font-black text-center bg-gray-50 border-b border-gray-200 print:bg-gray-100">
                  Aulas
                </th>
                <th className="p-4 font-black w-1/3 bg-gray-50 border-b border-gray-200 print:bg-gray-100">
                  Termômetro de Ocupação
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {relatorioCompleto.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="p-12 text-center text-gray-400 font-medium"
                  >
                    Nenhum professor encontrado.
                  </td>
                </tr>
              ) : (
                relatorioCompleto.map((prof) => {
                  // Regra de Ocupação
                  const maxAulas = 20;
                  // Calcula a porcentagem real, podendo passar de 100%
                  const percentualReal = (prof.totalAulas / maxAulas) * 100;
                  // Limita o tamanho visual da barra a 100% para não quebrar o layout
                  const percentualVisual = Math.min(percentualReal, 100);

                  let corBarra = "bg-green-500";
                  let corTexto = "text-green-700";

                  if (prof.totalAulas >= 16) {
                    corBarra = "bg-orange-500";
                    corTexto = "text-orange-700";
                  }
                  if (prof.totalAulas >= 20) {
                    // Carga máxima ou superior a 20 fica sempre vermelha
                    corBarra = "bg-red-500";
                    corTexto = "text-red-700";
                  }

                  return (
                    <tr
                      key={prof.id}
                      className="hover:bg-gray-50 transition-colors group"
                    >
                      {/* NOME */}
                      <td className="p-4 font-bold text-gray-800">
                        {prof.nome}
                      </td>

                      {/* DIA DE PLANEJAMENTO */}
                      <td className="p-4 text-center text-gray-500 font-medium">
                        {prof.dia_planejamento || "-"}
                      </td>

                      {/* NÚMERO DE AULAS */}
                      <td className="p-4 text-center">
                        <span className={`font-black ${corTexto}`}>
                          {prof.totalAulas}
                        </span>
                      </td>

                      {/* TERMÔMETRO */}
                      <td className="p-4 align-middle pr-8">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden shadow-inner print:border print:border-gray-300">
                            <div
                              className={`${corBarra} h-full transition-all duration-500 print:print-color-adjust-exact`}
                              style={{
                                width: `${percentualVisual}%`,
                                WebkitPrintColorAdjust: "exact",
                                printColorAdjust: "exact",
                              }}
                            ></div>
                          </div>
                          <span
                            className={`text-[11px] font-black w-10 text-right ${percentualReal > 100 ? "text-red-600" : "text-gray-500"}`}
                          >
                            {Math.round(percentualReal)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ESTILO DE IMPRESSÃO */}
      <style jsx global>{`
        @media print {
          @page {
            margin: 1cm;
            size: portrait;
          }
          body {
            background: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .max-w-7xl {
            max-width: 100% !important;
            margin: 0 !important;
          }
          .print\:hidden {
            display: none !important;
          }
          table {
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
}
