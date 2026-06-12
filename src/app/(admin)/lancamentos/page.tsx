"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

import ModoPlanilha from "./components/ModoPlanilha";
import ModoGrade from "./components/ModoGrade";

export default function LancamentosPage() {
  const [modoAtivo, setModoAtivo] = useState<"PLANILHA" | "GRADE">("PLANILHA");
  const [carregando, setCarregando] = useState(true);

  const versaoRascunhoRef = useRef<any>(null);
  const [versaoRascunho, setVersaoRascunho] = useState<any>(null);

  const [aulas, setAulas] = useState<any[]>([]);
  const [choques, setChoques] = useState<any[]>([]);

  const [turmas, setTurmas] = useState<any[]>([]);
  const [cursos, setCursos] = useState<any[]>([]);
  const [professores, setProfessores] = useState<any[]>([]);
  const [disciplinas, setDisciplinas] = useState<any[]>([]);
  const [espacos, setEspacos] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]); // NOVA STATE

  const atualizarRascunho = (val: any) => {
    versaoRascunhoRef.current = val;
    setVersaoRascunho(val);
  };

  const buscarChoques = async () => {
    const rascunhoId = versaoRascunhoRef.current?.id;
    if (!rascunhoId) return;

    console.time("⏱️ Gargalo 2: Tempo da View de Choques");

    const { data, error } = await supabase
      .from("vw_choques_horarios")
      .select("*")
      .eq("versao_id", rascunhoId);

    if (error) {
      console.error("🚨 Erro na View de Choques:", error.message);
    }

    if (data) {
      setChoques(data.filter((c) => c.tipo_choque !== "CARGA_HORARIA"));
    }
    console.timeEnd("⏱️ Gargalo 2: Tempo da View de Choques");
  };

  const buscarAulas = async (cargaInicial = false) => {
    if (!versaoRascunhoRef.current) return;

    if (cargaInicial) {
      console.time("⏱️ Gargalo 1: Busca de Aulas (Carga Inicial)");
      const requisicaoAulas = supabase
        .from("aulas")
        .select("*")
        .eq("versao_id", versaoRascunhoRef.current.id)
        .limit(5000)
        .then(({ data }) => {
          if (data) setAulas(data);
          console.timeEnd("⏱️ Gargalo 1: Busca de Aulas (Carga Inicial)");
        });

      const requisicaoChoques = buscarChoques();
      await Promise.all([requisicaoAulas, requisicaoChoques]);
    } else {
      console.log("🟢 buscarAulas(false) foi acionado pelo componente filho!");
      console.time("⏱️ Gargalo 3: Tempo Recarga de Fundo (Apenas Choques)");
      buscarChoques().finally(() => {
        console.timeEnd(
          "⏱️ Gargalo 3: Tempo Recarga de Fundo (Apenas Choques)",
        );
      });
    }
  };

  // ========================================================================
  // EFEITO 1: INICIALIZAÇÃO
  // ========================================================================
  useEffect(() => {
    let montado = true;

    const inicializarDadosMestres = async () => {
      setCarregando(true);
      try {
        const { data: dVersoes } = await supabase
          .from("versoes_grade")
          .select("*")
          .eq("status", "RASCUNHO")
          .limit(1);

        const rascunho = dVersoes && dVersoes.length > 0 ? dVersoes[0] : null;

        const [
          { data: dTurmas },
          { data: dCursos },
          { data: dProfessores },
          { data: dDisciplinas },
          { data: dEspacos },
          { data: dSlots },
          { data: dCategorias }, // FETCH DE CATEGORIAS
        ] = await Promise.all([
          supabase.from("turmas").select("*").order("codigo").limit(2000),
          supabase.from("cursos").select("*"),
          supabase.from("professores").select("*").order("nome").limit(1000),
          supabase.from("disciplinas").select("*").order("nome").limit(5000),
          supabase.from("espacos").select("*").order("nome").limit(1000),
          supabase.from("slots_horarios").select("*").order("hora_inicio"),
          supabase.from("categorias_espacos").select("*").order("nome"),
        ]);

        if (!montado) return;

        if (dTurmas) setTurmas(dTurmas);
        if (dCursos) setCursos(dCursos);
        if (dProfessores) setProfessores(dProfessores);
        if (dDisciplinas) setDisciplinas(dDisciplinas);
        if (dEspacos) setEspacos(dEspacos);
        if (dSlots) setSlots(dSlots);
        if (dCategorias) setCategorias(dCategorias);

        if (rascunho) {
          atualizarRascunho(rascunho);
        } else {
          setCarregando(false);
        }
      } catch (error) {
        console.error("Erro na inicialização:", error);
        if (montado) setCarregando(false);
      }
    };

    inicializarDadosMestres();

    const canalProfessores = supabase
      .channel("lancamentos_professores")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "professores" },
        () => {
          supabase
            .from("professores")
            .select("*")
            .order("nome")
            .limit(1000)
            .then(({ data }) => {
              if (data && montado) setProfessores(data);
            });
        },
      )
      .subscribe();

    return () => {
      montado = false;
      supabase.removeChannel(canalProfessores);
    };
  }, []);

  // ========================================================================
  // EFEITO 2: ATUALIZAÇÃO OTIMISTA (Velocidade Extrema RAM + WebSocket)
  // ========================================================================
  useEffect(() => {
    if (!versaoRascunho) return;

    let montado = true;
    let timeoutDebounce: ReturnType<typeof setTimeout>;

    buscarAulas(true).finally(() => {
      if (montado) setCarregando(false);
    });

    const idAba = Math.random().toString(36).substring(7);
    const canalAulas = supabase
      .channel(`aulas_${idAba}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "aulas" },
        (payload) => {
          if (!montado) return;

          console.log(`🔔 WebSocket Chegou: [${payload.eventType}]`);
          console.time("⏱️ Gargalo 4: Processar Memória RAM");

          const rascunhoId = versaoRascunhoRef.current?.id;

          setAulas((prevAulas) => {
            let novasAulas = [...prevAulas];

            if (payload.eventType === "INSERT") {
              if (String(payload.new.versao_id) === String(rascunhoId)) {
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
              if (String(payload.new.versao_id) === String(rascunhoId)) {
                const index = novasAulas.findIndex(
                  (a) => String(a.id) === String(payload.new.id),
                );
                if (index !== -1) novasAulas[index] = payload.new;
                else novasAulas.push(payload.new);
              } else {
                novasAulas = novasAulas.filter(
                  (a) => String(a.id) !== String(payload.new.id),
                );
              }
            }
            return novasAulas;
          });

          console.timeEnd("⏱️ Gargalo 4: Processar Memória RAM");

          clearTimeout(timeoutDebounce);
          timeoutDebounce = setTimeout(() => {
            if (montado) {
              console.log(
                "🔔 Disparando recálculo de choques após debounce do WebSocket...",
              );
              buscarChoques();
            }
          }, 300);
        },
      )
      .subscribe();

    return () => {
      montado = false;
      clearTimeout(timeoutDebounce);
      supabase.removeChannel(canalAulas);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versaoRascunho]);

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
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100 gap-4">
        <div>
          <h1 className="text-2xl font-black text-green-800">
            Quadro de Horários
          </h1>
          <p className="text-sm text-gray-500 font-medium">
            Gestão acadêmica do semestre
          </p>
        </div>

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
              versaoId={versaoRascunho.id}
              aulas={aulas}
              choques={choques}
              turmas={turmas}
              cursos={cursos}
              professores={professores}
              disciplinas={disciplinas}
              espacos={espacos}
              slots={slots}
              categorias={categorias}
              recarregarAulas={() => buscarAulas(false)}
            />
          )}

          {modoAtivo === "GRADE" && (
            <ModoGrade
              versaoId={versaoRascunho.id}
              aulas={aulas}
              choques={choques}
              turmas={turmas}
              cursos={cursos}
              professores={professores}
              disciplinas={disciplinas}
              espacos={espacos}
              slots={slots}
              categorias={categorias}
              recarregarAulas={() => buscarAulas(false)}
            />
          )}
        </>
      )}
    </div>
  );
}
