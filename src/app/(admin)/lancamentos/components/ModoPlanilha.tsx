"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function ModoPlanilha({
  aulas,
  turmas,
  cursos = [], // Adicionado para permitir o agrupamento por curso
  professores,
  disciplinas,
  espacos,
  slots,
  recarregarAulas,
}: any) {
  const [linhas, setLinhas] = useState<any[]>([]);

  const formatarHora = (hora: string) => {
    if (!hora) return "";
    return hora.substring(0, 5);
  };

  useEffect(() => {
    const linhasDoBanco = aulas.map((a: any) => ({ ...a }));

    // Dicionário auxiliar para ordenar os dias da semana logicamente
    const mapaDiasOrdenacao: Record<string, number> = {
      SEGUNDA: 1,
      TERCA: 2,
      QUARTA: 3,
      QUINTA: 4,
      SEXTA: 5,
    };

    linhasDoBanco.sort((a: any, b: any) => {
      // 1. ORDENAÇÃO POR CURSO
      const turmaObjA = turmas.find(
        (t: any) => String(t.id) === String(a.turma_id),
      );
      const turmaObjB = turmas.find(
        (t: any) => String(t.id) === String(b.turma_id),
      );

      const cursoA = (
        cursos.find((c: any) => String(c.id) === String(turmaObjA?.curso_id))
          ?.nome || ""
      ).toUpperCase();
      const cursoB = (
        cursos.find((c: any) => String(c.id) === String(turmaObjB?.curso_id))
          ?.nome || ""
      ).toUpperCase();

      if (cursoA !== cursoB) return cursoA.localeCompare(cursoB);

      // 2. ORDENAÇÃO POR TURMA
      const turmaNomeA = (turmaObjA?.codigo || "").toUpperCase();
      const turmaNomeB = (turmaObjB?.codigo || "").toUpperCase();

      if (turmaNomeA !== turmaNomeB)
        return turmaNomeA.localeCompare(turmaNomeB);

      // 3. ORDENAÇÃO POR DIA DA SEMANA
      const diaA = mapaDiasOrdenacao[a.dia_semana] || 99;
      const diaB = mapaDiasOrdenacao[b.dia_semana] || 99;

      if (diaA !== diaB) return diaA - diaB;

      // 4. ORDENAÇÃO POR HORÁRIO
      const slotObjA = slots.find(
        (s: any) => String(s.id) === String(a.slot_horario_id),
      );
      const slotObjB = slots.find(
        (s: any) => String(s.id) === String(b.slot_horario_id),
      );

      const horaA = slotObjA?.hora_inicio || "99:99";
      const horaB = slotObjB?.hora_inicio || "99:99";

      return horaA.localeCompare(horaB);
    });

    const linhasVazias = Array.from({ length: 5 }, () => criarLinhaVazia());
    setLinhas([...linhasDoBanco, ...linhasVazias]);
  }, [aulas, turmas, cursos, slots]); // Atualizado para observar mudanças nas novas dependências de ordenação

  const criarLinhaVazia = () => ({
    id: crypto.randomUUID(),
    turma_id: "",
    disciplina_id: "",
    professor_id: "",
    dia_semana: "",
    slot_horario_id: "",
    espaco_id: "",
  });

  const adicionarLinha = () => setLinhas([...linhas, criarLinhaVazia()]);

  const duplicarLinha = (id_original: string) => {
    const linhaParaCopiar = linhas.find((l) => l.id === id_original);
    if (!linhaParaCopiar) return;

    const novaLinha = { ...linhaParaCopiar, id: crypto.randomUUID() };
    const indexOriginal = linhas.findIndex((l) => l.id === id_original);
    const novasLinhas = [...linhas];

    novasLinhas.splice(indexOriginal + 1, 0, novaLinha);
    setLinhas(novasLinhas);

    if (
      novaLinha.turma_id &&
      novaLinha.disciplina_id &&
      novaLinha.dia_semana &&
      novaLinha.slot_horario_id
    ) {
      salvarLinhaNoBanco(novaLinha);
    }
  };

  const atualizarCampo = async (id: string, campo: string, valor: string) => {
    const novasLinhas = linhas.map((linha) => {
      if (linha.id === id) {
        const linhaAtualizada = { ...linha, [campo]: valor };
        // Limpa a disciplina se a turma for alterada, pois a matriz muda
        if (campo === "turma_id") {
          linhaAtualizada.disciplina_id = "";
        }
        return linhaAtualizada;
      }
      return linha;
    });

    setLinhas(novasLinhas);

    const linhaAtualizada = novasLinhas.find((l) => l.id === id);

    if (
      linhaAtualizada &&
      linhaAtualizada.turma_id &&
      linhaAtualizada.disciplina_id &&
      linhaAtualizada.dia_semana &&
      linhaAtualizada.slot_horario_id
    ) {
      await salvarLinhaNoBanco(linhaAtualizada);
    }
  };

  const salvarLinhaNoBanco = async (linha: any) => {
    const payload = {
      id: linha.id,
      turma_id: linha.turma_id,
      disciplina_id: linha.disciplina_id,
      professor_id: linha.professor_id === "" ? null : linha.professor_id,
      espaco_id: linha.espaco_id === "" ? null : linha.espaco_id,
      dia_semana: linha.dia_semana,
      slot_horario_id: linha.slot_horario_id,
    };

    const { error } = await supabase.from("aulas").upsert(payload);
    if (!error) {
      recarregarAulas();
    } else {
      console.error("Erro ao salvar linha no Supabase:", error);
    }
  };

  const removerLinha = async (id: string) => {
    setLinhas(linhas.filter((l) => l.id !== id));
    const { error } = await supabase.from("aulas").delete().eq("id", id);
    if (!error) recarregarAulas();
  };

  const calcularConflitos = () => {
    const conflitos = new Map<string, string[]>();
    const linhasValidas = linhas.filter((l) => l.dia_semana);

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

    linhasValidas.forEach((aulaAtual) => {
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

        linhasValidas.forEach((outraAula) => {
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
              errosDaLinha.push(
                "Choque: Sala/Laboratório já ocupado neste horário.",
              );
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
            "Limite: Mais de 2 aulas geminadas da mesma disciplina hoje.",
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

  // ==========================================================================
  // NOVA FUNÇÃO: LEITURA DINÂMICA DA COR DO BANCO DE DADOS
  // ==========================================================================
  const obterCorDoBanco = (turmaId: string) => {
    if (!turmaId) return ""; // Linha vazia não tem cor

    // Encontra a turma para pegar o ID do curso
    const turmaObj = turmas.find((t: any) => String(t.id) === String(turmaId));
    if (!turmaObj || !turmaObj.curso_id) return "";

    // Encontra o curso correspondente e pega a cor
    const cursoObj = cursos.find(
      (c: any) => String(c.id) === String(turmaObj.curso_id),
    );
    if (!cursoObj || !cursoObj.cor_identificacao) return "";

    return cursoObj.cor_identificacao; // Retorna o Hexadecimal (ex: #d1fae5)
  };

  // Função para renderizar as turmas agrupadas por curso
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-4 bg-gray-50 flex justify-between items-center border-b border-gray-200">
        <div>
          <h2 className="font-bold text-gray-700 text-lg">
            Edição em Lote (Planilha)
          </h2>
          <p className="text-sm text-gray-500">
            O salvamento é automático ao preencher turma, disciplina, dia e
            horário.
          </p>
        </div>
        <button
          onClick={adicionarLinha}
          className="bg-green-600 text-white px-4 py-2 rounded shadow-sm text-sm font-bold hover:bg-green-700 transition-colors flex items-center gap-2"
        >
          <span className="text-lg leading-none">+</span> Nova Linha
        </button>
      </div>

      <div className="w-full">
        <table className="w-full text-left border-collapse table-fixed">
          <thead>
            <tr className="bg-green-700 text-white text-sm uppercase tracking-wider">
              <th className="p-3 border-r border-green-600 w-[12%]">Turma</th>
              <th className="p-3 border-r border-green-600 w-[23%]">
                Disciplina
              </th>
              <th className="p-3 border-r border-green-600 w-[20%]">
                Professor
              </th>
              <th className="p-3 border-r border-green-600 w-[12%]">Dia</th>
              <th className="p-3 border-r border-green-600 w-[13%]">Horário</th>
              <th className="p-3 border-r border-green-600 w-[12%]">Sala</th>
              <th className="p-3 text-center w-20">Ação</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {linhas.map((linha) => {
              const temDado =
                linha.turma_id ||
                linha.disciplina_id ||
                linha.professor_id ||
                linha.dia_semana ||
                linha.slot_horario_id ||
                linha.espaco_id;
              const estaCompleta =
                linha.turma_id &&
                linha.disciplina_id &&
                linha.dia_semana &&
                linha.slot_horario_id;
              const linhaRascunho = temDado && !estaCompleta;

              const erros = mapaDeConflitos.get(linha.id) || [];
              const temConflito = erros.length > 0;

              // Obtém o Hexadecimal direto do banco
              const corHexadecimal = obterCorDoBanco(linha.turma_id);

              // Tailwind classes base.
              // 'hover:brightness-95' cria o efeito de passar o mouse mesmo se a cor for injetada via style
              let classeLinha =
                "border-b transition-all group hover:brightness-95 ";

              // Se tiver conflito, aplica a Borda Vermelha (outline) preservando o fundo
              if (temConflito) {
                classeLinha +=
                  " outline outline-2 outline-offset-[-2px] outline-red-600 z-10 relative";
              } else if (linhaRascunho) {
                classeLinha += " border-l-4 border-l-yellow-400";
              }

              // Filtra as disciplinas baseadas na turma selecionada
              const turmaSelecionadaObj = turmas.find(
                (t: any) => String(t.id) === String(linha.turma_id),
              );
              const cursoId = turmaSelecionadaObj?.curso_id;
              const disciplinasFiltradas = cursoId
                ? disciplinas
                    .filter((d: any) => String(d.curso_id) === String(cursoId))
                    .sort((a: any, b: any) => a.nome.localeCompare(b.nome))
                : [];

              return (
                <tr
                  key={linha.id}
                  className={classeLinha}
                  style={
                    corHexadecimal ? { backgroundColor: corHexadecimal } : {}
                  } // Injeção CSS Dinâmica
                >
                  <td className="p-2 border-r border-gray-200/50 overflow-hidden">
                    <select
                      value={linha.turma_id || ""}
                      onChange={(e) =>
                        atualizarCampo(linha.id, "turma_id", e.target.value)
                      }
                      className="w-full truncate bg-transparent border-0 border-b border-transparent focus:border-green-500 focus:ring-0 text-sm p-1 outline-none font-bold text-gray-800"
                      title={
                        turmas.find(
                          (t: any) => String(t.id) === String(linha.turma_id),
                        )?.codigo || "Selecione..."
                      }
                    >
                      <option value="">Selecione...</option>
                      {renderOpcoesTurmas()}
                    </select>
                  </td>
                  <td className="p-2 border-r border-gray-200/50 overflow-hidden">
                    <select
                      disabled={!linha.turma_id}
                      value={linha.disciplina_id || ""}
                      onChange={(e) =>
                        atualizarCampo(
                          linha.id,
                          "disciplina_id",
                          e.target.value,
                        )
                      }
                      className="w-full truncate bg-transparent border-0 border-b border-transparent focus:border-green-500 focus:ring-0 text-sm p-1 outline-none font-bold text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                      title={
                        disciplinas.find(
                          (d: any) =>
                            String(d.id) === String(linha.disciplina_id),
                        )?.nome || "Selecione a turma..."
                      }
                    >
                      {!linha.turma_id ? (
                        <option value="">Selecione a turma...</option>
                      ) : disciplinasFiltradas.length === 0 ? (
                        <option value="">Nenhuma disciplina no curso...</option>
                      ) : (
                        <>
                          <option value="">Selecione...</option>
                          {disciplinasFiltradas.map((d: any) => (
                            <option key={d.id} value={d.id}>
                              {d.nome}
                            </option>
                          ))}
                        </>
                      )}
                    </select>
                  </td>
                  <td className="p-2 border-r border-gray-200/50 overflow-hidden">
                    <select
                      value={linha.professor_id || ""}
                      onChange={(e) =>
                        atualizarCampo(linha.id, "professor_id", e.target.value)
                      }
                      className="w-full truncate bg-transparent border-0 border-b border-transparent focus:border-green-500 focus:ring-0 text-sm p-1 outline-none text-gray-700 font-medium"
                      title={
                        professores.find(
                          (p: any) =>
                            String(p.id) === String(linha.professor_id),
                        )?.nome || "Selecione..."
                      }
                    >
                      <option value="">(Nenhum)</option>
                      {professores.map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.nome}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2 border-r border-gray-200/50 overflow-hidden">
                    <select
                      value={linha.dia_semana || ""}
                      onChange={(e) =>
                        atualizarCampo(linha.id, "dia_semana", e.target.value)
                      }
                      className="w-full truncate bg-transparent border-0 border-b border-transparent focus:border-green-500 focus:ring-0 text-sm p-1 outline-none text-gray-700 font-medium"
                    >
                      <option value="">Selecione...</option>
                      <option value="SEGUNDA">Segunda-feira</option>
                      <option value="TERCA">Terça-feira</option>
                      <option value="QUARTA">Quarta-feira</option>
                      <option value="QUINTA">Quinta-feira</option>
                      <option value="SEXTA">Sexta-feira</option>
                    </select>
                  </td>
                  <td className="p-2 border-r border-gray-200/50 overflow-hidden">
                    <select
                      value={linha.slot_horario_id || ""}
                      onChange={(e) =>
                        atualizarCampo(
                          linha.id,
                          "slot_horario_id",
                          e.target.value,
                        )
                      }
                      className="w-full truncate bg-transparent border-0 border-b border-transparent focus:border-green-500 focus:ring-0 text-sm p-1 outline-none text-gray-700 font-medium"
                    >
                      <option value="">Selecione...</option>
                      {slots.map((s: any) => (
                        <option key={s.id} value={s.id}>
                          {formatarHora(s.hora_inicio)} -{" "}
                          {formatarHora(s.hora_fim)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2 border-r border-gray-200/50 overflow-hidden">
                    <select
                      value={linha.espaco_id || ""}
                      onChange={(e) =>
                        atualizarCampo(linha.id, "espaco_id", e.target.value)
                      }
                      className="w-full truncate bg-transparent border-0 border-b border-transparent focus:border-green-500 focus:ring-0 text-sm p-1 outline-none text-gray-700 font-medium"
                      title={
                        espacos.find(
                          (e: any) => String(e.id) === String(linha.espaco_id),
                        )?.nome || "Selecione..."
                      }
                    >
                      <option value="">(Nenhum)</option>
                      {espacos.map((e: any) => (
                        <option key={e.id} value={e.id}>
                          {e.nome}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2 text-center transition-colors">
                    <div className="flex items-center justify-center gap-2 relative">
                      {temConflito && (
                        <span
                          className="text-red-600 font-bold cursor-help text-lg animate-pulse bg-white/50 rounded-full w-6 h-6 flex items-center justify-center shadow-sm"
                          title={erros?.join("\n")}
                        >
                          ⚠️
                        </span>
                      )}
                      <button
                        onClick={() => duplicarLinha(linha.id)}
                        className="text-blue-600/60 hover:text-blue-700 hover:bg-white/50 font-bold px-1.5 py-1 rounded text-lg transition-colors"
                        title="Duplicar linha (Aulas Geminadas)"
                      >
                        ⧉
                      </button>
                      <button
                        onClick={() => removerLinha(linha.id)}
                        className="text-red-600/60 hover:text-red-700 hover:bg-white/50 font-bold px-1.5 py-1 rounded transition-colors"
                        title="Remover linha"
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
