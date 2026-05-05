"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export default function CadastroProfessoresPage() {
  const [professores, setProfessores] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [modalAberto, setModalAberto] = useState(false);
  const [dadosModal, setDadosModal] = useState({
    id: "",
    nome: "",
    dia_planejamento: "",
  });

  const diasDaSemana = [
    { id: "SEGUNDA", label: "Segunda-feira" },
    { id: "TERCA", label: "Terça-feira" },
    { id: "QUARTA", label: "Quarta-feira" },
    { id: "QUINTA", label: "Quinta-feira" },
    { id: "SEXTA", label: "Sexta-feira" },
  ];

  const buscarProfessores = useCallback(async () => {
    const { data, error } = await supabase
      .from("professores")
      .select("*")
      .order("nome", { ascending: true });
    if (!error && data) setProfessores(data);
    setCarregando(false);
  }, []);

  useEffect(() => {
    buscarProfessores();
    const canalProfessores = supabase
      .channel("mudancas-professores")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "professores" },
        () => buscarProfessores(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canalProfessores);
    };
  }, [buscarProfessores]);

  const abrirModalNovo = () => {
    setDadosModal({ id: "", nome: "", dia_planejamento: "" });
    setModalAberto(true);
  };

  const abrirModalEditar = (professor: any) => {
    setDadosModal({
      id: professor.id,
      nome: professor.nome,
      dia_planejamento: professor.dia_planejamento || "",
    });
    setModalAberto(true);
  };

  const salvarProfessor = async (e: React.FormEvent) => {
    e.preventDefault();

    const nomeLimpo = dadosModal.nome.trim();
    if (!nomeLimpo) return alert("O nome do professor não pode ficar vazio.");

    const payload = {
      nome: nomeLimpo,
      dia_planejamento:
        dadosModal.dia_planejamento === "" ? null : dadosModal.dia_planejamento,
    };

    try {
      let erroSupabase = null;

      if (dadosModal.id) {
        // UPDATE: O .select() obriga o banco a confirmar que a linha foi alterada
        const { error } = await supabase
          .from("professores")
          .update(payload)
          .eq("id", dadosModal.id)
          .select();

        erroSupabase = error;
      } else {
        // INSERT: Enviar como array [payload] evita bugs em algumas versões do Supabase
        const { error } = await supabase
          .from("professores")
          .insert([payload])
          .select();

        erroSupabase = error;
      }

      if (erroSupabase) {
        console.error("Erro retornado pelo banco:", erroSupabase);
        alert(
          `O banco de dados recusou a gravação.\nMotivo: ${erroSupabase.message}`,
        );
      } else {
        // Se deu tudo certo, fecha o modal e atualiza a tela
        setModalAberto(false);
        buscarProfessores();
      }
    } catch (err) {
      console.error("Erro de conexão:", err);
      alert("Falha na comunicação com o servidor.");
    }
  };

  const excluirProfessor = async (id: string, nome: string) => {
    if (!confirm(`Tem certeza que deseja remover o(a) professor(a) ${nome}?`))
      return;
    const { error } = await supabase.from("professores").delete().eq("id", id);
    if (error) {
      alert(`Erro ao excluir: ${error.message}`);
    } else {
      buscarProfessores();
    }
  };

  if (carregando)
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 md:p-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-black text-green-800">Professores</h1>
          <p className="text-sm text-gray-500 font-medium">
            Gerencie os docentes disponíveis para alocação
          </p>
        </div>
        <button
          onClick={abrirModalNovo}
          className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg shadow-sm text-sm font-bold flex items-center gap-2"
        >
          + Cadastrar Professor
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {professores.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>Nenhum professor cadastrado ainda.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200">
                <th className="p-4 font-bold">Nome do Docente</th>
                <th className="p-4 font-bold">Dia de Planejamento</th>
                <th className="p-4 font-bold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="text-sm text-gray-700 divide-y divide-gray-100">
              {professores.map((prof) => (
                <tr key={prof.id} className="hover:bg-green-50/50">
                  <td className="p-4 font-medium">{prof.nome}</td>
                  <td className="p-4">
                    {prof.dia_planejamento ? (
                      <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-bold">
                        {
                          diasDaSemana.find(
                            (d) => d.id === prof.dia_planejamento,
                          )?.label
                        }
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs italic">
                        Não definido
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => abrirModalEditar(prof)}
                      className="bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 py-1.5 rounded text-xs font-bold mr-2"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => excluirProfessor(prof.id, prof.nome)}
                      className="bg-red-100 text-red-700 hover:bg-red-200 px-3 py-1.5 rounded text-xs font-bold"
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalAberto && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <form onSubmit={salvarProfessor}>
              <div className="bg-green-700 text-white px-6 py-4 flex justify-between items-center">
                <h3 className="font-bold text-lg">
                  {dadosModal.id ? "Editar Professor" : "Novo Professor"}
                </h3>
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="text-white hover:opacity-70 font-bold"
                >
                  ✕
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    className="w-full border border-gray-300 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-green-500"
                    value={dadosModal.nome}
                    onChange={(e) =>
                      setDadosModal({ ...dadosModal, nome: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                    Dia de Planejamento (Folga/Reunião)
                  </label>
                  <select
                    className="w-full border border-gray-300 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-green-500 bg-white"
                    value={dadosModal.dia_planejamento}
                    onChange={(e) =>
                      setDadosModal({
                        ...dadosModal,
                        dia_planejamento: e.target.value,
                      })
                    }
                  >
                    <option value="">(Nenhum / A definir)</option>
                    {diasDaSemana.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="px-5 py-2 text-gray-600 hover:bg-gray-200 rounded-lg text-sm font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold text-sm shadow hover:bg-green-700"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
