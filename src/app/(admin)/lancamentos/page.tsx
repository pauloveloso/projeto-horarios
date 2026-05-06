"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

import ModoPlanilha from "./components/ModoPlanilha";
import ModoGrade from "./components/ModoGrade";

export default function LancamentosPage() {
  const [modoAtivo, setModoAtivo] = useState<"PLANILHA" | "GRADE">("PLANILHA");
  const [carregando, setCarregando] = useState(true);

  const [aulas, setAulas] = useState<any[]>([]);
  const [turmas, setTurmas] = useState<any[]>([]);
  const [cursos, setCursos] = useState<any[]>([]); // NOVA VARIÁVEL DE ESTADO
  const [professores, setProfessores] = useState<any[]>([]);
  const [disciplinas, setDisciplinas] = useState<any[]>([]);
  const [espacos, setEspacos] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);

  const buscarAulas = async () => {
    const { data } = await supabase.from("aulas").select("*");
    if (data) setAulas(data);
  };

  useEffect(() => {
    let montado = true;

    const buscarDadosMestres = async () => {
      setCarregando(true);
      try {
        const [
          { data: dTurmas },
          { data: dCursos }, // BUSCANDO OS CURSOS
          { data: dProfessores },
          { data: dDisciplinas },
          { data: dEspacos },
          { data: dSlots },
          { data: dAulas },
        ] = await Promise.all([
          supabase.from("turmas").select("*").order("codigo"),
          supabase.from("cursos").select("*"), // NOVA BUSCA
          supabase.from("professores").select("*").order("nome"),
          supabase.from("disciplinas").select("*").order("nome"),
          supabase.from("espacos").select("*").order("nome"),
          supabase.from("slots_horarios").select("*").order("hora_inicio"),
          supabase.from("aulas").select("*"),
        ]);

        if (!montado) return;

        if (dTurmas) setTurmas(dTurmas);
        if (dCursos) setCursos(dCursos);
        if (dProfessores) setProfessores(dProfessores);
        if (dDisciplinas) setDisciplinas(dDisciplinas);
        if (dEspacos) setEspacos(dEspacos);
        if (dSlots) setSlots(dSlots);
        if (dAulas) setAulas(dAulas);
      } catch (error) {
        console.error("Erro ao montar o sistema:", error);
      } finally {
        if (montado) setCarregando(false);
      }
    };

    buscarDadosMestres();

    // ========================================================================
    // CANAL ÚNICO DE SINCRONIZAÇÃO (Com Proteção contra Duplicidade)
    // ========================================================================
    const canalSincronizacao = supabase
      .channel("painel_lancamentos_ifnmg")

      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "aulas" },
        (payload) => {
          setAulas((listaAntiga) => {
            if (payload.eventType === "UPDATE") {
              return listaAntiga.map((a) =>
                String(a.id) === String(payload.new.id) ? payload.new : a,
              );
            }
            if (payload.eventType === "INSERT") {
              // PROTEÇÃO DE CORRIDA: Verifica se a aula já foi carregada pela função recarregarAulas()
              const jaExiste = listaAntiga.some(
                (a) => String(a.id) === String(payload.new.id),
              );
              if (jaExiste) return listaAntiga; // Se já existe, ignora o WebSocket

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
              // PROTEÇÃO DE CORRIDA PARA PROFESSORES
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
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100 gap-4">
        <div>
          <h1 className="text-2xl font-black text-green-800">
            Quadro de Horários
          </h1>
          <p className="text-sm text-gray-500 font-medium">
            Gestão acadêmica do semestre
          </p>
        </div>

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

      {modoAtivo === "PLANILHA" && (
        <ModoPlanilha
          aulas={aulas}
          turmas={turmas}
          cursos={cursos} // REPASSANDO OS CURSOS PARA A PLANILHA
          professores={professores}
          disciplinas={disciplinas}
          espacos={espacos}
          slots={slots}
          recarregarAulas={buscarAulas}
        />
      )}

      {modoAtivo === "GRADE" && (
        <ModoGrade
          aulas={aulas}
          turmas={turmas}
          cursos={cursos} // REPASSANDO PARA A GRADE
          professores={professores}
          disciplinas={disciplinas}
          espacos={espacos}
          slots={slots}
          recarregarAulas={buscarAulas}
        />
      )}
    </div>
  );
}
