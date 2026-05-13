"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export default function CadastroProfessoresPage() {
  const [professores, setProfessores] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Modal Principal (Novo/Editar)
  const [modalAberto, setModalAberto] = useState(false);
  const [dadosModal, setDadosModal] = useState({
    id: "",
    nome: "",
    dia_planejamento: "",
  });

  // Modal de Restrições (Atendimento Especial)
  const [modalRestricoesAberto, setModalRestricoesAberto] = useState(false);
  const [professorSelecionado, setProfessorSelecionado] = useState<any>(null);
  const [motivoGeral, setMotivoGeral] = useState("");
  const [restricoes, setRestricoes] = useState<any[]>([]);

  const diasDaSemana = [
    { id: "SEGUNDA", label: "Segunda" },
    { id: "TERCA", label: "Terça" },
    { id: "QUARTA", label: "Quarta" },
    { id: "QUINTA", label: "Quinta" },
    { id: "SEXTA", label: "Sexta" },
  ];

  const formatarHora = (hora: string) => {
    if (!hora) return "";
    return hora.substring(0, 5);
  };

  const buscarProfessores = useCallback(async () => {
    const { data, error } = await supabase
      .from("professores")
      .select("*")
      .order("nome", { ascending: true });
    if (!error && data) setProfessores(data);
    setCarregando(false);
  }, []);

  const buscarSlots = useCallback(async () => {
    const { data } = await supabase
      .from("slots_horarios")
      .select("*")
      .order("hora_inicio", { ascending: true });
    if (data) setSlots(data);
  }, []);

  useEffect(() => {
    buscarProfessores();
    buscarSlots();

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
  }, [buscarProfessores, buscarSlots]);

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
        const { error } = await supabase
          .from("professores")
          .update(payload)
          .eq("id", dadosModal.id)
          .select();
        erroSupabase = error;
      } else {
        const { error } = await supabase
          .from("professores")
          .insert([payload])
          .select();
        erroSupabase = error;
      }

      if (erroSupabase) {
        alert(`Erro do banco: ${erroSupabase.message}`);
      } else {
        setModalAberto(false);
        buscarProfessores();
      }
    } catch (err) {
      alert("Falha na comunicação com o servidor.");
    }
  };

  const excluirProfessor = async (id: string, nome: string) => {
    if (!confirm(`Tem certeza que deseja remover o(a) professor(a) ${nome}?`))
      return;
    const { error } = await supabase.from("professores").delete().eq("id", id);
    if (error) alert(`Erro ao excluir: ${error.message}`);
    else buscarProfessores();
  };

  const abrirModalRestricoes = async (professor: any) => {
    setProfessorSelecionado(professor);
    setMotivoGeral("");

    const { data } = await supabase
      .from("professores_indisponibilidades")
      .select("*")
      .eq("professor_id", professor.id);

    if (data && data.length > 0) {
      setRestricoes(data);
      setMotivoGeral(data[0].motivo || "");
    } else {
      setRestricoes([]);
    }

    setModalRestricoesAberto(true);
  };

  const toggleRestricao = (diaId: string, slotId: string) => {
    setRestricoes((atuais) => {
      const existe = atuais.find(
        (r) => r.dia_semana === diaId && r.slot_horario_id === slotId,
      );
      if (existe) {
        return atuais.filter(
          (r) => !(r.dia_semana === diaId && r.slot_horario_id === slotId),
        );
      } else {
        return [...atuais, { dia_semana: diaId, slot_horario_id: slotId }];
      }
    });
  };

  const salvarRestricoes = async () => {
    if (!professorSelecionado) return;

    await supabase
      .from("professores_indisponibilidades")
      .delete()
      .eq("professor_id", professorSelecionado.id);

    if (restricoes.length > 0) {
      const payload = restricoes.map((r) => ({
        professor_id: professorSelecionado.id,
        dia_semana: r.dia_semana,
        slot_horario_id: r.slot_horario_id,
        motivo: motivoGeral.trim() || "Atendimento Especial",
      }));

      const { error } = await supabase
        .from("professores_indisponibilidades")
        .insert(payload);
      if (error) {
        alert("Erro ao salvar restrições: " + error.message);
        return;
      }
    }

    setModalRestricoesAberto(false);
    alert("Restrições atualizadas com sucesso!");
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
            Gerencie os docentes e suas disponibilidades
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
                    {/* AJUSTE VISUAL NO BOTÃO: Verde claro para seguir o tema */}
                    <button
                      onClick={() => abrirModalRestricoes(prof)}
                      className="bg-green-100 text-green-700 hover:bg-green-200 px-3 py-1.5 rounded text-xs font-bold mr-2 transition-colors"
                      title="Atendimento Especial / Indisponibilidade"
                    >
                      🛡️ Restrições
                    </button>

                    <button
                      onClick={() => abrirModalEditar(prof)}
                      className="bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 py-1.5 rounded text-xs font-bold mr-2 transition-colors"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => excluirProfessor(prof.id, prof.nome)}
                      className="bg-red-100 text-red-700 hover:bg-red-200 px-3 py-1.5 rounded text-xs font-bold transition-colors"
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

      {/* MODAL DE CADASTRO BÁSICO (MANTIDO INTACTO) */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
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

      {/* MODAL DE RESTRIÇÕES COM AJUSTE VISUAL (TEMA VERDE) */}
      {modalRestricoesAberto && professorSelecionado && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-green-700 text-white px-6 py-4 flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-lg">
                  Restrições e Atendimentos Especiais
                </h3>
                <p className="text-xs text-green-100">
                  Professor: {professorSelecionado.nome}
                </p>
              </div>
              <button
                onClick={() => setModalRestricoesAberto(false)}
                className="text-white hover:opacity-70 font-bold text-xl"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              <div className="bg-green-50 border border-green-100 p-4 rounded-lg">
                <label className="block text-xs font-bold text-green-800 uppercase mb-2">
                  Justificativa / Motivo Geral
                </label>
                <input
                  type="text"
                  placeholder="Ex: Mestrado, Tratamento de Saúde, Capacitação..."
                  className="w-full border border-green-300 rounded p-2 text-sm outline-none focus:ring-2 focus:ring-green-500"
                  value={motivoGeral}
                  onChange={(e) => setMotivoGeral(e.target.value)}
                />
              </div>

              <div>
                <h4 className="text-sm font-bold text-gray-700 mb-2 uppercase">
                  Marque os horários indisponíveis:
                </h4>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-center text-sm table-fixed">
                    <thead>
                      <tr className="bg-gray-100 text-gray-600 uppercase text-xs">
                        <th className="p-2 border-r border-b w-32">Horário</th>
                        {diasDaSemana.map((dia) => (
                          <th key={dia.id} className="p-2 border-r border-b">
                            {dia.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {slots.map((slot) => (
                        <tr
                          key={slot.id}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="p-2 border-r border-b text-xs font-bold text-gray-500 bg-gray-50">
                            {formatarHora(slot.hora_inicio)} -{" "}
                            {formatarHora(slot.hora_fim)}
                          </td>
                          {diasDaSemana.map((dia) => {
                            const isMarcado = restricoes.some(
                              (r) =>
                                r.dia_semana === dia.id &&
                                r.slot_horario_id === slot.id,
                            );
                            return (
                              <td
                                key={`${dia.id}-${slot.id}`}
                                className="p-2 border-r border-b"
                              >
                                <label className="flex items-center justify-center w-full h-full cursor-pointer p-1">
                                  <input
                                    type="checkbox"
                                    className="w-5 h-5 text-green-600 rounded border-gray-300 focus:ring-green-500 cursor-pointer"
                                    checked={isMarcado}
                                    onChange={() =>
                                      toggleRestricao(dia.id, slot.id)
                                    }
                                  />
                                </label>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-200 shrink-0">
              <button
                onClick={() => setModalRestricoesAberto(false)}
                className="px-5 py-2 text-gray-600 hover:bg-gray-200 rounded-lg text-sm font-bold"
              >
                Cancelar
              </button>
              <button
                onClick={salvarRestricoes}
                className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold text-sm shadow hover:bg-green-700"
              >
                Salvar Restrições
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
