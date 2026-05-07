"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ModoGrade({
  versaoId, // <-- NOVO: Recebendo a versão
  aulas,
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

  const calcularConflitos = () => {
    const conflitos = new Map<string, string[]>();
    const linhasValidas = aulas.filter((a: any) => a.dia_semana);

    const getSlot = (id: string) =>
      slots.find((s: any) => String(s.id) === String(id));
    const getTurno = (hora_inicio: string) => {
      if (!hora_inicio) return null;
      const hora = parseInt(hora_inicio.split(":")[0]);
      if (hora < 12) return "MANHA";
      if (hora < 18) return "TARDE";
      return "NOITE";
    };
    const isPrimeiraDaManha = (hora_inicio: string) =>
      hora_inicio ? parseInt(hora_inicio.split(":")[0]) <= 8 : false;
    const isUltimaDaNoite = (hora_fim: string) =>
      hora_fim ? parseInt(hora_fim.split(":")[0]) >= 22 : false;

    const mapaDias: Record<string, number> = {
      SEGUNDA: 1,
      TERCA: 2,
      QUARTA: 3,
      QUINTA: 4,
      SEXTA: 5,
    };
    const getDiaAnterior = (dia: string) =>
      Object.keys(mapaDias).find((k) => mapaDias[k] === mapaDias[dia] - 1);
    const getDiaSeguinte = (dia: string) =>
      Object.keys(mapaDias).find((k) => mapaDias[k] === mapaDias[dia] + 1);

    linhasValidas.forEach((aulaAtual: any) => {
      const errosDaLinha: string[] = [];

      if (aulaAtual.professor_id && aulaAtual.dia_semana) {
        const professorResp = professores.find(
          (p: any) => String(p.id) === String(aulaAtual.professor_id),
        );
        if (professorResp && professorResp.dia_planejamento) {
          const diaPlan = String(professorResp.dia_planejamento)
            .trim()
            .toUpperCase();
          const diaAula = String(aulaAtual.dia_semana).trim().toUpperCase();
          if (diaPlan === diaAula) {
            errosDaLinha.push(
              "Bloqueio: Professor está em dia de planejamento.",
            );
          }
        }
      }

      const slotAtual = getSlot(aulaAtual.slot_horario_id);
      if (slotAtual) {
        const turnoAtual = getTurno(slotAtual.hora_inicio);
        let turnosDoProfessorNoDia = new Set<string>();
        let aulasDestaDisciplinaNoDia = 0;

        linhasValidas.forEach((outraAula: any) => {
          if (String(aulaAtual.id) === String(outraAula.id)) return;

          const outroSlot = getSlot(outraAula.slot_horario_id);
          if (!outroSlot) return;

          const mesmoDia = aulaAtual.dia_semana === outraAula.dia_semana;
          const mesmoHorario =
            String(aulaAtual.slot_horario_id) ===
            String(outraAula.slot_horario_id);

          if (mesmoDia && mesmoHorario) {
            if (
              aulaAtual.professor_id &&
              String(aulaAtual.professor_id) === String(outraAula.professor_id)
            ) {
              errosDaLinha.push(
                "Choque: Professor já alocado em outra turma neste horário.",
              );
            }
            if (
              aulaAtual.turma_id &&
              String(aulaAtual.turma_id) === String(outraAula.turma_id)
            ) {
              errosDaLinha.push(
                "Choque: Turma já possui outra disciplina neste horário.",
              );
            }
            if (
              aulaAtual.espaco_id &&
              String(aulaAtual.espaco_id) === String(outraAula.espaco_id)
            ) {
              errosDaLinha.push("Choque: Sala/Laboratório já ocupado.");
            }
          }

          if (
            mesmoDia &&
            aulaAtual.professor_id &&
            String(aulaAtual.professor_id) === String(outraAula.professor_id)
          ) {
            const outroTurno = getTurno(outroSlot.hora_inicio);
            if (outroTurno) turnosDoProfessorNoDia.add(outroTurno);
          }

          if (
            mesmoDia &&
            aulaAtual.turma_id &&
            String(aulaAtual.turma_id) === String(outraAula.turma_id)
          ) {
            if (
              aulaAtual.disciplina_id &&
              String(aulaAtual.disciplina_id) ===
                String(outraAula.disciplina_id)
            ) {
              aulasDestaDisciplinaNoDia++;
            }
          }

          if (
            aulaAtual.professor_id &&
            String(aulaAtual.professor_id) === String(outraAula.professor_id)
          ) {
            const diaAnterior = getDiaAnterior(aulaAtual.dia_semana);
            const diaSeguinte = getDiaSeguinte(aulaAtual.dia_semana);

            if (
              isPrimeiraDaManha(slotAtual.hora_inicio) &&
              outraAula.dia_semana === diaAnterior &&
              isUltimaDaNoite(outroSlot.hora_fim)
            ) {
              errosDaLinha.push(
                "Alerta Trabalhista: Sem descanso (Lecionou na última aula da noite passada).",
              );
            }
            if (
              isUltimaDaNoite(slotAtual.hora_fim) &&
              outraAula.dia_semana === diaSeguinte &&
              isPrimeiraDaManha(outroSlot.hora_inicio)
            ) {
              errosDaLinha.push(
                "Alerta Trabalhista: Sem descanso (Alocado na primeira aula da manhã seguinte).",
              );
            }
          }
        });

        if (turnoAtual) turnosDoProfessorNoDia.add(turnoAtual);
        if (turnosDoProfessorNoDia.size > 2) {
          errosDaLinha.push(
            `Limite: Professor alocado em ${turnosDoProfessorNoDia.size} turnos hoje.`,
          );
        }
        if (aulasDestaDisciplinaNoDia + 1 > 2) {
          errosDaLinha.push(
            "Limite: Mais de 2 aulas geminadas desta disciplina hoje.",
          );
        }
      }

      if (errosDaLinha.length > 0) {
        conflitos.set(aulaAtual.id, [...new Set(errosDaLinha)]);
      }
    });

    return conflitos;
  };

  const mapaDeConflitos = calcularConflitos();

  const getNome = (lista: any[], id: string, campo: string = "nome") => {
    const item = lista.find((i) => String(i.id) === String(id));
    return item ? item[campo] || item.codigo : "";
  };

  const getAula = (diaId: string, horaId: string) => {
    return aulas.find(
      (a: any) =>
        a.dia_semana === diaId &&
        String(a.slot_horario_id) === String(horaId) &&
        String(a.turma_id) === String(filtroTurma),
    );
  };

  const handleCellClick = (diaId: string, slotId: string, aula: any) => {
    if (!filtroTurma) return;

    if (aulaCopiada) {
      if (aula) {
        alert(
          "Este horário já está ocupado! Escolha uma célula vazia para colar a aula copiada ou clique em 'Cancelar'.",
        );
      } else {
        colarAula(diaId, slotId);
      }
      return;
    }

    abrirModal(diaId, slotId, aula);
  };

  const colarAula = async (diaId: string, slotId: string) => {
    const payload = {
      versao_id: versaoId, // <-- NOVO: Injetando a versão na cópia
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
    const payload = { ...dadosModal, versao_id: versaoId }; // <-- NOVO: Injetando a versão no modal de criação

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
    if (!error) {
      recarregarAulas();
    } else {
      alert("Erro ao excluir: " + error.message);
    }
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

      {aulaCopiada && (
        <div className="bg-blue-100 border-b border-blue-300 text-blue-800 p-3 flex justify-between items-center shadow-inner animate-pulse">
          <span className="text-base font-bold flex items-center gap-2">
            <span className="text-2xl">⧉</span> MODO DUPLICAÇÃO: Clique num
            horário vazio abaixo para colar a aula de{" "}
            {getNome(disciplinas, aulaCopiada.disciplina_id)}.
          </span>
          <button
            onClick={() => setAulaCopiada(null)}
            className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-bold hover:bg-blue-700 transition-colors shadow"
          >
            Cancelar Cópia
          </button>
        </div>
      )}

      <div className="overflow-x-auto w-full">
        <table className="w-full text-left border-collapse table-fixed">
          <thead>
            <tr className="bg-green-700 text-white text-sm uppercase tracking-wider">
              <th className="p-3 border-r border-green-600 w-32 text-center">
                Horário
              </th>
              {diasDaSemana.map((dia) => (
                <th
                  key={dia.id}
                  className="p-3 border-r border-green-600 text-center"
                >
                  {dia.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-base">
            {slots.map((slot: any) => (
              <tr key={slot.id} className="hover:bg-gray-50 transition-colors">
                <td className="p-3 border-r border-b border-gray-200 text-center font-bold text-gray-500 bg-gray-50 w-32">
                  {formatarHora(slot.hora_inicio)}
                  <br />
                  <span className="text-sm font-normal text-gray-400">
                    {formatarHora(slot.hora_fim)}
                  </span>
                </td>

                {diasDaSemana.map((dia) => {
                  const aula = getAula(dia.id, slot.id);
                  const desabilitado = !filtroTurma;
                  const isCelVazia = !aula;

                  const erros = aula ? mapaDeConflitos.get(aula.id) || [] : [];
                  const temConflito = erros.length > 0;

                  let classeCelula =
                    "p-1 border-r border-b border-gray-200 h-32 align-top relative transition-all ";
                  if (desabilitado) {
                    classeCelula += "opacity-40 cursor-not-allowed bg-gray-100";
                  } else if (aulaCopiada) {
                    classeCelula += isCelVazia
                      ? "cursor-copy bg-blue-50/30 hover:bg-blue-100 ring-inset hover:ring-2 hover:ring-blue-400"
                      : "cursor-not-allowed opacity-60";
                  } else {
                    classeCelula += isCelVazia
                      ? "cursor-pointer bg-gray-50 hover:bg-green-50"
                      : "cursor-pointer bg-white hover:bg-green-50/50";
                  }

                  return (
                    <td
                      key={dia.id}
                      onClick={() => handleCellClick(dia.id, slot.id, aula)}
                      className={classeCelula}
                    >
                      {aula ? (
                        <div
                          className={`group h-full w-full p-2 border rounded flex flex-col justify-between shadow-sm relative transition-colors ${temConflito ? "bg-red-50 border-red-300 hover:bg-red-100" : "bg-green-50/40 border-green-200"}`}
                        >
                          <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 flex gap-1 z-20 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setAulaCopiada(aula);
                              }}
                              className="bg-blue-600 hover:bg-blue-700 text-white rounded px-2 py-0.5 text-xs font-bold shadow"
                              title="Copiar e colar na grade"
                            >
                              ⧉
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                excluirAulaDireto(aula.id);
                              }}
                              className="bg-red-600 hover:bg-red-700 text-white rounded px-2 py-0.5 text-xs font-bold shadow"
                              title="Excluir aula"
                            >
                              ✕
                            </button>
                          </div>

                          {temConflito && (
                            <div
                              className="absolute top-1 left-1 text-red-600 cursor-help text-base z-10 animate-pulse"
                              title={erros?.join("\n")}
                            >
                              ⚠️
                            </div>
                          )}

                          <span
                            className={`font-bold text-sm leading-tight line-clamp-2 mt-4 ${temConflito ? "text-red-800" : "text-green-900"}`}
                          >
                            {getNome(disciplinas, aula.disciplina_id)}
                          </span>

                          <div className="mt-2 space-y-1">
                            <span
                              className="text-xs text-gray-700 block truncate"
                              title={getNome(professores, aula.professor_id)}
                            >
                              👨‍🏫{" "}
                              {getNome(professores, aula.professor_id) ||
                                "A definir"}
                            </span>
                            <span className="bg-white/80 border text-gray-800 text-xs px-2 py-0.5 rounded font-bold w-fit block truncate max-w-full">
                              📍 {getNome(espacos, aula.espaco_id) || "S/ Sala"}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div
                          className={`h-full w-full flex items-center justify-center opacity-0 hover:opacity-100 font-light text-4xl ${aulaCopiada ? "text-blue-500" : "text-green-600"}`}
                        >
                          {aulaCopiada ? "📋" : "+"}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
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
                      <option value="">
                        Nenhuma disciplina cadastrada neste curso
                      </option>
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
