"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function DisciplinasPage() {
  const [carregando, setCarregando] = useState(true);

  // Estados de Dados
  const [cursos, setCursos] = useState<any[]>([]);
  const [disciplinas, setDisciplinas] = useState<any[]>([]);
  const [cursoSelecionado, setCursoSelecionado] = useState<string | null>(null);

  // Estados do Modal
  const [modalDisciplina, setModalDisciplina] = useState(false);
  const [dadosDisciplina, setDadosDisciplina] = useState<any>({
    id: null,
    nome: "",
    sigla: "",
    carga_horaria_semanal: 2,
  });

  // ==========================================================================
  // BUSCA DE DADOS E WEBSOCKET
  // ==========================================================================
  const recarregarDados = async () => {
    try {
      const [{ data: dCursos }, { data: dDisciplinas }] = await Promise.all([
        supabase.from("cursos").select("*").order("nome"),
        supabase.from("disciplinas").select("*").order("nome"),
      ]);

      if (dCursos) setCursos(dCursos);
      if (dDisciplinas) setDisciplinas(dDisciplinas);
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
      .channel(`sinc_disciplinas_${idCanal}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "disciplinas" },
        (payload) => {
          setDisciplinas((listaAntiga) => {
            if (payload.eventType === "UPDATE")
              return listaAntiga.map((d) =>
                String(d.id) === String(payload.new.id) ? payload.new : d,
              );
            if (payload.eventType === "INSERT") {
              const jaExiste = listaAntiga.some(
                (d) => String(d.id) === String(payload.new.id),
              );
              if (jaExiste) return listaAntiga;
              return [...listaAntiga, payload.new].sort((a, b) =>
                a.nome.localeCompare(b.nome),
              );
            }
            if (payload.eventType === "DELETE")
              return listaAntiga.filter(
                (d) => String(d.id) !== String(payload.old.id),
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
  // FUNÇÕES DE CRUD - DISCIPLINAS
  // ==========================================================================
  const abrirModalDisciplina = (disciplina: any = null) => {
    if (disciplina) {
      // GARANTE QUE VALORES NULL DO BANCO SE TORNEM STRING VAZIA PARA O INPUT REACT
      setDadosDisciplina({
        ...disciplina,
        nome: disciplina.nome || "",
        sigla: disciplina.sigla || "", // Aqui evitamos o React Console Error
        carga_horaria_semanal: disciplina.carga_horaria_semanal || 2,
      });
    } else {
      setDadosDisciplina({
        id: null,
        nome: "",
        sigla: "",
        carga_horaria_semanal: 2,
      });
    }
    setModalDisciplina(true);
  };

  const salvarDisciplina = async (e: React.FormEvent) => {
    e.preventDefault();

    // PAYLOAD LIMPO: Protegemos o trim() com o Optional Chaining (?.trim()) ou garantindo que seja string
    const siglaLimpa = dadosDisciplina.sigla
      ? dadosDisciplina.sigla.trim().toUpperCase()
      : null;
    const nomeLimpo = dadosDisciplina.nome ? dadosDisciplina.nome.trim() : "";

    if (!nomeLimpo) {
      alert("O nome da disciplina é obrigatório.");
      return;
    }

    const payload = {
      nome: nomeLimpo,
      sigla: siglaLimpa, // Salva como NULL no banco se estiver vazio, evitando sujeira ("")
      carga_horaria_semanal:
        parseInt(dadosDisciplina.carga_horaria_semanal) || 2,
      curso_id: cursoSelecionado,
    };

    const id = dadosDisciplina.id;

    const { error } = id
      ? await supabase.from("disciplinas").update(payload).eq("id", id)
      : await supabase.from("disciplinas").insert(payload);

    if (error) {
      alert("Erro ao salvar disciplina:\n" + error.message);
      console.error(error);
    } else {
      setModalDisciplina(false);
      recarregarDados();
    }
  };

  const excluirDisciplina = async (id: string) => {
    if (
      !confirm(
        "Tem certeza que deseja excluir esta disciplina? Isso pode afetar aulas já cadastradas.",
      )
    )
      return;

    const { error } = await supabase.from("disciplinas").delete().eq("id", id);
    if (!error) {
      recarregarDados();
    } else {
      alert("Erro ao excluir disciplina:\n" + error.message);
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

  const disciplinasDoCurso = disciplinas.filter(
    (d) => d.curso_id === cursoSelecionado,
  );
  const cursoAtual = cursos.find((c) => c.id === cursoSelecionado);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h1 className="text-2xl font-black text-green-800">
          Matriz Curricular
        </h1>
        <p className="text-sm text-gray-500 font-medium mt-1">
          Gerencie as disciplinas ofertadas e associe-as aos seus respectivos
          cursos.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* LADO ESQUERDO: LISTA DE CURSOS */}
        <div className="md:col-span-4 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 bg-gray-50 border-b border-gray-200">
            <h2 className="font-bold text-gray-700">Selecione o Curso</h2>
          </div>
          <div className="p-4 space-y-2 max-h-[65vh] overflow-y-auto">
            {cursos.map((curso) => (
              <div
                key={curso.id}
                onClick={() => setCursoSelecionado(curso.id)}
                className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center gap-3 ${
                  cursoSelecionado === curso.id
                    ? "border-green-500 bg-green-50 ring-1 ring-green-500"
                    : "border-gray-200 hover:border-green-300 hover:bg-gray-50"
                }`}
              >
                <div
                  className="w-4 h-4 rounded-full border border-gray-300 shadow-inner flex-shrink-0"
                  style={{ backgroundColor: curso.cor_identificacao }}
                ></div>
                <div className="overflow-hidden">
                  <p className="font-bold text-gray-800 text-sm truncate">
                    {curso.nome}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* LADO DIREITO: LISTA DE DISCIPLINAS */}
        <div className="md:col-span-8 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden min-h-[400px] flex flex-col">
          {!cursoSelecionado ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
              <span className="text-6xl mb-4">📚</span>
              <p className="text-lg font-bold text-gray-500">
                Selecione um curso ao lado
              </p>
              <p className="text-sm mt-2">
                Para montar ou editar a sua matriz curricular.
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
                    Disciplinas do Curso
                  </h2>
                  <p className="text-sm text-gray-500">{cursoAtual?.nome}</p>
                </div>
                <button
                  onClick={() => abrirModalDisciplina()}
                  className="bg-green-600 text-white px-4 py-2 rounded shadow text-sm font-bold hover:bg-green-700 transition-colors"
                >
                  + Nova Disciplina
                </button>
              </div>

              <div className="p-0 overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white border-b border-gray-200 text-sm uppercase tracking-wider text-gray-500">
                      <th className="p-4 font-bold w-[50%]">
                        Nome da Disciplina
                      </th>
                      <th className="p-4 font-bold text-center">Sigla</th>
                      <th className="p-4 font-bold text-center">
                        C.H. Semanal
                      </th>
                      <th className="p-4 text-right font-bold w-24">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="text-base text-gray-700 divide-y divide-gray-100">
                    {disciplinasDoCurso.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="p-8 text-center text-gray-400"
                        >
                          Nenhuma disciplina cadastrada neste curso.
                        </td>
                      </tr>
                    )}
                    {disciplinasDoCurso.map((disciplina) => (
                      <tr
                        key={disciplina.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="p-4 font-bold">{disciplina.nome}</td>
                        <td className="p-4 text-center text-gray-500 font-mono text-sm">
                          {disciplina.sigla || "-"}
                        </td>
                        <td className="p-4 text-center">
                          <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded font-bold text-sm">
                            {disciplina.carga_horaria_semanal} aulas
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => abrirModalDisciplina(disciplina)}
                              className="text-blue-600 hover:bg-blue-50 p-2 rounded transition-colors"
                              title="Editar"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => excluirDisciplina(disciplina.id)}
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

      {/* MODAL DE DISCIPLINA */}
      {modalDisciplina && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <form onSubmit={salvarDisciplina}>
              <div
                className="bg-green-700 text-white px-6 py-4 flex justify-between items-center"
                style={{
                  backgroundColor: cursoAtual?.cor_identificacao,
                  color: "#1f2937",
                }}
              >
                <h3 className="font-bold text-xl">
                  {dadosDisciplina.id ? "Editar Disciplina" : "Nova Disciplina"}
                </h3>
                <button
                  type="button"
                  onClick={() => setModalDisciplina(false)}
                  className="hover:opacity-70 font-bold text-xl"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Curso
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
                    Nome da Disciplina
                  </label>
                  <input
                    required
                    type="text"
                    value={dadosDisciplina.nome}
                    onChange={(e) =>
                      setDadosDisciplina({
                        ...dadosDisciplina,
                        nome: e.target.value,
                      })
                    }
                    className="w-full border border-gray-300 rounded p-2 text-base outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Ex: Algoritmos e Lógica de Programação"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                      Sigla (Opcional)
                    </label>
                    <input
                      type="text"
                      value={dadosDisciplina.sigla}
                      onChange={(e) =>
                        setDadosDisciplina({
                          ...dadosDisciplina,
                          sigla: e.target.value,
                        })
                      }
                      className="w-full border border-gray-300 rounded p-2 text-base outline-none focus:ring-2 focus:ring-green-500 uppercase"
                      placeholder="Ex: ALP"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                      Aulas por Semana
                    </label>
                    <input
                      required
                      type="number"
                      min="1"
                      max="10"
                      value={dadosDisciplina.carga_horaria_semanal}
                      onChange={(e) =>
                        setDadosDisciplina({
                          ...dadosDisciplina,
                          carga_horaria_semanal: e.target.value,
                        })
                      }
                      className="w-full border border-gray-300 rounded p-2 text-base outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setModalDisciplina(false)}
                  className="px-5 py-2 text-gray-600 hover:bg-gray-200 rounded font-bold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-green-600 text-white px-6 py-2 rounded font-bold shadow hover:bg-green-700 active:scale-95 transition-all"
                  style={{ backgroundColor: "#16a34a", color: "white" }}
                >
                  Salvar Disciplina
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
