"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";

export default function ModoPlanilha({
  versaoId,
  aulas,
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

  // =========================================================================
  // LÓGICA 100% DINÂMICA: As abas são geradas baseadas no campo 'modalidade'
  // =========================================================================
  const getCategoriaCurso = (curso: any) => {
    // Pega a modalidade, remove espaços em branco e deixa maiúsculo.
    // Se estiver vazio, chama de "SEM MODALIDADE".
    const mod = (curso.modalidade || "").trim().toUpperCase();
    return mod ? mod : "SEM MODALIDADE";
  };

  const categoriasDisponiveis = useMemo(() => {
    const cats = new Set<string>();

    // Adiciona todas as modalidades que existirem no banco
    cursos.forEach((c: any) => cats.add(getCategoriaCurso(c)));

    // Verifica se existem aulas perdidas (sem turma ou curso) para não as esconder
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
    // Seleciona a primeira aba disponível automaticamente ao abrir
    if (!categoriaFiltro && categoriasDisponiveis.length > 0) {
      if (categoriasDisponiveis.includes("INTEGRADO"))
        setCategoriaFiltro("INTEGRADO");
      else setCategoriaFiltro(categoriasDisponiveis[0]);
    }
  }, [categoriasDisponiveis, categoriaFiltro]);

  // =========================================================================
  // OTIMIZAÇÕES DE PERFORMANCE
  // =========================================================================
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

  // =========================================================================
  // GERAÇÃO DAS LINHAS DA PLANILHA (Agrupadas e Ordenadas)
  // =========================================================================
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
          novasLinhas.push(criarLinhaVazia()); // Espaço visual entre cursos
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

    // Se a aba não tiver nenhuma aula ainda, coloca 5 linhas em branco para começar
    if (novasLinhas.length === 0) {
      for (let i = 0; i < 5; i++) novasLinhas.push(criarLinhaVazia());
    }

    setLinhas(novasLinhas);
  }, [aulas, turmas, cursos, slots, categoriaFiltro]);

  // =========================================================================
  // FUNÇÕES DE AÇÃO
  // =========================================================================
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

  const calcularConflitos = () => {
    const conflitos = new Map<string, string[]>();
    const linhasValidas = linhas.filter((l) => l.dia_semana && l.turma_id);

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
          if (
            String(professorResp.dia_planejamento).trim().toUpperCase() ===
            String(aulaAtual.dia_semana).trim().toUpperCase()
          ) {
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
            if (
              isPrimeiraDaManha(slotAtual.hora_inicio) &&
              outraAula.dia_semana === getDiaAnterior(aulaAtual.dia_semana) &&
              isUltimaDaNoite(outroSlot.hora_fim)
            ) {
              errosDaLinha.push(
                "Alerta Trabalhista: Sem descanso (Lecionou na última aula da noite passada).",
              );
            }
            if (
              isUltimaDaNoite(slotAtual.hora_fim) &&
              outraAula.dia_semana === getDiaSeguinte(aulaAtual.dia_semana) &&
              isPrimeiraDaManha(outroSlot.hora_inicio)
            ) {
              errosDaLinha.push(
                "Alerta Trabalhista: Sem descanso (Alocado na primeira aula da manhã seguinte).",
              );
            }
          }
        });

        if (turnoAtual) turnosDoProfessorNoDia.add(turnoAtual);
        if (turnosDoProfessorNoDia.size > 2)
          errosDaLinha.push(
            `Limite: Professor alocado em ${turnosDoProfessorNoDia.size} turnos hoje.`,
          );
        if (aulasDestaDisciplinaNoDia + 1 > 2)
          errosDaLinha.push(
            "Limite: Mais de 2 aulas geminadas da mesma disciplina hoje.",
          );
      }

      if (errosDaLinha.length > 0)
        conflitos.set(aulaAtual.id, [...new Set(errosDaLinha)]);
    });

    return conflitos;
  };

  const mapaDeConflitos = calcularConflitos();

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* ABAS DE NAVEGAÇÃO DE MODALIDADES GERADAS DINAMICAMENTE */}
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
              const erros = mapaDeConflitos.get(linha.id) || [];
              const temConflito = erros.length > 0;
              const corHexadecimal =
                mapaCoresTurma.get(String(linha.turma_id)) || "";

              let classeLinha =
                "border-b transition-all group hover:brightness-95 ";
              if (temConflito)
                classeLinha +=
                  " outline outline-2 outline-offset-[-2px] outline-red-600 z-10 relative";
              else if (linhaRascunho)
                classeLinha += " border-l-4 border-l-yellow-400";

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
                      {temConflito && (
                        <span
                          className="text-red-600 font-bold cursor-help text-lg animate-pulse"
                          title={erros?.join("\n")}
                        >
                          ⚠️
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
