"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function RelatorioProfessoresPage() {
  const [carregando, setCarregando] = useState(true);

  // Estados para o Controle de Versão
  const [versoes, setVersoes] = useState<any[]>([]);
  const [versaoSelecionada, setVersaoSelecionada] = useState<string>("");

  const [professores, setProfessores] = useState<any[]>([]);
  const [aulas, setAulas] = useState<any[]>([]);
  const [filtro, setFiltro] = useState("");

  // 1. Carrega primeiro as versões
  useEffect(() => {
    async function carregarVersoes() {
      const { data } = await supabase
        .from("versoes_grade")
        .select("*")
        .order("data_inicio_vigencia", { ascending: false });

      if (data && data.length > 0) {
        setVersoes(data);
        // Tenta encontrar a versão em Rascunho para focar no trabalho atual
        const ativa = data.find((v) => v.status === "RASCUNHO") || data[0];
        setVersaoSelecionada(ativa.id);
      } else {
        setCarregando(false);
      }
    }
    carregarVersoes();
  }, []);

  // 2. Carrega as aulas com base na versão selecionada
  useEffect(() => {
    if (!versaoSelecionada) return;

    const carregarRelatorio = async () => {
      setCarregando(true);
      try {
        const [{ data: dProf }, { data: dAulas }] = await Promise.all([
          supabase.from("professores").select("*").order("nome"),
          supabase
            .from("aulas")
            .select("professor_id")
            .eq("versao_id", versaoSelecionada), // <-- FILTRO DE VERSÃO APLICADO
        ]);

        if (dProf) setProfessores(dProf);
        if (dAulas) setAulas(dAulas);
      } catch (error) {
        console.error("Erro ao carregar relatório:", error);
      } finally {
        setCarregando(false);
      }
    };

    carregarRelatorio();
  }, [versaoSelecionada]);

  const relatorioCompleto = professores
    .map((prof) => {
      const totalAulas = aulas.filter(
        (a) => String(a.professor_id) === String(prof.id),
      ).length;
      return { ...prof, totalAulas };
    })
    .filter((p) => p.nome.toLowerCase().includes(filtro.toLowerCase()));

  if (carregando && !versaoSelecionada) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const versaoAtualObj = versoes.find(
    (v) => String(v.id) === String(versaoSelecionada),
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 h-screen flex flex-col">
      {/* CABEÇALHO PADRÃO */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden shrink-0 mt-6 relative">
        {/* Loading overlay discreto ao trocar de versão */}
        {carregando && versaoSelecionada && (
          <div className="absolute inset-0 z-10 bg-white/50 backdrop-blur-sm flex items-center justify-center rounded-xl">
            <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        <div>
          <h1 className="text-2xl font-black text-green-800 flex items-center gap-3">
            Carga Horária dos Docentes
            {versaoAtualObj?.status === "RASCUNHO" && (
              <span className="text-[10px] bg-yellow-100 text-yellow-800 border border-yellow-200 px-2 py-1 rounded tracking-widest uppercase align-middle">
                Em Edição
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-500 font-medium mt-1">
            Controle de ocupação e distribuição de aulas no campus.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* SELETOR DE VERSÕES */}
          {versoes.length > 0 && (
            <select
              value={versaoSelecionada}
              onChange={(e) => setVersaoSelecionada(e.target.value)}
              className="border border-green-300 bg-green-50 text-green-800 rounded p-2 text-sm outline-none font-bold w-full sm:w-auto shadow-sm"
              title="Filtrar por versão"
            >
              {versoes.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nome} - {v.semestre}{" "}
                  {v.status === "RASCUNHO" ? "(Rascunho)" : ""}
                </option>
              ))}
            </select>
          )}

          <input
            type="text"
            placeholder="Buscar professor..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="border border-gray-300 rounded p-2 text-sm outline-none focus:ring-2 focus:ring-green-500 w-full sm:w-56"
          />
          <button
            onClick={() => window.print()}
            className="bg-green-600 text-white px-5 py-2.5 rounded shadow-sm text-sm font-bold hover:bg-green-700 transition-colors shrink-0"
          >
            Imprimir 📄
          </button>
        </div>
      </div>

      {/* FORMATO DE LISTA COM CABEÇALHO FIXO */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex-1 flex flex-col print:shadow-none print:border-gray-300 print:overflow-visible print:block">
        {/* Título Visível Apenas na Impressão */}
        <div className="hidden print:block text-center py-4 border-b border-gray-300">
          <h2 className="text-2xl font-black text-gray-800 uppercase">
            Carga Horária - {versaoAtualObj?.nome || "Relatório"}
          </h2>
          <p className="text-sm text-gray-500 font-bold uppercase tracking-widest mt-1">
            Semestre {versaoAtualObj?.semestre || "-"} • Gerado em{" "}
            {new Date().toLocaleDateString("pt-BR")}
          </p>
        </div>

        <div className="overflow-y-auto flex-1 max-h-[calc(100vh-220px)] print:max-h-none print:overflow-visible">
          <table className="w-full text-left border-collapse relative">
            <thead className="sticky top-0 z-10 print:static">
              <tr className="text-xs uppercase tracking-wider text-gray-500 shadow-sm print:shadow-none">
                <th className="p-4 font-black bg-gray-50 border-b border-gray-200 print:bg-gray-100">
                  Docente
                </th>
                <th className="p-4 font-black text-center bg-gray-50 border-b border-gray-200 print:bg-gray-100">
                  Dia de Planejamento
                </th>
                <th className="p-4 font-black text-center bg-gray-50 border-b border-gray-200 print:bg-gray-100">
                  Aulas na Versão
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
                  const maxAulas = 20;
                  const percentualReal = (prof.totalAulas / maxAulas) * 100;
                  const percentualVisual = Math.min(percentualReal, 100);

                  let corBarra = "bg-green-500";
                  let corTexto = "text-green-700";

                  if (prof.totalAulas >= 16) {
                    corBarra = "bg-orange-500";
                    corTexto = "text-orange-700";
                  }
                  if (prof.totalAulas >= 20) {
                    corBarra = "bg-red-500";
                    corTexto = "text-red-700";
                  }

                  return (
                    <tr
                      key={prof.id}
                      className="hover:bg-gray-50 transition-colors group"
                    >
                      <td className="p-4 font-bold text-gray-800">
                        {prof.nome}
                      </td>
                      <td className="p-4 text-center text-gray-500 font-medium">
                        {prof.dia_planejamento || "-"}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`font-black ${corTexto}`}>
                          {prof.totalAulas}
                        </span>
                      </td>
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
