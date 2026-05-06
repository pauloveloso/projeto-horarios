"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export default function CursosPage() {
  const [carregando, setCarregando] = useState(true);

  // Estados de Dados
  const [cursos, setCursos] = useState<any[]>([]);
  const [turmas, setTurmas] = useState<any[]>([]);
  const [cursoSelecionado, setCursoSelecionado] = useState<string | null>(null);

  // Estados de Modais
  const [modalCurso, setModalCurso] = useState(false);
  const [dadosCurso, setDadosCurso] = useState<any>({
    id: null,
    nome: "",
    modalidade: "INTEGRADO",
    cor_identificacao: "#d1fae5",
  });

  const [modalTurma, setModalTurma] = useState(false);
  const [dadosTurma, setDadosTurma] = useState<any>({
    id: null,
    codigo: "",
    turno_padrao: "MANHA",
  });

  // ==========================================================================
  // BUSCA DE DADOS E WEBSOCKET
  // ==========================================================================
  const recarregarDados = async () => {
    try {
      const [{ data: dCursos }, { data: dTurmas }] = await Promise.all([
        supabase.from("cursos").select("*").order("nome"),
        supabase.from("turmas").select("*").order("codigo"),
      ]);

      if (dCursos) setCursos(dCursos);
      if (dTurmas) setTurmas(dTurmas);
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
    }
  };

  useEffect(() => {
    let montado = true;

    const cargaInicial = async () => {
      setCarregando(true);
      await recarregarDados();
      if (montado) setCarregando(false);
    };

    cargaInicial();

    const idCanal = Math.random().toString(36).substring(7);
    const canal = supabase
      .channel(`sinc_cursos_turmas_${idCanal}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cursos" },
        (payload) => {
          setCursos((listaAntiga) => {
            if (payload.eventType === "UPDATE")
              return listaAntiga.map((c) =>
                String(c.id) === String(payload.new.id) ? payload.new : c,
              );
            if (payload.eventType === "INSERT") {
              const jaExiste = listaAntiga.some(
                (c) => String(c.id) === String(payload.new.id),
              );
              if (jaExiste) return listaAntiga;
              return [...listaAntiga, payload.new].sort((a, b) =>
                a.nome.localeCompare(b.nome),
              );
            }
            if (payload.eventType === "DELETE")
              return listaAntiga.filter(
                (c) => String(c.id) !== String(payload.old.id),
              );
            return listaAntiga;
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "turmas" },
        (payload) => {
          setTurmas((listaAntiga) => {
            if (payload.eventType === "UPDATE")
              return listaAntiga.map((t) =>
                String(t.id) === String(payload.new.id) ? payload.new : t,
              );
            if (payload.eventType === "INSERT") {
              const jaExiste = listaAntiga.some(
                (t) => String(t.id) === String(payload.new.id),
              );
              if (jaExiste) return listaAntiga;
              return [...listaAntiga, payload.new].sort((a, b) =>
                a.codigo.localeCompare(b.codigo),
              );
            }
            if (payload.eventType === "DELETE")
              return listaAntiga.filter(
                (t) => String(t.id) !== String(payload.old.id),
              );
            return listaAntiga;
          });
        },
      )
      .subscribe();

    return () => {
      montado = false;
      supabase.removeChannel(canal);
    };
  }, []);

  // ==========================================================================
  // FUNÇÕES DE CRUD - CURSOS
  // ==========================================================================
  const abrirModalCurso = (curso: any = null) => {
    if (curso) {
      setDadosCurso({ ...curso });
    } else {
      setDadosCurso({
        id: null,
        nome: "",
        modalidade: "INTEGRADO",
        cor_identificacao: "#dbeafe",
      });
    }
    setModalCurso(true);
  };

  const salvarCurso = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      nome: dadosCurso.nome.trim(),
      modalidade: dadosCurso.modalidade,
      cor_identificacao: dadosCurso.cor_identificacao,
    };

    const id = dadosCurso.id;

    const { error } = id
      ? await supabase.from("cursos").update(payload).eq("id", id)
      : await supabase.from("cursos").insert(payload);

    if (error) {
      alert("Erro real do banco ao salvar curso:\n" + error.message);
      console.error(error);
    } else {
      setModalCurso(false);
      recarregarDados(); // Atualiza a tela silenciosamente
    }
  };

  const excluirCurso = async (id: string) => {
    const turmasVinculadas = turmas.filter((t) => t.curso_id === id);
    if (turmasVinculadas.length > 0) {
      alert(
        `Não é possível excluir este curso pois existem ${turmasVinculadas.length} turma(s) vinculada(s) a ele. Exclua as turmas primeiro.`,
      );
      return;
    }
    if (!confirm("Tem certeza que deseja excluir este curso permanentemente?"))
      return;

    const { error } = await supabase.from("cursos").delete().eq("id", id);
    if (!error) {
      if (cursoSelecionado === id) setCursoSelecionado(null);
      recarregarDados(); // Atualiza a tela silenciosamente
    } else {
      alert("Erro ao excluir curso:\n" + error.message);
    }
  };

  // ==========================================================================
  // FUNÇÕES DE CRUD - TURMAS
  // ==========================================================================
  const abrirModalTurma = (turma: any = null) => {
    if (turma) {
      setDadosTurma({ ...turma });
    } else {
      setDadosTurma({
        id: null,
        codigo: "",
        turno_padrao: "MANHA",
        curso_id: cursoSelecionado,
      });
    }
    setModalTurma(true);
  };

  const salvarTurma = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      codigo: dadosTurma.codigo.trim().toUpperCase(),
      curso_id: cursoSelecionado,
      turno_padrao: dadosTurma.turno_padrao,
    };

    const id = dadosTurma.id;

    const { error } = id
      ? await supabase.from("turmas").update(payload).eq("id", id)
      : await supabase.from("turmas").insert(payload);

    if (error) {
      alert("Erro real do banco ao salvar turma:\n" + error.message);
      console.error(error);
    } else {
      setModalTurma(false);
      recarregarDados(); // Atualiza a tela silenciosamente
    }
  };

  const excluirTurma = async (id: string) => {
    if (
      !confirm(
        "Tem certeza que deseja excluir esta turma? As aulas vinculadas a ela também poderão ser afetadas.",
      )
    )
      return;

    const { error } = await supabase.from("turmas").delete().eq("id", id);
    if (!error) {
      recarregarDados(); // Atualiza a tela silenciosamente
    } else {
      alert("Erro ao excluir turma:\n" + error.message);
    }
  };

  // ==========================================================================
  // RENDERIZAÇÃO DA TELA
  // ==========================================================================
  if (carregando) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const turmasDoCurso = turmas.filter((t) => t.curso_id === cursoSelecionado);
  const cursoAtual = cursos.find((c) => c.id === cursoSelecionado);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h1 className="text-2xl font-black text-green-800">Cursos e Turmas</h1>
        <p className="text-sm text-gray-500 font-medium mt-1">
          Gerencie as estruturas acadêmicas do campus e a identidade visual na
          grade.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* LADO ESQUERDO: LISTA DE CURSOS */}
        <div className="md:col-span-5 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
            <h2 className="font-bold text-gray-700">
              Cursos ({cursos.length})
            </h2>
            <button
              onClick={() => abrirModalCurso()}
              className="bg-green-600 text-white px-3 py-1.5 rounded text-sm font-bold shadow hover:bg-green-700 transition-colors"
            >
              + Novo Curso
            </button>
          </div>
          <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
            {cursos.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-4">
                Nenhum curso cadastrado.
              </p>
            )}

            {cursos.map((curso) => (
              <div
                key={curso.id}
                onClick={() => setCursoSelecionado(curso.id)}
                className={`p-3 rounded-lg border cursor-pointer transition-all flex justify-between items-center group ${
                  cursoSelecionado === curso.id
                    ? "border-green-500 bg-green-50 ring-1 ring-green-500"
                    : "border-gray-200 hover:border-green-300 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-5 h-5 rounded-full border border-gray-300 shadow-inner flex-shrink-0"
                    style={{ backgroundColor: curso.cor_identificacao }}
                  ></div>
                  <div className="overflow-hidden">
                    <p className="font-bold text-gray-800 text-sm truncate">
                      {curso.nome}
                    </p>
                    <p className="text-xs text-gray-500 uppercase font-medium">
                      {curso.modalidade}
                    </p>
                  </div>
                </div>

                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      abrirModalCurso(curso);
                    }}
                    className="p-1.5 text-blue-600 hover:bg-blue-100 rounded"
                    title="Editar"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      excluirCurso(curso.id);
                    }}
                    className="p-1.5 text-red-600 hover:bg-red-100 rounded"
                    title="Excluir"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* LADO DIREITO: LISTA DE TURMAS */}
        <div className="md:col-span-7 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden min-h-[400px] flex flex-col">
          {!cursoSelecionado ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
              <span className="text-6xl mb-4">👈</span>
              <p className="text-lg font-bold text-gray-500">
                Selecione um curso ao lado
              </p>
              <p className="text-sm mt-2">
                Para visualizar e gerenciar as turmas vinculadas a ele.
              </p>
            </div>
          ) : (
            <>
              <div
                className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center"
                style={{
                  borderTop: `4px solid ${cursoAtual?.cor_identificacao}`,
                }}
              >
                <div>
                  <h2 className="font-bold text-gray-700 text-lg">
                    Turmas Vinculadas
                  </h2>
                  <p className="text-sm text-gray-500">{cursoAtual?.nome}</p>
                </div>
                <button
                  onClick={() => abrirModalTurma()}
                  className="bg-green-600 text-white px-4 py-2 rounded shadow text-sm font-bold hover:bg-green-700 transition-colors"
                >
                  + Nova Turma
                </button>
              </div>

              <div className="p-0 overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white border-b border-gray-200 text-sm uppercase tracking-wider text-gray-500">
                      <th className="p-4 font-bold">Código da Turma</th>
                      <th className="p-4 font-bold">Turno Padrão</th>
                      <th className="p-4 text-right font-bold w-24">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="text-base text-gray-700 divide-y divide-gray-100">
                    {turmasDoCurso.length === 0 && (
                      <tr>
                        <td
                          colSpan={3}
                          className="p-8 text-center text-gray-400"
                        >
                          Nenhuma turma cadastrada neste curso.
                        </td>
                      </tr>
                    )}
                    {turmasDoCurso.map((turma) => (
                      <tr
                        key={turma.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="p-4 font-bold">{turma.codigo}</td>
                        <td className="p-4">
                          <span className="bg-gray-100 border border-gray-200 text-gray-600 text-xs px-2.5 py-1 rounded-full font-bold uppercase">
                            {turma.turno_padrao}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => abrirModalTurma(turma)}
                              className="text-blue-600 hover:bg-blue-50 p-2 rounded transition-colors"
                              title="Editar"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => excluirTurma(turma.id)}
                              className="text-red-600 hover:bg-red-50 p-2 rounded transition-colors"
                              title="Excluir"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* MODAL DE CURSO */}
      {modalCurso && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <form onSubmit={salvarCurso}>
              <div className="bg-green-700 text-white px-6 py-4 flex justify-between items-center">
                <h3 className="font-bold text-xl">
                  {dadosCurso.id ? "Editar Curso" : "Novo Curso"}
                </h3>
                <button
                  type="button"
                  onClick={() => setModalCurso(false)}
                  className="hover:opacity-70 font-bold text-xl"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Nome do Curso
                  </label>
                  <input
                    required
                    type="text"
                    value={dadosCurso.nome}
                    onChange={(e) =>
                      setDadosCurso({ ...dadosCurso, nome: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded p-2 text-base outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Ex: Técnico em Informática Integrado"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Modalidade
                  </label>
                  <select
                    required
                    value={dadosCurso.modalidade}
                    onChange={(e) =>
                      setDadosCurso({
                        ...dadosCurso,
                        modalidade: e.target.value,
                      })
                    }
                    className="w-full border border-gray-300 rounded p-2 text-base outline-none focus:ring-2 focus:ring-green-500 bg-white"
                  >
                    <option value="INTEGRADO">Técnico Integrado</option>
                    <option value="SUBSEQUENTE">Subsequente</option>
                    <option value="CONCOMITANTE">
                      Concomitante / Subsequente
                    </option>
                    <option value="SUPERIOR">
                      Superior (Bacharelado/Licenciatura/Tecnólogo)
                    </option>
                    <option value="POS_GRADUACAO">Pós-Graduação</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Cor na Grade de Horários
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={dadosCurso.cor_identificacao}
                      onChange={(e) =>
                        setDadosCurso({
                          ...dadosCurso,
                          cor_identificacao: e.target.value,
                        })
                      }
                      className="w-12 h-12 p-1 border border-gray-300 rounded cursor-pointer"
                    />
                    <span className="text-sm text-gray-500 font-mono">
                      {dadosCurso.cor_identificacao}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Dica: Prefira cores em tons pastéis (claros) para não
                    atrapalhar a leitura do texto preto na planilha.
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setModalCurso(false)}
                  className="px-5 py-2 text-gray-600 hover:bg-gray-200 rounded font-bold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-green-600 text-white px-6 py-2 rounded font-bold shadow hover:bg-green-700 active:scale-95 transition-all"
                >
                  Salvar Curso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE TURMA */}
      {modalTurma && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <form onSubmit={salvarTurma}>
              <div
                className="bg-green-700 text-white px-6 py-4 flex justify-between items-center"
                style={{
                  backgroundColor: cursoAtual?.cor_identificacao,
                  color: "#1f2937",
                }}
              >
                <h3 className="font-bold text-xl">
                  {dadosTurma.id ? "Editar Turma" : "Nova Turma"}
                </h3>
                <button
                  type="button"
                  onClick={() => setModalTurma(false)}
                  className="hover:opacity-70 font-bold text-xl"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Curso Vinculado
                  </label>
                  <input
                    type="text"
                    disabled
                    value={cursoAtual?.nome || ""}
                    className="w-full border border-gray-200 rounded p-2 text-base bg-gray-100 text-gray-600 font-bold cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Código da Turma
                  </label>
                  <input
                    required
                    type="text"
                    value={dadosTurma.codigo}
                    onChange={(e) =>
                      setDadosTurma({
                        ...dadosTurma,
                        codigo: e.target.value.toUpperCase(),
                      })
                    }
                    className="w-full border border-gray-300 rounded p-2 text-base outline-none focus:ring-2 focus:ring-green-500 font-bold"
                    placeholder="Ex: 1INFOA, 3PBSI, 2º BADM"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Turno Padrão
                  </label>
                  <select
                    required
                    value={dadosTurma.turno_padrao}
                    onChange={(e) =>
                      setDadosTurma({
                        ...dadosTurma,
                        turno_padrao: e.target.value,
                      })
                    }
                    className="w-full border border-gray-300 rounded p-2 text-base outline-none focus:ring-2 focus:ring-green-500 bg-white"
                  >
                    <option value="MANHA">Manhã</option>
                    <option value="TARDE">Tarde</option>
                    <option value="NOITE">Noite</option>
                    <option value="INTEGRAL">Integral</option>
                  </select>
                </div>
              </div>

              <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setModalTurma(false)}
                  className="px-5 py-2 text-gray-600 hover:bg-gray-200 rounded font-bold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-green-600 text-white px-6 py-2 rounded font-bold shadow hover:bg-green-700 active:scale-95 transition-all"
                  style={{ backgroundColor: "#16a34a", color: "white" }}
                >
                  Salvar Turma
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
