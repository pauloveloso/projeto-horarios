"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function DashboardPage() {
  const [carregando, setCarregando] = useState(true);

  // Estados para controlar a versão
  const [versoes, setVersoes] = useState<any[]>([]);
  const [versaoSelecionada, setVersaoSelecionada] = useState<string>("");

  const [metricas, setMetricas] = useState({
    totalAulas: 0,
    semProfessor: 0,
    semSala: 0,
    totalConflitos: 0,
  });

  const [choquesCriticos, setChoquesCriticos] = useState<any[]>([]);
  const [alertasSecundarios, setAlertasSecundarios] = useState<any[]>([]);

  // Carrega as versões primeiro
  useEffect(() => {
    async function carregarVersoes() {
      const { data } = await supabase
        .from("versoes_grade")
        .select("*")
        .order("data_inicio_vigencia", { ascending: false });

      if (data && data.length > 0) {
        setVersoes(data);

        // Tenta achar um rascunho primeiro. Se não, pega a versão publicada atual
        const rascunho = data.find((v) => v.status === "RASCUNHO");
        if (rascunho) {
          setVersaoSelecionada(rascunho.id);
        } else {
          const hoje = new Date().toISOString().split("T")[0];
          const ativa =
            data.find(
              (v) => v.status === "PUBLICADA" && v.data_inicio_vigencia <= hoje,
            ) || data[0];
          setVersaoSelecionada(ativa.id);
        }
      } else {
        setCarregando(false);
      }
    }
    carregarVersoes();
  }, []);

  // Modificado para carregar os dados sempre que a versão for alterada
  useEffect(() => {
    if (versaoSelecionada) {
      carregarDadosEDiagnosticar();
    }
  }, [versaoSelecionada]);

  const carregarDadosEDiagnosticar = async () => {
    setCarregando(true);
    try {
      const [
        { data: aulas },
        { data: turmas },
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
        supabase.from("turmas").select("*").limit(2000),
        supabase.from("professores").select("*").limit(1000),
        supabase.from("disciplinas").select("*").limit(5000),
        supabase.from("espacos").select("*").limit(1000),
        supabase.from("slots_horarios").select("*"),
      ]);

      if (!aulas || !slots) return;
      diagnosticarGrade(
        aulas,
        turmas || [],
        professores || [],
        disciplinas || [],
        espacos || [],
        slots,
      );
    } catch (error) {
      console.error("Erro ao carregar dashboard:", error);
    } finally {
      setCarregando(false);
    }
  };

  const getNome = (lista: any[], id: string, campo: string = "nome") => {
    const item = lista.find((i) => String(i.id) === String(id));
    return item ? item[campo] || item.codigo : "Desconhecido";
  };

  const diagnosticarGrade = (
    aulas: any[],
    turmas: any[],
    professores: any[],
    disciplinas: any[],
    espacos: any[],
    slots: any[],
  ) => {
    const aulasAlocadas = aulas.filter(
      (a) => a.dia_semana && a.slot_horario_id && a.turma_id && a.disciplina_id,
    );

    let semProf = 0;
    let semSala = 0;
    let criticos: any[] = [];
    let secundarios: any[] = [];

    const formatarHorario = (dia: string, slotId: string) => {
      const slot = slots.find((s) => String(s.id) === String(slotId));
      return `${dia} às ${slot ? slot.hora_inicio.substring(0, 5) : ""}`;
    };

    aulasAlocadas.forEach((aulaAtual, index) => {
      if (!aulaAtual.professor_id) semProf++;
      if (!aulaAtual.espaco_id) semSala++;

      if (aulaAtual.professor_id) {
        const prof = professores.find(
          (p) => String(p.id) === String(aulaAtual.professor_id),
        );
        if (
          prof &&
          String(prof.dia_planejamento).toUpperCase() ===
            String(aulaAtual.dia_semana).toUpperCase()
        ) {
          secundarios.push({
            tipo: "Dia de Planejamento",
            msg: `Professor(a) ${prof.nome} está alocado(a) no dia de planejamento (${aulaAtual.dia_semana}).`,
            local: `Turma ${getNome(turmas, aulaAtual.turma_id, "codigo")} - ${getNome(disciplinas, aulaAtual.disciplina_id)}`,
          });
        }
      }

      for (let i = index + 1; i < aulasAlocadas.length; i++) {
        const outraAula = aulasAlocadas[i];
        if (
          aulaAtual.dia_semana === outraAula.dia_semana &&
          String(aulaAtual.slot_horario_id) ===
            String(outraAula.slot_horario_id)
        ) {
          const horarioStr = formatarHorario(
            aulaAtual.dia_semana,
            aulaAtual.slot_horario_id,
          );

          if (
            aulaAtual.espaco_id &&
            String(aulaAtual.espaco_id) === String(outraAula.espaco_id) &&
            String(aulaAtual.turma_id) !== String(outraAula.turma_id)
          ) {
            criticos.push({
              tipo: "Choque de Sala",
              msg: `${getNome(espacos, aulaAtual.espaco_id)} ocupada por duas turmas.`,
              detalhe: `${getNome(turmas, aulaAtual.turma_id, "codigo")} e ${getNome(turmas, outraAula.turma_id, "codigo")} (${horarioStr})`,
            });
          }
          if (
            aulaAtual.professor_id &&
            String(aulaAtual.professor_id) === String(outraAula.professor_id) &&
            String(aulaAtual.turma_id) !== String(outraAula.turma_id)
          ) {
            criticos.push({
              tipo: "Choque de Professor",
              msg: `Prof(a). ${getNome(professores, aulaAtual.professor_id)} em duas turmas.`,
              detalhe: `${getNome(turmas, aulaAtual.turma_id, "codigo")} e ${getNome(turmas, outraAula.turma_id, "codigo")} (${horarioStr})`,
            });
          }
          if (
            String(aulaAtual.turma_id) === String(outraAula.turma_id) &&
            String(aulaAtual.disciplina_id) !== String(outraAula.disciplina_id)
          ) {
            criticos.push({
              tipo: "Choque na Turma",
              msg: `Turma ${getNome(turmas, aulaAtual.turma_id, "codigo")} com duas matérias.`,
              detalhe: `${getNome(disciplinas, aulaAtual.disciplina_id)} e ${getNome(disciplinas, outraAula.disciplina_id)} (${horarioStr})`,
            });
          }
        }
      }
    });

    const criticosUnicos = Array.from(
      new Set(criticos.map((c) => JSON.stringify(c))),
    ).map((s) => JSON.parse(s));
    const secUnicos = Array.from(
      new Set(secundarios.map((c) => JSON.stringify(c))),
    ).map((s) => JSON.parse(s));

    setChoquesCriticos(criticosUnicos);
    setAlertasSecundarios(secUnicos);
    setMetricas({
      totalAulas: aulasAlocadas.length,
      semProfessor: semProf,
      semSala: semSala,
      totalConflitos: criticosUnicos.length,
    });
  };

  // Funções para agrupar os arrays por tipo
  const agruparPorTipo = (lista: any[]) => {
    return lista.reduce((acc: any, curr: any) => {
      if (!acc[curr.tipo]) acc[curr.tipo] = [];
      acc[curr.tipo].push(curr);
      return acc;
    }, {});
  };

  const criticosAgrupados = agruparPorTipo(choquesCriticos);
  const alertasAgrupados = agruparPorTipo(alertasSecundarios);

  if (carregando && !versaoSelecionada) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 relative">
      {/* Loading Overlay suave ao trocar de versão */}
      {carregando && versaoSelecionada && (
        <div className="absolute inset-0 z-10 bg-white/50 backdrop-blur-sm flex items-center justify-center rounded-xl">
          <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {/* CABEÇALHO PADRÃO DO SISTEMA COM SELETOR */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-green-800">
            Painel do Gestor
          </h1>
          <p className="text-sm text-gray-500 font-medium mt-1">
            Visão estratégica da grade de horários do campus.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          {versoes.length > 0 && (
            <select
              value={versaoSelecionada}
              onChange={(e) => setVersaoSelecionada(e.target.value)}
              className="bg-gray-50 border border-gray-200 text-gray-700 text-sm font-bold rounded px-3 py-2.5 outline-none focus:ring-2 focus:ring-green-600 w-full sm:w-auto cursor-pointer"
            >
              {versoes.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nome} - {v.semestre}{" "}
                  {v.status === "RASCUNHO" ? "(Rascunho)" : ""}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={carregarDadosEDiagnosticar}
            className="bg-green-600 text-white px-5 py-2.5 rounded shadow-sm text-sm font-bold hover:bg-green-700 transition-colors shrink-0 w-full sm:w-auto flex justify-center gap-2"
          >
            <span>🔄</span> Atualizar Dados
          </button>
        </div>
      </div>

      {/* METRICAS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
          <span className="text-[10px] font-black uppercase text-gray-400">
            Total Alocado
          </span>
          <div className="text-3xl font-black text-green-800">
            {metricas.totalAulas}
          </div>
        </div>
        <div
          className={`p-5 rounded-xl border shadow-sm ${metricas.totalConflitos > 0 ? "bg-red-50 border-red-100" : "bg-white border-gray-100"}`}
        >
          <span className="text-[10px] font-black uppercase text-gray-400">
            Choques Críticos
          </span>
          <div
            className={`text-3xl font-black ${metricas.totalConflitos > 0 ? "text-red-600" : "text-gray-800"}`}
          >
            {metricas.totalConflitos}
          </div>
        </div>
        <div
          className={`p-5 rounded-xl border shadow-sm ${metricas.semProfessor > 0 ? "bg-yellow-50 border-yellow-100" : "bg-white border-gray-100"}`}
        >
          <span className="text-[10px] font-black uppercase text-gray-400">
            Vagas (Sem Prof)
          </span>
          <div className="text-3xl font-black text-gray-800">
            {metricas.semProfessor}
          </div>
        </div>
        <div
          className={`p-5 rounded-xl border shadow-sm ${metricas.semSala > 0 ? "bg-orange-50 border-orange-100" : "bg-white border-gray-100"}`}
        >
          <span className="text-[10px] font-black uppercase text-gray-400">
            Sem Espaço
          </span>
          <div className="text-3xl font-black text-gray-800">
            {metricas.semSala}
          </div>
        </div>
      </div>

      {/* ACESSO RÁPIDO - RELATÓRIOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/relatorios/professores"
          className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:border-blue-300 hover:shadow-md transition-all flex items-center gap-5 group cursor-pointer"
        >
          <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center text-3xl group-hover:bg-blue-100 transition-colors shrink-0">
            👨‍🏫
          </div>
          <div>
            <h3 className="font-black text-gray-800 group-hover:text-blue-700 transition-colors text-lg">
              Carga Horária Docente
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Acompanhamento completo de distribuição de aulas e horas.
            </p>
          </div>
        </Link>

        <Link
          href="/relatorios/ocupacao-salas"
          className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:border-green-300 hover:shadow-md transition-all flex items-center gap-5 group cursor-pointer"
        >
          <div className="w-14 h-14 bg-green-50 rounded-xl flex items-center justify-center text-3xl group-hover:bg-green-100 transition-colors shrink-0">
            🏢
          </div>
          <div>
            <h3 className="font-black text-gray-800 group-hover:text-green-700 transition-colors text-lg">
              Ocupação de Salas
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Consolidado físico de espaços e infraestrutura por categoria.
            </p>
          </div>
        </Link>
      </div>

      {/* BLOCO LADO A LADO: IMPEDIMENTOS E ALERTAS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* BLOCO CRÍTICO */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
            <h2 className="font-bold text-gray-700 flex items-center gap-2">
              <span className="text-red-600">⛔</span> Impedimentos Físicos
            </h2>
            <span className="bg-red-100 text-red-700 font-black text-xs px-2 py-1 rounded-full">
              {choquesCriticos.length}
            </span>
          </div>

          <div className="h-[450px] overflow-y-auto custom-scrollbar bg-white">
            {choquesCriticos.length === 0 ? (
              <div className="p-10 text-center text-gray-400 font-medium h-full flex flex-col items-center justify-center">
                <span className="text-4xl mb-2 opacity-50">👍</span>
                Nenhum choque detectado.
              </div>
            ) : (
              Object.keys(criticosAgrupados)
                .sort()
                .map((tipo, tIdx) => (
                  <div
                    key={tIdx}
                    className="border-b border-gray-100 last:border-0"
                  >
                    <div className="bg-red-50/50 px-4 py-2 text-xs font-black text-red-800 uppercase tracking-widest border-b border-red-100/50 sticky top-0 z-10 backdrop-blur-sm shadow-sm flex justify-between items-center">
                      <span>{tipo}</span>
                      <span className="bg-white text-red-600 px-2 py-0.5 rounded-full border border-red-200 text-[10px]">
                        {criticosAgrupados[tipo].length}
                      </span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {criticosAgrupados[tipo].map(
                        (choque: any, idx: number) => (
                          <div
                            key={idx}
                            className="p-4 hover:bg-red-50/30 transition-colors"
                          >
                            <p className="font-bold text-gray-800 text-sm">
                              {choque.msg}
                            </p>
                            <p className="text-[11px] font-bold text-red-600 mt-1 uppercase tracking-wider">
                              {choque.detalhe}
                            </p>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>

        {/* BLOCO PEDAGÓGICO */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
            <h2 className="font-bold text-gray-700 flex items-center gap-2">
              <span className="text-yellow-500">⚠️</span> Alertas de
              Planejamento
            </h2>
            <span className="bg-yellow-100 text-yellow-700 font-black text-xs px-2 py-1 rounded-full">
              {alertasSecundarios.length}
            </span>
          </div>

          <div className="h-[450px] overflow-y-auto custom-scrollbar bg-white">
            {alertasSecundarios.length === 0 ? (
              <div className="p-10 text-center text-gray-400 font-medium h-full flex flex-col items-center justify-center">
                <span className="text-4xl mb-2 opacity-50">✨</span>
                Nenhum alerta pedagógico.
              </div>
            ) : (
              Object.keys(alertasAgrupados)
                .sort()
                .map((tipo, tIdx) => (
                  <div
                    key={tIdx}
                    className="border-b border-gray-100 last:border-0"
                  >
                    <div className="bg-yellow-50/50 px-4 py-2 text-xs font-black text-yellow-800 uppercase tracking-widest border-b border-yellow-100/50 sticky top-0 z-10 backdrop-blur-sm shadow-sm flex justify-between items-center">
                      <span>{tipo}</span>
                      <span className="bg-white text-yellow-600 px-2 py-0.5 rounded-full border border-yellow-200 text-[10px]">
                        {alertasAgrupados[tipo].length}
                      </span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {alertasAgrupados[tipo].map(
                        (alerta: any, idx: number) => (
                          <div
                            key={idx}
                            className="p-4 hover:bg-yellow-50/30 transition-colors"
                          >
                            <p className="font-bold text-gray-800 text-sm">
                              {alerta.msg}
                            </p>
                            <p className="text-[11px] text-gray-500 font-bold mt-1 uppercase italic">
                              {alerta.local}
                            </p>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
