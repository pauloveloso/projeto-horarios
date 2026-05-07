"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function EspacosPage() {
  const [carregando, setCarregando] = useState(true);

  // Estados de Dados
  const [espacos, setEspacos] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<
    string | null
  >(null);

  // Estados de Modais
  const [modalEspaco, setModalEspaco] = useState(false);
  const [dadosEspaco, setDadosEspaco] = useState<any>({
    id: null,
    nome: "",
    categoria_id: "",
    capacidade: "",
  });

  const [modalCategoria, setModalCategoria] = useState(false);
  const [dadosCategoria, setDadosCategoria] = useState<any>({
    id: null,
    nome: "",
  });

  // ==========================================================================
  // BUSCA DE DADOS E WEBSOCKET
  // ==========================================================================
  const recarregarDados = async () => {
    try {
      const [{ data: dCategorias }, { data: dEspacos }] = await Promise.all([
        supabase.from("categorias_espacos").select("*").order("nome"),
        supabase.from("espacos").select("*").order("nome"),
      ]);

      if (dCategorias) {
        setCategorias(dCategorias);
        // Auto-seleciona a primeira categoria se nenhuma estiver selecionada
        if (!categoriaSelecionada && dCategorias.length > 0) {
          setCategoriaSelecionada(dCategorias[0].id);
        }
      }
      if (dEspacos) setEspacos(dEspacos);
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
      .channel(`sinc_espacos_${idCanal}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "espacos" },
        () => recarregarDados(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "categorias_espacos" },
        () => recarregarDados(),
      )
      .subscribe();

    return () => {
      montado = false;
      supabase.removeChannel(canal);
    };
  }, []);

  // ==========================================================================
  // FUNÇÕES DE CRUD - CATEGORIAS
  // ==========================================================================
  const abrirModalCategoria = (cat: any = null) => {
    if (cat) setDadosCategoria({ ...cat });
    else setDadosCategoria({ id: null, nome: "" });
    setModalCategoria(true);
  };

  const salvarCategoria = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { nome: dadosCategoria.nome.trim() };
    const id = dadosCategoria.id;

    const { error } = id
      ? await supabase.from("categorias_espacos").update(payload).eq("id", id)
      : await supabase.from("categorias_espacos").insert(payload);

    if (error) {
      alert("Erro ao salvar categoria:\n" + error.message);
    } else {
      setModalCategoria(false);
      recarregarDados();
    }
  };

  const excluirCategoria = async (id: string) => {
    const espacosVinculados = espacos.filter(
      (e) => String(e.categoria_id) === String(id),
    );
    if (espacosVinculados.length > 0) {
      alert(
        `Não é possível excluir esta categoria pois existem ${espacosVinculados.length} espaço(s) vinculado(s) a ela.`,
      );
      return;
    }
    if (
      !confirm("Tem certeza que deseja excluir esta categoria permanentemente?")
    )
      return;

    const { error } = await supabase
      .from("categorias_espacos")
      .delete()
      .eq("id", id);
    if (!error) {
      if (categoriaSelecionada === id) setCategoriaSelecionada(null);
      recarregarDados();
    }
  };

  // ==========================================================================
  // FUNÇÕES DE CRUD - ESPAÇOS
  // ==========================================================================
  const abrirModalEspaco = (espaco: any = null) => {
    if (espaco) {
      setDadosEspaco({ ...espaco, capacidade: espaco.capacidade || "" });
    } else {
      setDadosEspaco({
        id: null,
        nome: "",
        categoria_id: categoriaSelecionada || "",
        capacidade: "",
      });
    }
    setModalEspaco(true);
  };

  const salvarEspaco = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      nome: dadosEspaco.nome.trim(),
      categoria_id: dadosEspaco.categoria_id,
      capacidade: dadosEspaco.capacidade
        ? parseInt(dadosEspaco.capacidade)
        : null,
    };
    const id = dadosEspaco.id;

    const { error } = id
      ? await supabase.from("espacos").update(payload).eq("id", id)
      : await supabase.from("espacos").insert(payload);

    if (error) {
      alert("Erro ao salvar espaço físico:\n" + error.message);
    } else {
      setModalEspaco(false);
      recarregarDados();
    }
  };

  const excluirEspaco = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este espaço?")) return;
    const { error } = await supabase.from("espacos").delete().eq("id", id);
    if (!error) recarregarDados();
  };

  // ==========================================================================
  // RENDERIZAÇÃO
  // ==========================================================================
  if (carregando) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const espacosFiltrados = espacos.filter(
    (e) => String(e.categoria_id) === String(categoriaSelecionada),
  );
  const categoriaAtual = categorias.find(
    (c) => String(c.id) === String(categoriaSelecionada),
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h1 className="text-2xl font-black text-green-800">
          Infraestrutura do Campus
        </h1>
        <p className="text-sm text-gray-500 font-medium mt-1">
          Gerencie as categorias e a ocupação física de salas, laboratórios e
          auditórios.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* LADO ESQUERDO: CATEGORIAS */}
        <div className="md:col-span-4 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
            <h2 className="font-bold text-gray-700">Categorias</h2>
            <button
              onClick={() => abrirModalCategoria()}
              className="text-green-600 font-bold hover:text-green-800 text-sm"
            >
              + Nova
            </button>
          </div>
          <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
            {categorias.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">
                Nenhuma categoria cadastrada.
              </p>
            )}

            {categorias.map((cat) => {
              const contagem = espacos.filter(
                (e) => String(e.categoria_id) === String(cat.id),
              ).length;
              return (
                <div
                  key={cat.id}
                  onClick={() => setCategoriaSelecionada(cat.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all flex justify-between items-center group ${
                    categoriaSelecionada === cat.id
                      ? "border-green-500 bg-green-50 ring-1 ring-green-500"
                      : "border-gray-200 hover:border-green-300 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex-1 pr-2">
                    <span
                      className={`font-bold block ${categoriaSelecionada === cat.id ? "text-green-800" : "text-gray-700"}`}
                    >
                      {cat.nome}
                    </span>
                    <span className="text-xs text-gray-500">
                      {contagem} espaço(s)
                    </span>
                  </div>

                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        abrirModalCategoria(cat);
                      }}
                      className="p-1.5 text-blue-600 hover:bg-blue-100 rounded"
                      title="Editar"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        excluirCategoria(cat.id);
                      }}
                      className="p-1.5 text-red-600 hover:bg-red-100 rounded"
                      title="Excluir"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* LADO DIREITO: ESPAÇOS */}
        <div className="md:col-span-8 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden min-h-[450px] flex flex-col">
          {!categoriaSelecionada ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-12 text-center">
              <p className="text-lg font-bold text-gray-500">
                Selecione uma categoria ao lado
              </p>
              <p className="text-sm mt-2">
                Para gerenciar os espaços pertencentes a ela.
              </p>
            </div>
          ) : (
            <>
              <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                <div>
                  <h2 className="font-bold text-gray-700 text-lg">
                    {categoriaAtual?.nome}
                  </h2>
                  <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">
                    Espaços Cadastrados
                  </p>
                </div>
                <button
                  onClick={() => abrirModalEspaco()}
                  className="bg-green-600 text-white px-4 py-2 rounded shadow text-sm font-bold hover:bg-green-700 transition-colors"
                >
                  + Novo Espaço
                </button>
              </div>

              <div className="p-0 overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white border-b border-gray-200 text-xs uppercase tracking-wider text-gray-500">
                      <th className="p-4 font-black">Nome / Identificação</th>
                      <th className="p-4 font-black text-center">Capacidade</th>
                      <th className="p-4 text-right font-black w-24">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm text-gray-700 divide-y divide-gray-100">
                    {espacosFiltrados.length === 0 && (
                      <tr>
                        <td
                          colSpan={3}
                          className="p-12 text-center text-gray-400 font-medium"
                        >
                          Nenhum espaço cadastrado nesta categoria.
                        </td>
                      </tr>
                    )}
                    {espacosFiltrados.map((espaco) => (
                      <tr
                        key={espaco.id}
                        className="hover:bg-gray-50 transition-colors group"
                      >
                        <td className="p-4 font-bold text-gray-800">
                          {espaco.nome}
                        </td>
                        <td className="p-4 text-center">
                          <span className="bg-gray-100 px-3 py-1 rounded-full text-xs font-bold text-gray-600">
                            {espaco.capacidade
                              ? `${espaco.capacidade} lug.`
                              : "N/D"}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => abrirModalEspaco(espaco)}
                              className="text-blue-600 hover:bg-blue-50 p-2 rounded transition-colors"
                              title="Editar"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => excluirEspaco(espaco.id)}
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

      {/* MODAL: CATEGORIA */}
      {modalCategoria && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
            <form onSubmit={salvarCategoria}>
              <div className="bg-green-700 text-white px-6 py-4 flex justify-between items-center">
                <h3 className="font-bold text-xl">
                  {dadosCategoria.id ? "Editar Categoria" : "Nova Categoria"}
                </h3>
                <button
                  type="button"
                  onClick={() => setModalCategoria(false)}
                  className="hover:opacity-70 font-bold text-xl"
                >
                  ✕
                </button>
              </div>
              <div className="p-6">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                  Nome da Categoria
                </label>
                <input
                  required
                  type="text"
                  value={dadosCategoria.nome}
                  onChange={(e) =>
                    setDadosCategoria({
                      ...dadosCategoria,
                      nome: e.target.value,
                    })
                  }
                  className="w-full border border-gray-300 rounded p-2 text-base outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Ex: Laboratórios de Saúde"
                />
              </div>
              <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setModalCategoria(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded font-bold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-green-600 text-white px-5 py-2 rounded font-bold shadow hover:bg-green-700"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ESPAÇO */}
      {modalEspaco && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <form onSubmit={salvarEspaco}>
              <div className="bg-green-700 text-white px-6 py-4 flex justify-between items-center">
                <h3 className="font-bold text-xl">
                  {dadosEspaco.id ? "Editar Espaço" : "Novo Espaço"}
                </h3>
                <button
                  type="button"
                  onClick={() => setModalEspaco(false)}
                  className="hover:opacity-70 font-bold text-xl"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Nome do Espaço
                  </label>
                  <input
                    required
                    type="text"
                    value={dadosEspaco.nome}
                    onChange={(e) =>
                      setDadosEspaco({ ...dadosEspaco, nome: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded p-2 text-base outline-none focus:ring-2 focus:ring-green-500 font-medium"
                    placeholder="Ex: Sala 1 - Técnico"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Categoria Vinculada
                  </label>
                  <select
                    required
                    value={dadosEspaco.categoria_id}
                    onChange={(e) =>
                      setDadosEspaco({
                        ...dadosEspaco,
                        categoria_id: e.target.value,
                      })
                    }
                    className="w-full border border-gray-300 rounded p-2 text-base outline-none focus:ring-2 focus:ring-green-500 bg-white"
                  >
                    {categorias.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Capacidade (Opcional)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={dadosEspaco.capacidade}
                    onChange={(e) =>
                      setDadosEspaco({
                        ...dadosEspaco,
                        capacidade: e.target.value,
                      })
                    }
                    className="w-full border border-gray-300 rounded p-2 text-base outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Ex: 40"
                  />
                </div>
              </div>

              <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setModalEspaco(false)}
                  className="px-5 py-2 text-gray-600 hover:bg-gray-200 rounded font-bold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-green-600 text-white px-6 py-2 rounded font-bold shadow hover:bg-green-700 transition-all"
                >
                  Salvar Espaço
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
