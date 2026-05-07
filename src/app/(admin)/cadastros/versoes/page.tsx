"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function GestaoVersoesPage() {
  const [carregando, setCarregando] = useState(true);
  const [versoes, setVersoes] = useState<any[]>([]);

  // Modais
  const [modalAgendar, setModalAgendar] = useState(false);
  const [modalNovoRascunho, setModalNovoRascunho] = useState(false);
  const [modalEditar, setModalEditar] = useState(false);

  // Dados temporários para os modais
  const [versaoAlvo, setVersaoAlvo] = useState<any>(null);
  const [dataVigencia, setDataVigencia] = useState("");
  const [dadosEdicao, setDadosEdicao] = useState({
    id: "",
    nome: "",
    semestre: "",
  });
  const [novoRascunho, setNovoRascunho] = useState({ nome: "", semestre: "" });

  const carregarVersoes = async () => {
    setCarregando(true);
    try {
      const { data } = await supabase
        .from("versoes_grade")
        .select("*")
        .order("data_inicio_vigencia", { ascending: false });

      if (data) setVersoes(data);
    } catch (error) {
      console.error("Erro ao carregar versões:", error);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarVersoes();
  }, []);

  // 1. Criar Rascunho Inicial
  const criarRascunho = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("versoes_grade").insert({
      nome: novoRascunho.nome,
      semestre: novoRascunho.semestre,
      status: "RASCUNHO",
    });

    if (!error) {
      setModalNovoRascunho(false);
      setNovoRascunho({ nome: "", semestre: "" });
      carregarVersoes();
    } else {
      alert("Erro ao criar rascunho: " + error.message);
    }
  };

  // 2. Salvar Edição de Nome/Semestre (Apenas para Rascunho)
  const salvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase
      .from("versoes_grade")
      .update({ nome: dadosEdicao.nome, semestre: dadosEdicao.semestre })
      .eq("id", dadosEdicao.id);

    if (!error) {
      setModalEditar(false);
      carregarVersoes();
    } else {
      alert("Erro ao atualizar: " + error.message);
    }
  };

  // 3. Clonar Aulas
  const clonarGradeAnterior = async (idRascunho: string) => {
    if (
      !confirm(
        "Isso vai apagar qualquer aula neste rascunho e copiar as aulas da versão atual. Continuar?",
      )
    )
      return;

    const hoje = new Date().toISOString().split("T")[0];
    const versaoAtual = versoes.find(
      (v) => v.status === "PUBLICADA" && v.data_inicio_vigencia <= hoje,
    );

    if (!versaoAtual) {
      alert("Nenhuma versão publicada encontrada para copiar.");
      return;
    }

    try {
      await supabase.from("aulas").delete().eq("versao_id", idRascunho);
      const { data: aulasAntigas } = await supabase
        .from("aulas")
        .select("*")
        .eq("versao_id", versaoAtual.id);

      if (aulasAntigas && aulasAntigas.length > 0) {
        const copias = aulasAntigas.map((aula) => {
          const { id, criado_em, ...resto } = aula;
          return { ...resto, versao_id: idRascunho };
        });
        await supabase.from("aulas").insert(copias);
        alert("Dados recarregados com sucesso!");
      }
    } catch (error) {
      alert("Erro ao clonar a grade.");
    }
  };

  // 4. Publicar/Agendar
  const agendarPublicacao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!versaoAlvo || !dataVigencia) return;

    try {
      await supabase
        .from("versoes_grade")
        .update({
          status: "PUBLICADA",
          data_inicio_vigencia: dataVigencia,
        })
        .eq("id", versaoAlvo.id);

      // Gera o próximo rascunho automático em branco
      await supabase.from("versoes_grade").insert({
        nome: "Novo Rascunho",
        semestre: versaoAlvo.semestre,
        status: "RASCUNHO",
      });

      setModalAgendar(false);
      carregarVersoes();
      alert("Versão agendada com sucesso!");
    } catch (error) {
      alert("Erro ao agendar.");
    }
  };

  const formatarData = (dataStr: string) => {
    if (!dataStr) return "-";
    const d = new Date(dataStr);
    return new Date(
      d.getTime() + d.getTimezoneOffset() * 60000,
    ).toLocaleDateString("pt-BR");
  };

  const hoje = new Date().toISOString().split("T")[0];
  const rascunhos = versoes.filter((v) => v.status === "RASCUNHO");

  if (carregando) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* CABEÇALHO */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-green-800">
            Controle de Versões
          </h1>
          <p className="text-sm text-gray-500 font-medium mt-1">
            Gerencie rascunhos, agende publicações e controle o histórico de
            horários.
          </p>
        </div>
        {rascunhos.length === 0 && (
          <button
            onClick={() => setModalNovoRascunho(true)}
            className="bg-green-600 text-white px-5 py-2.5 rounded shadow-sm text-sm font-bold hover:bg-green-700 transition-colors"
          >
            + Criar Rascunho Inicial
          </button>
        )}
      </div>

      {/* TABELA DE VERSÕES */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500">
              <th className="p-4 font-black">Versão / Semestre</th>
              <th className="p-4 font-black text-center">Início de Vigência</th>
              <th className="p-4 font-black text-center">Status Público</th>
              <th className="p-4 font-black text-right">Ações de Gestão</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {versoes.map((versao) => {
              let badgeClass = "bg-gray-100 text-gray-600";
              let labelStatus = "ARQUIVADA";

              if (versao.status === "RASCUNHO") {
                badgeClass = "bg-yellow-100 text-yellow-800 border-yellow-200";
                labelStatus = "EM EDIÇÃO (RASCUNHO)";
              } else if (versao.status === "PUBLICADA") {
                if (versao.data_inicio_vigencia > hoje) {
                  badgeClass = "bg-blue-100 text-blue-800 border-blue-200";
                  labelStatus = "AGENDADA (PRÉVIA)";
                } else {
                  const atual = versoes.find(
                    (v) =>
                      v.status === "PUBLICADA" &&
                      v.data_inicio_vigencia <= hoje,
                  );
                  if (atual && atual.id === versao.id) {
                    badgeClass = "bg-green-100 text-green-800 border-green-200";
                    labelStatus = "EM VIGOR (ATUAL)";
                  }
                }
              }

              return (
                <tr
                  key={versao.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="p-4">
                    <div className="font-bold text-gray-800">{versao.nome}</div>
                    <div className="text-xs text-gray-500 font-medium">
                      Semestre: {versao.semestre}
                    </div>
                  </td>
                  <td className="p-4 text-center font-bold text-gray-700">
                    {formatarData(versao.data_inicio_vigencia)}
                  </td>
                  <td className="p-4 text-center">
                    <span
                      className={`text-[10px] font-black border px-2 py-1 rounded shadow-sm ${badgeClass}`}
                    >
                      {labelStatus}
                    </span>
                  </td>
                  <td className="p-4 text-right space-x-2">
                    {versao.status === "RASCUNHO" && (
                      <>
                        <button
                          onClick={() => {
                            setDadosEdicao({
                              id: versao.id,
                              nome: versao.nome,
                              semestre: versao.semestre,
                            });
                            setModalEditar(true);
                          }}
                          className="text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded transition-colors"
                        >
                          ✏️ Editar Info
                        </button>
                        <button
                          onClick={() => clonarGradeAnterior(versao.id)}
                          className="text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded transition-colors"
                        >
                          🔄 Recarregar
                        </button>
                        <button
                          onClick={() => {
                            setVersaoAlvo(versao);
                            setModalAgendar(true);
                          }}
                          className="text-xs font-bold text-white bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded shadow-sm"
                        >
                          🚀 Publicar
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* MODAL: EDITAR RASCUNHO */}
      {modalEditar && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
            <form onSubmit={salvarEdicao}>
              <div className="bg-gray-800 text-white px-6 py-4 font-bold">
                Editar Dados do Rascunho
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Nome da Versão
                  </label>
                  <input
                    required
                    type="text"
                    value={dadosEdicao.nome}
                    onChange={(e) =>
                      setDadosEdicao({ ...dadosEdicao, nome: e.target.value })
                    }
                    className="w-full border rounded p-2 outline-none focus:ring-2 focus:ring-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Semestre
                  </label>
                  <input
                    required
                    type="text"
                    value={dadosEdicao.semestre}
                    onChange={(e) =>
                      setDadosEdicao({
                        ...dadosEdicao,
                        semestre: e.target.value,
                      })
                    }
                    className="w-full border rounded p-2 outline-none focus:ring-2 focus:ring-gray-400"
                  />
                </div>
              </div>
              <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t">
                <button
                  type="button"
                  onClick={() => setModalEditar(false)}
                  className="px-4 py-2 text-gray-500 text-sm font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-gray-800 text-white px-5 py-2 rounded text-sm font-bold"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: AGENDAR PUBLICAÇÃO */}
      {modalAgendar && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
            <form onSubmit={agendarPublicacao}>
              <div className="bg-green-800 text-white px-6 py-4">
                <h3 className="font-bold text-lg">Agendar Publicação</h3>
                <p className="text-xs text-green-200 mt-1">
                  Defina quando o novo horário entrará em vigor.
                </p>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                    Data de Início da Vigência
                  </label>
                  <input
                    type="date"
                    required
                    value={dataVigencia}
                    onChange={(e) => setDataVigencia(e.target.value)}
                    className="w-full border border-gray-300 rounded p-2 outline-none focus:ring-2 focus:ring-green-500 font-medium"
                  />
                </div>
              </div>
              <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t">
                <button
                  type="button"
                  onClick={() => setModalAgendar(false)}
                  className="px-4 py-2 text-gray-600 text-sm font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-green-600 text-white px-5 py-2 rounded text-sm font-bold"
                >
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NOVO RASCUNHO */}
      {modalNovoRascunho && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
            <form onSubmit={criarRascunho}>
              <div className="bg-gray-800 text-white px-6 py-4 font-bold">
                Criar Rascunho Inicial
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Nome da Versão
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="Ex: Horário 2024.2"
                    value={novoRascunho.nome}
                    onChange={(e) =>
                      setNovoRascunho({ ...novoRascunho, nome: e.target.value })
                    }
                    className="w-full border rounded p-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Semestre
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="Ex: 2024.2"
                    value={novoRascunho.semestre}
                    onChange={(e) =>
                      setNovoRascunho({
                        ...novoRascunho,
                        semestre: e.target.value,
                      })
                    }
                    className="w-full border rounded p-2"
                  />
                </div>
              </div>
              <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t">
                <button
                  type="button"
                  onClick={() => setModalNovoRascunho(false)}
                  className="px-4 py-2 text-gray-500 text-sm font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-gray-800 text-white px-5 py-2 rounded text-sm font-bold"
                >
                  Criar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
