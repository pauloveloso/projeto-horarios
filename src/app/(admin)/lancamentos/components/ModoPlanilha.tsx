"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";

export default function ModoPlanilha({
  versaoId,
  aulas,
  choques = [], // <-- NOVO: Recebendo a inteligência da View
  turmas,
  cursos = [],
  professores,
  disciplinas,
  espacos,
  slots,
  recarregarAulas,
}: any) {
  const [linhas, setLinhas] = useState<any[]>([]);
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("");

  const formatarHora = (hora: string) => {
    if (!hora) return "";
    return hora.substring(0, 5);
  };

  const criarLinhaVazia = () => ({
    id: crypto.randomUUID(),
    turma_id: "",
    disciplina_id: "",
    professor_id: "",
    dia_semana: "",
    slot_horario_id: "",
    espaco_id: "",
  });

  // ==== TRADUTOR DE ALERTAS DA VIEW ====
  const mapearMensagem = (choque: any) => {
    // Se a View mandou uma mensagem específica (ex: Justificativa médica), usamos ela
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
      case "CARGA_INCOMPLETA":
        return "🟡 Carga Horária: Faltam aulas para esta disciplina.";
      case "EXCESSO_CARGA":
        return "🟡 Carga Horária: Disciplina com mais aulas que o permitido.";
      case "FIM_DE_SEMANA":
        return "🟡 Atenção: Professor leciona Sexta à noite e Segunda de manhã.";
      default:
        return "⚠️ Problema detectado.";
    }
  };

  const getCategoriaCurso = (curso: any) => {
    const mod = (curso.modalidade || "").trim().toUpperCase();
    return mod ? mod : "SEM MODALIDADE";
  };

  const categoriasDisponiveis = useMemo(() => {
    const cats = new Set<string>();
    cursos.forEach((c: any) => cats.add(getCategoriaCurso(c)));

    const temAulasSemCurso = aulas.some((a: any) => {
      const t = turmas.find(
        (turma: any) => String(turma.id) === String(a.turma_id),
      );
      return (
        !t?.curso_id ||
        !cursos.some((c: any) => String(c.id) === String(t.curso_id))
      );
    });
    if (temAulasSemCurso) cats.add("AULAS ÓRFÃS / ERRO DE CADASTRO");

    return Array.from(cats).sort();
  }, [cursos, aulas, turmas]);

  useEffect(() => {
    if (!categoriaFiltro && categoriasDisponiveis.length > 0) {
      if (categoriasDisponiveis.includes("INTEGRADO"))
        setCategoriaFiltro("INTEGRADO");
      else setCategoriaFiltro(categoriasDisponiveis[0]);
    }
  }, [categoriasDisponiveis, categoriaFiltro]);

  const disciplinasPorCurso = useMemo(() => {
    const mapa = new Map();
    cursos.forEach((c: any) => {
      const disc = disciplinas
        .filter((d: any) => String(d.curso_id) === String(c.id))
        .sort((a: any, b: any) => a.nome.localeCompare(b.nome));
      mapa.set(String(c.id), disc);
    });
    return mapa;
  }, [cursos, disciplinas]);

  const mapaCoresTurma = useMemo(() => {
    const mapa = new Map();
    turmas.forEach((t: any) => {
      const c = cursos.find((c: any) => String(c.id) === String(t.curso_id));
      if (c?.cor_identificacao) mapa.set(String(t.id), c.cor_identificacao);
    });
    return mapa;
  }, [turmas, cursos]);

  const opcoesProfessores = useMemo(
    () => (
      <>
        <option value="">(Nenhum)</option>
        {professores.map((p: any) => (
          <option key={p.id} value={p.id}>
            {p.nome}
          </option>
        ))}
      </>
    ),
    [professores],
  );

  const opcoesEspacos = useMemo(
    () => (
      <>
        <option value="">(Nenhum)</option>
        {espacos.map((e: any) => (
          <option key={e.id} value={e.id}>
            {e.nome}
          </option>
        ))}
      </>
    ),
    [espacos],
  );

  const opcoesSlots = useMemo(
    () => (
      <>
        <option value="">Selecione...</option>
        {slots.map((s: any) => (
          <option key={s.id} value={s.id}>
            {formatarHora(s.hora_inicio)} - {formatarHora(s.hora_fim)}
          </option>
        ))}
      </>
    ),
    [slots],
  );

  const opcoesTurmasFiltradas = useMemo(() => {
    const cursosOrdenados = [...cursos]
      .filter((c) => getCategoriaCurso(c) === categoriaFiltro)
      .sort((a, b) => a.nome.localeCompare(b.nome));

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
  }, [cursos, turmas, categoriaFiltro]);

  useEffect(() => {
    if (!categoriaFiltro) return;

    const aulasMapeadas = aulas.map((a: any) => ({ ...a }));
    const mapaDiasOrdenacao: Record<string, number> = {
      SEGUNDA: 1,
      TERCA: 2,
      QUARTA: 3,
      QUINTA: 4,
      SEXTA: 5,
    };

    const ordenarInterno = (a: any, b: any) => {
      const turmaObjA = turmas.find(
        (t: any) => String(t.id) === String(a.turma_id),
      );
      const turmaObjB = turmas.find(
        (t: any) => String(t.id) === String(b.turma_id),
      );

      const turmaNomeA = (turmaObjA?.codigo || "").toUpperCase();
      const turmaNomeB = (turmaObjB?.codigo || "").toUpperCase();
      if (turmaNomeA !== turmaNomeB)
        return turmaNomeA.localeCompare(turmaNomeB);

      const diaA = mapaDiasOrdenacao[a.dia_semana] || 99;
      const diaB = mapaDiasOrdenacao[b.dia_semana] || 99;
      if (diaA !== diaB) return diaA - diaB;

      const slotObjA = slots.find(
        (s: any) => String(s.id) === String(a.slot_horario_id),
      );
      const slotObjB = slots.find(
        (s: any) => String(s.id) === String(b.slot_horario_id),
      );
      const horaA = slotObjA?.hora_inicio || "99:99";
      const horaB = slotObjB?.hora_inicio || "99:99";
      return horaA.localeCompare(horaB);
    };

    const novasLinhas: any[] = [];
    const cursosOrdenados = [...cursos].sort((a: any, b: any) =>
      (a.nome || "").localeCompare(b.nome || ""),
    );

    if (categoriaFiltro !== "AULAS ÓRFÃS / ERRO DE CADASTRO") {
      const cursosDaCategoria = cursosOrdenados.filter(
        (c) => getCategoriaCurso(c) === categoriaFiltro,
      );
      cursosDaCategoria.forEach((curso: any) => {
        const aulasDesteCurso = aulasMapeadas.filter((a: any) => {
          const t = turmas.find(
            (turma: any) => String(turma.id) === String(a.turma_id),
          );
          return String(t?.curso_id) === String(curso.id);
        });

        if (aulasDesteCurso.length > 0) {
          aulasDesteCurso.sort(ordenarInterno);
          novasLinhas.push(...aulasDesteCurso);
          novasLinhas.push(criarLinhaVazia());
        }
      });
    } else {
      const aulasSemCurso = aulasMapeadas.filter((a: any) => {
        const t = turmas.find(
          (turma: any) => String(turma.id) === String(a.turma_id),
        );
        return (
          !t?.curso_id ||
          !cursos.some((c: any) => String(c.id) === String(t.curso_id))
        );
      });

      if (aulasSemCurso.length > 0) {
        aulasSemCurso.sort(ordenarInterno);
        novasLinhas.push(...aulasSemCurso);
      }
    }

    if (novasLinhas.length === 0) {
      for (let i = 0; i < 5; i++) novasLinhas.push(criarLinhaVazia());
    }

    setLinhas(novasLinhas);
  }, [aulas, turmas, cursos, slots, categoriaFiltro]);

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
        if (campo === "turma_id") linhaAtualizada.disciplina_id = "";
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
      versao_id: versaoId,
      turma_id: linha.turma_id,
      disciplina_id: linha.disciplina_id,
      professor_id: linha.professor_id === "" ? null : linha.professor_id,
      espaco_id: linha.espaco_id === "" ? null : linha.espaco_id,
      dia_semana: linha.dia_semana,
      slot_horario_id: linha.slot_horario_id,
    };

    const { error } = await supabase.from("aulas").upsert(payload);
    if (!error) recarregarAulas();
    else console.error("Erro ao salvar linha no Supabase:", error);
  };

  const removerLinha = async (id: string) => {
    setLinhas(linhas.filter((l) => l.id !== id));
    const { error } = await supabase.from("aulas").delete().eq("id", id);
    if (!error) recarregarAulas();
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex flex-wrap gap-2">
        {categoriasDisponiveis.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoriaFiltro(cat)}
            className={`px-4 py-1.5 rounded-full text-xs font-black transition-all border ${
              categoriaFiltro === cat
                ? "bg-green-700 text-white border-green-700 shadow-sm"
                : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100 hover:text-gray-800"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="p-4 bg-gray-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-200">
        <div>
          <h2 className="font-bold text-gray-700 text-lg">
            Planilha: <span className="text-green-700">{categoriaFiltro}</span>
          </h2>
          <p className="text-sm text-gray-500">
            {linhas.length} linha(s) exibida(s) nesta categoria.
          </p>
        </div>
        <button
          onClick={adicionarLinha}
          className="bg-green-600 text-white px-4 py-2 rounded shadow-sm text-sm font-bold hover:bg-green-700 transition-colors flex items-center gap-2 w-full md:w-auto justify-center"
        >
          <span className="text-lg leading-none">+</span> Adicionar Linha Vazia
        </button>
      </div>

      <div className="w-full overflow-x-auto">
        <table className="w-full text-left border-collapse table-fixed min-w-[800px]">
          <thead>
            <tr className="bg-green-800 text-white text-xs uppercase tracking-wider">
              <th className="p-3 border-r border-green-700 w-[15%] font-black">
                Turma
              </th>
              <th className="p-3 border-r border-green-700 w-[23%] font-black">
                Disciplina
              </th>
              <th className="p-3 border-r border-green-700 w-[20%] font-black">
                Professor
              </th>
              <th className="p-3 border-r border-green-700 w-[12%] font-black">
                Dia
              </th>
              <th className="p-3 border-r border-green-700 w-[13%] font-black">
                Horário
              </th>
              <th className="p-3 border-r border-green-700 w-[12%] font-black">
                Sala
              </th>
              <th className="p-3 text-center w-[5%] font-black">Ação</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {linhas.map((linha) => {
              const temDado =
                linha.turma_id ||
                linha.disciplina_id ||
                linha.professor_id ||
                linha.dia_semana ||
                linha.slot_horario_id;
              const estaCompleta =
                linha.turma_id &&
                linha.disciplina_id &&
                linha.dia_semana &&
                linha.slot_horario_id;
              const linhaRascunho = temDado && !estaCompleta;
              const corHexadecimal =
                mapaCoresTurma.get(String(linha.turma_id)) || "";

              // ==========================================
              // NOVA LÓGICA DE CORES BASEADA NA VIEW
              // ==========================================
              const problemas = choques.filter(
                (c: any) => c.id_aula_foco === linha.id,
              );
              const criticos = problemas.filter((c: any) =>
                [
                  "CHOQUE_TURMA",
                  "CHOQUE_ESPACO",
                  "CHOQUE_DOCENTE",
                  "DESCANSO_DOCENTE",
                  "LIMITE_TURNOS",
                  "INDISPONIBILIDADE",
                ].includes(c.tipo_choque),
              );
              const alertas = problemas.filter((c: any) =>
                [
                  "DIA_PLANEJAMENTO",
                  "AULAS_GEMINADAS",
                  "FIM_DE_SEMANA",
                ].includes(c.tipo_choque),
              );

              const temCritico = criticos.length > 0;
              const temAlerta = alertas.length > 0;
              const temProblema = temCritico || temAlerta;

              // Antes era p.tipo_choque, agora passamos o objeto inteiro 'p' para a função
              const textosProblemas = problemas.map((p: any) =>
                mapearMensagem(p),
              );

              let classeLinha =
                "border-b transition-all group hover:brightness-95 ";
              if (temCritico) {
                classeLinha +=
                  " outline outline-2 outline-offset-[-2px] outline-red-600 z-10 relative";
              } else if (temAlerta) {
                classeLinha +=
                  " outline outline-2 outline-offset-[-2px] outline-yellow-400 z-10 relative";
              } else if (linhaRascunho) {
                classeLinha += " border-l-4 border-l-yellow-400";
              }
              // ==========================================

              const turmaObj = turmas.find(
                (t: any) => String(t.id) === String(linha.turma_id),
              );
              const disciplinasFiltradas = turmaObj?.curso_id
                ? disciplinasPorCurso.get(String(turmaObj.curso_id)) || []
                : [];

              return (
                <tr
                  key={linha.id}
                  className={classeLinha}
                  style={
                    corHexadecimal ? { backgroundColor: corHexadecimal } : {}
                  }
                >
                  <td className="p-2 border-r border-gray-200/50 overflow-hidden">
                    <select
                      value={linha.turma_id || ""}
                      onChange={(e) =>
                        atualizarCampo(linha.id, "turma_id", e.target.value)
                      }
                      className="w-full truncate bg-transparent border-0 border-b border-transparent focus:border-green-500 focus:ring-0 text-[13px] p-1 outline-none font-bold text-gray-800"
                    >
                      <option value="">Selecione...</option>
                      {opcoesTurmasFiltradas}
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
                      className="w-full truncate bg-transparent border-0 border-b border-transparent focus:border-green-500 focus:ring-0 text-[13px] p-1 outline-none font-bold text-gray-800 disabled:opacity-50"
                    >
                      <option value="">Selecione...</option>
                      {disciplinasFiltradas.map((d: any) => (
                        <option key={d.id} value={d.id}>
                          {d.nome}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2 border-r border-gray-200/50 overflow-hidden">
                    <select
                      value={linha.professor_id || ""}
                      onChange={(e) =>
                        atualizarCampo(linha.id, "professor_id", e.target.value)
                      }
                      className="w-full truncate bg-transparent border-0 border-b border-transparent focus:border-green-500 focus:ring-0 text-[13px] p-1 outline-none"
                    >
                      {opcoesProfessores}
                    </select>
                  </td>
                  <td className="p-2 border-r border-gray-200/50 overflow-hidden">
                    <select
                      value={linha.dia_semana || ""}
                      onChange={(e) =>
                        atualizarCampo(linha.id, "dia_semana", e.target.value)
                      }
                      className="w-full truncate bg-transparent border-0 border-b border-transparent focus:border-green-500 focus:ring-0 text-[13px] p-1 outline-none"
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
                      className="w-full truncate bg-transparent border-0 border-b border-transparent focus:border-green-500 focus:ring-0 text-[13px] p-1 outline-none"
                    >
                      {opcoesSlots}
                    </select>
                  </td>
                  <td className="p-2 border-r border-gray-200/50 overflow-hidden">
                    <select
                      value={linha.espaco_id || ""}
                      onChange={(e) =>
                        atualizarCampo(linha.id, "espaco_id", e.target.value)
                      }
                      className="w-full truncate bg-transparent border-0 border-b border-transparent focus:border-green-500 focus:ring-0 text-[13px] p-1 outline-none"
                    >
                      {opcoesEspacos}
                    </select>
                  </td>
                  <td className="p-2 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      {/* ÍCONE DINÂMICO DA VIEW */}
                      {temProblema && (
                        <span
                          className="font-bold cursor-help text-lg animate-pulse"
                          title={textosProblemas.join("\n")}
                        >
                          {temCritico ? "🔴" : "🟡"}
                        </span>
                      )}
                      <button
                        onClick={() => duplicarLinha(linha.id)}
                        className="text-blue-600/60 hover:text-blue-700 font-bold p-1 rounded text-lg"
                        title="Duplicar"
                      >
                        ⧉
                      </button>
                      <button
                        onClick={() => removerLinha(linha.id)}
                        className="text-red-600/60 hover:text-red-700 font-bold p-1 rounded"
                        title="Remover"
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
