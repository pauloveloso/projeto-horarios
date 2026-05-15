"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ModoGrade({
  versaoId,
  aulas,
  choques = [],
  turmas,
  cursos = [],
  professores,
  disciplinas,
  espacos,
  slots,
  recarregarAulas,
}: any) {
  const [filtroTurma, setFiltroTurma] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  const [dadosModal, setDadosModal] = useState<any>(null);
  const [aulaCopiada, setAulaCopiada] = useState<any>(null);
  const [aulaArrastada, setAulaArrastada] = useState<any>(null);

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

  const mapearMensagem = (choque: any) => {
    if (choque.mensagem_customizada) return choque.mensagem_customizada;
    switch (choque.tipo_choque) {
      case "CHOQUE_TURMA":
        return "🔴 Choque: Turma já possui aula neste horário.";
      case "CHOQUE_ESPACO":
        return "🔴 Choque: Sala/Laboratório já ocupado.";
      case "CHOQUE_DOCENTE":
        return "🔴 Choque: Professor já alocado em outra turma.";
      case "DESCANSO_DOCENTE":
        return "🔴 Alerta Trabalhista: Sem descanso interjornada (Mín. 10h).";
      case "LIMITE_TURNOS":
        return "🔴 Limite: Professor alocado em 3 turnos hoje.";
      case "INDISPONIBILIDADE":
        return "🔴 Indisponibilidade: Horário reservado para atendimento especial.";
      case "DIA_PLANEJAMENTO":
        return "🟡 Atenção: Dia de planejamento do professor.";
      case "AULAS_GEMINADAS":
        return "🟡 Limite: Mais de 2 aulas geminadas desta disciplina.";
      case "FIM_DE_SEMANA":
        return "🟡 Atenção: Professor leciona Sexta à noite e Segunda de manhã.";
      default:
        return "⚠️ Problema detectado.";
    }
  };

  const getNome = (lista: any[], id: string, campo: string = "nome") => {
    const item = lista.find((i) => String(i.id) === String(id));
    return item ? item[campo] || item.codigo : "";
  };

  const getAulasNoSlot = (diaId: string, horaId: string) => {
    return aulas.filter(
      (a: any) =>
        a.dia_semana === diaId &&
        String(a.slot_horario_id) === String(horaId) &&
        String(a.turma_id) === String(filtroTurma),
    );
  };

  const handleDragStart = (e: React.DragEvent, aula: any) => {
    setAulaArrastada(aula);
    e.dataTransfer.setData("text/plain", aula.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setAulaArrastada(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (
    e: React.DragEvent,
    diaId: string,
    slotId: string,
  ) => {
    e.preventDefault();
    if (!aulaArrastada) return;

    if (
      aulaArrastada.dia_semana === diaId &&
      String(aulaArrastada.slot_horario_id) === String(slotId)
    ) {
      setAulaArrastada(null);
      return;
    }

    const { error } = await supabase
      .from("aulas")
      .update({ dia_semana: diaId, slot_horario_id: slotId })
      .eq("id", aulaArrastada.id);

    if (error) {
      alert("Erro ao mover a aula: " + error.message);
    } else {
      recarregarAulas();
    }

    setAulaArrastada(null);
  };

  const handleCellClick = (
    diaId: string,
    slotId: string,
    isOcupado: boolean,
  ) => {
    if (!filtroTurma) return;

    if (aulaCopiada) {
      if (isOcupado) {
        alert(
          "Este horário já está ocupado! Escolha uma célula vazia ou cancele a cópia.",
        );
      } else {
        colarAula(diaId, slotId);
      }
      return;
    }

    abrirModal(diaId, slotId, null);
  };

  const colarAula = async (diaId: string, slotId: string) => {
    const payload = {
      versao_id: versaoId,
      turma_id: aulaCopiada.turma_id,
      disciplina_id: aulaCopiada.disciplina_id,
      professor_id: aulaCopiada.professor_id || null,
      espaco_id: aulaCopiada.espaco_id || null,
      dia_semana: diaId,
      slot_horario_id: slotId,
    };

    const { error } = await supabase.from("aulas").insert(payload);
    if (error) {
      alert("Erro ao colar aula: " + error.message);
    } else {
      setAulaCopiada(null);
      recarregarAulas();
    }
  };

  const abrirModal = (diaId: string, horarioId: string, aulaExistente: any) => {
    setDadosModal({
      id: aulaExistente?.id || null,
      dia_semana: diaId,
      slot_horario_id: horarioId,
      turma_id: filtroTurma,
      disciplina_id: aulaExistente?.disciplina_id || "",
      professor_id: aulaExistente?.professor_id || "",
      espaco_id: aulaExistente?.espaco_id || "",
    });
    setModalAberto(true);
  };

  const salvarAula = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...dadosModal, versao_id: versaoId };

    if (payload.professor_id === "") payload.professor_id = null;
    if (payload.espaco_id === "") payload.espaco_id = null;

    const idDaAula = payload.id;
    delete payload.id;

    let error;
    if (idDaAula) {
      const { error: e } = await supabase
        .from("aulas")
        .update(payload)
        .eq("id", idDaAula);
      error = e;
    } else {
      const { error: e } = await supabase.from("aulas").insert(payload);
      error = e;
    }

    if (error) {
      alert("Erro ao salvar: " + error.message);
    } else {
      setModalAberto(false);
      recarregarAulas();
    }
  };

  const excluirAulaDireto = async (id: string) => {
    if (
      !confirm(
        "Tem certeza que deseja excluir esta aula? O horário ficará vago.",
      )
    )
      return;
    const { error } = await supabase.from("aulas").delete().eq("id", id);
    if (!error) recarregarAulas();
    else alert("Erro ao excluir: " + error.message);
  };

  const turmaAtualObj = turmas.find(
    (t: any) => String(t.id) === String(filtroTurma),
  );

  const disciplinasFiltradas = turmaAtualObj
    ? disciplinas
        .filter(
          (d: any) => String(d.curso_id) === String(turmaAtualObj.curso_id),
        )
        .sort((a: any, b: any) => a.nome.localeCompare(b.nome))
    : [];

  const renderOpcoesTurmas = () => {
    if (!cursos || cursos.length === 0) {
      return turmas.map((t: any) => (
        <option key={t.id} value={t.id}>
          {t.codigo}
        </option>
      ));
    }

    const cursosOrdenados = [...cursos].sort((a, b) =>
      a.nome.localeCompare(b.nome),
    );

    return cursosOrdenados.map((curso) => {
      const turmasDoCurso = turmas
        .filter((t: any) => String(t.curso_id) === String(curso.id))
        .sort((a: any, b: any) => a.codigo.localeCompare(b.codigo));

      if (turmasDoCurso.length === 0) return null;

      return (
        <optgroup key={curso.id} label={curso.nome}>
          {turmasDoCurso.map((t: any) => (
            <option key={t.id} value={t.id}>
              {t.codigo}
            </option>
          ))}
        </optgroup>
      );
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden relative">
      <div className="p-4 bg-gray-50 flex flex-wrap gap-4 items-center border-b border-gray-200">
        <div>
          <h2 className="font-bold text-gray-700 text-lg">
            Edição Visual (Grade)
          </h2>
          <p className="text-sm text-gray-500">
            Selecione uma turma para visualizar e preencher seus horários.
          </p>
        </div>

        <div className="ml-auto flex flex-col md:flex-row items-center gap-2">
          <label className="text-xs text-gray-500 font-bold uppercase">
            Visualizando Turma:
          </label>
          <select
            className="px-4 py-2 bg-white border border-green-500 text-green-700 rounded outline-none w-full md:w-64 text-base font-bold shadow-sm"
            value={filtroTurma}
            onChange={(e) => {
              setFiltroTurma(e.target.value);
              setAulaCopiada(null);
            }}
          >
            <option value="">Selecione uma turma...</option>
            {renderOpcoesTurmas()}
          </select>
        </div>
      </div>

      {/* MENSAGEM FLUTUANTE DE CÓPIA (Substituindo o banner estático) */}
      {/* MENSAGEM FLUTUANTE DE CÓPIA (Larga e Estreita) */}
      {aulaCopiada && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] w-[95%] max-w-4xl animate-bounce-short">
          <div className="bg-blue-600 text-white px-6 py-2.5 rounded-xl shadow-2xl flex justify-between items-center border border-blue-400 backdrop-blur-sm bg-opacity-95">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="bg-white text-blue-600 w-8 h-8 flex items-center justify-center rounded-full animate-pulse shrink-0 shadow-sm">
                <span className="text-lg leading-none mt-0.5">⧉</span>
              </div>
              <p className="text-blue-50 text-[13px] md:text-sm truncate">
                <strong className="font-black text-white uppercase tracking-wider mr-2">
                  Modo Duplicação:
                </strong>
                Clique num slot vazio para colar{" "}
                <strong className="underline text-white ml-1">
                  {getNome(disciplinas, aulaCopiada.disciplina_id)}
                </strong>
              </p>
            </div>

            <button
              onClick={() => setAulaCopiada(null)}
              className="ml-4 shrink-0 bg-white text-blue-600 hover:bg-blue-50 px-5 py-1.5 rounded-lg text-xs font-black uppercase transition-all active:scale-95 shadow-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* AJUSTE: Container com scroll interno para permitir o cabeçalho fixo */}
      <div className="overflow-x-auto overflow-y-auto w-full max-h-[calc(100vh-280px)]">
        <table className="w-full text-left border-collapse table-fixed select-none">
          <thead>
            {/* AJUSTE: Sticky header com z-index alto para ficar por cima das aulas */}
            <tr className="bg-green-700 text-white text-sm uppercase tracking-wider sticky top-0 z-20">
              <th className="p-3 border-r border-green-600 w-32 text-center bg-green-700">
                Horário
              </th>
              {diasDaSemana.map((dia) => (
                <th
                  key={dia.id}
                  className="p-3 border-r border-green-600 text-center bg-green-700"
                >
                  {dia.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-base">
            {slots.map((slot: any) => {
              const linhaTemChoque = diasDaSemana.some(
                (dia) => getAulasNoSlot(dia.id, slot.id).length > 1,
              );

              return (
                <tr
                  key={slot.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="p-3 border-r border-b border-gray-200 text-center font-bold text-gray-500 bg-gray-50 w-32">
                    {formatarHora(slot.hora_inicio)}
                    <br />
                    <span className="text-sm font-normal text-gray-400">
                      {formatarHora(slot.hora_fim)}
                    </span>
                  </td>

                  {diasDaSemana.map((dia) => {
                    const aulasNoSlot = getAulasNoSlot(dia.id, slot.id);
                    const desabilitado = !filtroTurma;
                    const isCelVazia = aulasNoSlot.length === 0;
                    const isSplit = aulasNoSlot.length > 1;

                    return (
                      <td
                        key={dia.id}
                        onClick={() =>
                          handleCellClick(dia.id, slot.id, !isCelVazia)
                        }
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, dia.id, slot.id)}
                        className={`p-1 border-r border-b border-gray-200 align-top relative transition-all ${linhaTemChoque ? "h-48" : "h-32"} ${desabilitado ? "opacity-40 cursor-not-allowed bg-gray-100" : isCelVazia ? "cursor-pointer bg-gray-50 hover:bg-green-50" : "cursor-pointer bg-white"} ${aulaArrastada && !desabilitado ? "bg-blue-50/20" : ""}`}
                      >
                        <div className="flex flex-col h-full w-full gap-1">
                          {aulasNoSlot.map((aula: any) => {
                            // CORREÇÃO: Filtrando a variável problemas para não incluir carga horária
                            const problemas = choques.filter(
                              (c: any) =>
                                c.id_aula_foco === aula.id &&
                                c.tipo_choque !== "CARGA_INCOMPLETA" &&
                                c.tipo_choque !== "EXCESSO_CARGA",
                            );

                            // AJUSTE: Removido alertas de carga horária
                            const temCritico = problemas.some((c: any) =>
                              [
                                "CHOQUE_TURMA",
                                "CHOQUE_ESPACO",
                                "CHOQUE_DOCENTE",
                                "DESCANSO_DOCENTE",
                                "LIMITE_TURNOS",
                                "INDISPONIBILIDADE",
                              ].includes(c.tipo_choque),
                            );
                            const temAlerta = problemas.some((c: any) =>
                              [
                                "DIA_PLANEJAMENTO",
                                "AULAS_GEMINADAS",
                                "FIM_DE_SEMANA",
                              ].includes(c.tipo_choque),
                            );

                            let corBgCard = "bg-green-50/40 border-green-200";
                            let corTextoTitulo = "text-green-900";
                            if (temCritico) {
                              corBgCard = "bg-red-50 border-red-300";
                              corTextoTitulo = "text-red-800";
                            } else if (temAlerta) {
                              corBgCard = "bg-yellow-50 border-yellow-300";
                              corTextoTitulo = "text-yellow-800";
                            }

                            const isSendoArrastada =
                              aulaArrastada?.id === aula.id;

                            return (
                              <div
                                key={aula.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, aula)}
                                onDragEnd={handleDragEnd}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  abrirModal(dia.id, slot.id, aula);
                                }}
                                className={`group flex-1 ${isSplit ? "p-1 justify-center" : "p-2 justify-between"} border rounded flex flex-col shadow-sm relative overflow-hidden transition-all hover:scale-[1.02] hover:z-10 min-h-0 ${corBgCard} cursor-grab active:cursor-grabbing ${isSendoArrastada ? "opacity-40 scale-95 border-dashed" : ""}`}
                              >
                                <div
                                  className={`absolute ${isSplit ? "top-0.5 right-0.5 p-0.5" : "top-1 right-1 p-1"} opacity-0 group-hover:opacity-100 flex gap-1 z-20 transition-opacity bg-white/90 rounded`}
                                >
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setAulaCopiada(aula);
                                    }}
                                    className={`bg-blue-600 hover:bg-blue-700 text-white rounded shadow font-bold ${isSplit ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"}`}
                                    title="Copiar e colar na grade"
                                  >
                                    ⧉
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      excluirAulaDireto(aula.id);
                                    }}
                                    className={`bg-red-600 hover:bg-red-700 text-white rounded shadow font-bold ${isSplit ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"}`}
                                    title="Excluir aula"
                                  >
                                    ✕
                                  </button>
                                </div>

                                {!isSplit && (temCritico || temAlerta) && (
                                  <div
                                    className="absolute top-1 left-1 cursor-help text-base z-10 animate-pulse drop-shadow-sm"
                                    title={problemas
                                      .map((p: any) => mapearMensagem(p))
                                      .join("\n")}
                                  >
                                    {temCritico ? "🔴" : "🟡"}
                                  </div>
                                )}

                                <div
                                  className={`flex items-center gap-1 w-full min-w-0 ${isSplit ? "" : "mt-4"}`}
                                >
                                  {isSplit && (temCritico || temAlerta) && (
                                    <span
                                      className="cursor-help text-[10px] animate-pulse shrink-0"
                                      title={problemas
                                        .map((p: any) => mapearMensagem(p))
                                        .join("\n")}
                                    >
                                      {temCritico ? "🔴" : "🟡"}
                                    </span>
                                  )}
                                  <span
                                    className={`font-black leading-tight ${corTextoTitulo} ${isSplit ? "text-[11px] truncate" : "text-sm line-clamp-2"}`}
                                    title={getNome(
                                      disciplinas,
                                      aula.disciplina_id,
                                    )}
                                  >
                                    {getNome(disciplinas, aula.disciplina_id)}
                                  </span>
                                </div>

                                <div
                                  className={`flex flex-col min-w-0 ${isSplit ? "mt-0.5" : "mt-2 space-y-1"}`}
                                >
                                  <span
                                    className={`text-gray-700 truncate ${isSplit ? "text-[10px]" : "text-xs"}`}
                                    title={getNome(
                                      professores,
                                      aula.professor_id,
                                    )}
                                  >
                                    👨‍🏫{" "}
                                    {getNome(professores, aula.professor_id) ||
                                      "A definir"}
                                  </span>
                                  <span
                                    className={`bg-white/80 border text-gray-800 rounded font-bold w-fit block truncate max-w-full ${isSplit ? "text-[9px] px-1 py-0.5" : "text-xs px-2 py-0.5"}`}
                                    title={getNome(espacos, aula.espaco_id)}
                                  >
                                    📍{" "}
                                    {getNome(espacos, aula.espaco_id) ||
                                      "S/ Sala"}
                                  </span>
                                </div>
                              </div>
                            );
                          })}

                          {/* AJUSTE: Opção de cancelar cópia diretamente no slot vazio */}
                          {isCelVazia && !desabilitado && !aulaArrastada && (
                            <div
                              className={`h-full w-full flex items-center justify-center opacity-0 hover:opacity-100 font-light transition-all ${aulaCopiada ? "text-blue-500 text-3xl" : "text-green-600 text-4xl"}`}
                            >
                              {aulaCopiada ? (
                                <div className="flex gap-4">
                                  <span title="Colar aqui">📋</span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setAulaCopiada(null);
                                    }}
                                    className="text-red-600 hover:scale-125 transition-transform font-bold"
                                    title="Cancelar Cópia"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                "+"
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modalAberto && dadosModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all">
            <form onSubmit={salvarAula}>
              <div className="bg-green-700 text-white px-6 py-4 flex justify-between items-center">
                <h3 className="font-bold text-xl">
                  {dadosModal.id ? "Editar Horário" : "Definir Horário"}
                </h3>
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="text-white hover:opacity-70 font-bold text-xl"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Turma Bloqueada
                  </label>
                  <input
                    type="text"
                    disabled
                    value={turmaAtualObj?.codigo || ""}
                    className="w-full border border-gray-200 rounded p-2 text-base bg-gray-100 text-gray-600 font-bold cursor-not-allowed"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                      Dia da Semana
                    </label>
                    <select
                      required
                      disabled
                      className="w-full border border-gray-200 rounded p-2 text-base bg-gray-100 text-gray-600 font-bold cursor-not-allowed"
                      value={dadosModal.dia_semana}
                    >
                      {diasDaSemana.map((d: any) => (
                        <option key={d.id} value={d.id}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                      Horário
                    </label>
                    <select
                      required
                      disabled
                      className="w-full border border-gray-200 rounded p-2 text-base bg-gray-100 text-gray-600 font-bold cursor-not-allowed"
                      value={dadosModal.slot_horario_id}
                    >
                      {slots.map((s: any) => (
                        <option key={s.id} value={s.id}>
                          {formatarHora(s.hora_inicio)} -{" "}
                          {formatarHora(s.hora_fim)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Disciplina
                  </label>
                  <select
                    required
                    className="w-full border rounded p-2 text-base outline-none focus:ring-2 focus:ring-green-500 bg-white"
                    value={dadosModal.disciplina_id}
                    onChange={(e) =>
                      setDadosModal({
                        ...dadosModal,
                        disciplina_id: e.target.value,
                      })
                    }
                  >
                    {!filtroTurma ? (
                      <option value="">Selecione o curso...</option>
                    ) : disciplinasFiltradas.length === 0 ? (
                      <option value="">Nenhuma disciplina cadastrada</option>
                    ) : (
                      <>
                        <option value="">Selecione a disciplina...</option>
                        {disciplinasFiltradas.map((d: any) => (
                          <option key={d.id} value={d.id}>
                            {d.nome}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                      Professor
                    </label>
                    <select
                      className="w-full border rounded p-2 text-base outline-none focus:ring-2 focus:ring-green-500 bg-white"
                      value={dadosModal.professor_id}
                      onChange={(e) =>
                        setDadosModal({
                          ...dadosModal,
                          professor_id: e.target.value,
                        })
                      }
                    >
                      <option value="">(A definir)</option>
                      {professores.map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                      Sala / Espaço
                    </label>
                    <select
                      className="w-full border rounded p-2 text-base outline-none focus:ring-2 focus:ring-green-500 bg-white"
                      value={dadosModal.espaco_id}
                      onChange={(e) =>
                        setDadosModal({
                          ...dadosModal,
                          espaco_id: e.target.value,
                        })
                      }
                    >
                      <option value="">(A definir)</option>
                      {espacos.map((s: any) => (
                        <option key={s.id} value={s.id}>
                          {s.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 px-6 py-4 flex justify-end items-center border-t border-gray-200">
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setModalAberto(false)}
                    className="px-5 py-2 text-gray-600 hover:bg-gray-200 rounded text-base font-bold transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="bg-green-600 text-white px-6 py-2 rounded font-bold text-base shadow hover:bg-green-700 active:scale-95 transition-all"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
