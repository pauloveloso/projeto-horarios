"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

import ModoPlanilha from "./components/ModoPlanilha";
import ModoGrade from "./components/ModoGrade";

export default function LancamentosPage() {
  const [modoAtivo, setModoAtivo] = useState<"PLANILHA" | "GRADE">("PLANILHA");
  const [carregando, setCarregando] = useState(true);

  // NOVO ESTADO: Guarda a versão de rascunho ativa
  const [versaoRascunho, setVersaoRascunho] = useState<any>(null);

  const [aulas, setAulas] = useState<any[]>([]);
  const [turmas, setTurmas] = useState<any[]>([]);
  const [cursos, setCursos] = useState<any[]>([]);
  const [professores, setProfessores] = useState<any[]>([]);
  const [disciplinas, setDisciplinas] = useState<any[]>([]);
  const [espacos, setEspacos] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);

  // ATUALIZADO: Só busca as aulas do rascunho atual com o limite correto
  const buscarAulas = async () => {
    if (!versaoRascunho) return;
    const { data } = await supabase
      .from("aulas")
      .select("*")
      .eq("versao_id", versaoRascunho.id)
      .limit(5000); // Ponto e vírgula corrigido aqui
    if (data) setAulas(data);
  };

  useEffect(() => {
    let montado = true;
    let rascunhoAtualId = ""; // Variável auxiliar para o WebSocket não se perder no closure

    const buscarDadosMestres = async () => {
      setCarregando(true);
      try {
        // 1. PRIMEIRO: Descobre qual é o rascunho atual
        const { data: dVersoes } = await supabase
          .from("versoes_grade")
          .select("*")
          .eq("status", "RASCUNHO")
          .limit(1);

        const rascunho = dVersoes && dVersoes.length > 0 ? dVersoes[0] : null;

        if (montado) setVersaoRascunho(rascunho);
        if (rascunho) rascunhoAtualId = rascunho.id;

        // 2. Prepara a query de aulas dinamicamente com o limite de 5000
        const queryAulas = rascunho
          ? supabase
              .from("aulas")
              .select("*")
              .eq("versao_id", rascunho.id)
              .limit(5000)
          : null;

        // 3. Busca todos os dados mestres simultaneamente COM LIMITES ESTENDIDOS
        const [
          { data: dTurmas },
          { data: dCursos },
          { data: dProfessores },
          { data: dDisciplinas },
          { data: dEspacos },
          { data: dSlots },
          respostaAulas,
        ] = await Promise.all([
          supabase.from("turmas").select("*").order("codigo").limit(2000),
          supabase.from("cursos").select("*"),
          supabase.from("professores").select("*").order("nome").limit(1000),
          supabase.from("disciplinas").select("*").order("nome").limit(5000),
          supabase.from("espacos").select("*").order("nome").limit(1000),
          supabase.from("slots_horarios").select("*").order("hora_inicio"),
          queryAulas ? queryAulas : Promise.resolve({ data: [] }),
        ]);

        if (!montado) return;

        if (dTurmas) setTurmas(dTurmas);
        if (dCursos) setCursos(dCursos);
        if (dProfessores) setProfessores(dProfessores);
        if (dDisciplinas) setDisciplinas(dDisciplinas);
        if (dEspacos) setEspacos(dEspacos);
        if (dSlots) setSlots(dSlots);
        if (respostaAulas && respostaAulas.data) setAulas(respostaAulas.data);
      } catch (error) {
        console.error("Erro ao montar o sistema:", error);
      } finally {
        if (montado) setCarregando(false);
      }
    };

    buscarDadosMestres();

    // ========================================================================
    // CANAL ÚNICO DE SINCRONIZAÇÃO (Com Proteção contra Duplicidade e de Versão)
    // ========================================================================
    const canalSincronizacao = supabase
      .channel("painel_lancamentos_ifnmg")

      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "aulas" },
        (payload) => {
          setAulas((listaAntiga) => {
            // PROTEÇÃO DE RASCUNHO: Ignora qualquer aula que não pertença a este rascunho
            if (
              payload.eventType === "INSERT" ||
              payload.eventType === "UPDATE"
            ) {
              if (String(payload.new.versao_id) !== String(rascunhoAtualId)) {
                return listaAntiga;
              }
            }

            if (payload.eventType === "UPDATE") {
              return listaAntiga.map((a) =>
                String(a.id) === String(payload.new.id) ? payload.new : a,
              );
            }
            if (payload.eventType === "INSERT") {
              const jaExiste = listaAntiga.some(
                (a) => String(a.id) === String(payload.new.id),
              );
              if (jaExiste) return listaAntiga;

              return [...listaAntiga, payload.new];
            }
            if (payload.eventType === "DELETE") {
              return listaAntiga.filter(
                (a) => String(a.id) !== String(payload.old.id),
              );
            }
            return listaAntiga;
          });
        },
      )

      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "professores" },
        (payload) => {
          setProfessores((listaAntiga) => {
            if (payload.eventType === "UPDATE") {
              return listaAntiga.map((p) =>
                String(p.id) === String(payload.new.id) ? payload.new : p,
              );
            }
            if (payload.eventType === "INSERT") {
              const jaExiste = listaAntiga.some(
                (p) => String(p.id) === String(payload.new.id),
              );
              if (jaExiste) return listaAntiga;

              return [...listaAntiga, payload.new];
            }
            if (payload.eventType === "DELETE") {
              return listaAntiga.filter(
                (p) => String(p.id) !== String(payload.old.id),
              );
            }
            return listaAntiga;
          });
        },
      )

      .subscribe();

    return () => {
      montado = false;
      supabase.removeChannel(canalSincronizacao);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (carregando) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-500 font-bold text-lg animate-pulse">
            Sincronizando dados do campus...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* CABEÇALHO INTACTO */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100 gap-4">
        <div>
          <h1 className="text-2xl font-black text-green-800">
            Quadro de Horários
          </h1>
          <p className="text-sm text-gray-500 font-medium">
            Gestão acadêmica do semestre
          </p>
        </div>

        {/* Indicador de Rascunho Discreto */}
        {versaoRascunho && (
          <div className="hidden md:flex flex-col items-center justify-center px-4">
            <span className="text-[10px] font-black uppercase text-gray-400">
              Editando Rascunho
            </span>
            <span className="text-xs font-bold text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded border border-yellow-200 mt-0.5">
              {versaoRascunho.nome}
            </span>
          </div>
        )}

        <div className="flex bg-gray-100 p-1 rounded-lg shadow-inner">
          <button
            onClick={() => setModoAtivo("PLANILHA")}
            className={`px-6 py-2 rounded-md font-bold text-sm transition-all ${
              modoAtivo === "PLANILHA"
                ? "bg-white text-green-700 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            📋 Modo Planilha
          </button>
          <button
            onClick={() => setModoAtivo("GRADE")}
            className={`px-6 py-2 rounded-md font-bold text-sm transition-all ${
              modoAtivo === "GRADE"
                ? "bg-white text-green-700 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            🗓️ Modo Grade
          </button>
        </div>
      </div>

      {/* ÁREA DE CONTEÚDO */}
      {!versaoRascunho ? (
        <div className="bg-white border border-gray-200 p-12 rounded-xl text-center shadow-sm flex flex-col items-center justify-center">
          <span className="text-6xl mb-4 opacity-50">📁</span>
          <h2 className="text-2xl font-black text-gray-800 mb-2">
            Nenhum Rascunho Ativo
          </h2>
          <p className="text-gray-500 font-medium max-w-md mx-auto">
            Para iniciar os lançamentos, você precisa de um rascunho aberto. Vá
            até o menu <b>Gestão de Versões</b> e crie ou ative um rascunho.
          </p>
        </div>
      ) : (
        <>
          {modoAtivo === "PLANILHA" && (
            <ModoPlanilha
              versaoId={versaoRascunho.id} // <-- NOVO: Passando o ID para a planilha
              aulas={aulas}
              turmas={turmas}
              cursos={cursos}
              professores={professores}
              disciplinas={disciplinas}
              espacos={espacos}
              slots={slots}
              recarregarAulas={buscarAulas}
            />
          )}

          {modoAtivo === "GRADE" && (
            <ModoGrade
              versaoId={versaoRascunho.id} // <-- NOVO: Passando o ID para a grade
              aulas={aulas}
              turmas={turmas}
              cursos={cursos}
              professores={professores}
              disciplinas={disciplinas}
              espacos={espacos}
              slots={slots}
              recarregarAulas={buscarAulas}
            />
          )}
        </>
      )}
    </div>
  );
}
