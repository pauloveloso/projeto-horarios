"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function ReservasPage() {
  const [carregando, setCarregando] = useState(true);
  const [carregandoGrid, setCarregandoGrid] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<"ESPACO" | "HORARIO">("HORARIO");

  // Dados Estruturais do Banco
  const [semestreAtivo, setSemestreAtivo] = useState<any>(null);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [espacos, setEspacos] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);
  const [disciplinas, setDisciplinas] = useState<any[]>([]);
  const [turmas, setTurmas] = useState<any[]>([]);

  // ==========================================
  // ESTADOS ABA 1: BUSCA POR ESPAÇO
  // ==========================================
  const [categoriaSelecionada, setCategoriaSelecionada] = useState("");
  const [espacoSelecionado, setEspacoSelecionado] = useState("");
  const [aulasDoEspaco, setAulasDoEspaco] = useState<any[]>([]);
  const [reservasDoEspaco, setReservasDoEspaco] = useState<any[]>([]);
  const [dataSegundaFeira, setDataSegundaFeira] = useState<Date>(new Date());

  const [veioDaBusca, setVeioDaBusca] = useState(false);

  // ==========================================
  // ESTADOS ABA 2: BUSCA POR HORÁRIO
  // ==========================================
  const [categoriaBusca, setCategoriaBusca] = useState<string>("");
  const [dataBusca, setDataBusca] = useState<string>("");
  const [slotBuscaId, setSlotBuscaId] = useState<string>("");
  const [espacosDisponiveis, setEspacosDisponiveis] = useState<any[]>([]);
  const [buscaRealizada, setBuscaRealizada] = useState(false);
  const [carregandoBusca, setCarregandoBusca] = useState(false);

  // ==========================================
  // ESTADOS DO MODAL E MODO CÓPIA
  // ==========================================
  const [modalAberto, setModalAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [reservaCopiada, setReservaCopiada] = useState<any>(null);

  const [dadosReserva, setDadosReserva] = useState<any>({
    id: null,
    espaco_id: "",
    dia_semana: "",
    slot_horario_id: "",
    data_reserva: "",
    hora_inicio: "",
    hora_fim: "",
  });

  const [formReserva, setFormReserva] = useState({
    nome_solicitante: "",
    email_solicitante: "",
    turma_curso: "",
    disciplina_evento: "",
  });

  const diasSemana = [
    { id: "DOMINGO", nome: "Domingo" },
    { id: "SEGUNDA", nome: "Segunda" },
    { id: "TERCA", nome: "Terça" },
    { id: "QUARTA", nome: "Quarta" },
    { id: "QUINTA", nome: "Quinta" },
    { id: "SEXTA", nome: "Sexta" },
    { id: "SABADO", nome: "Sábado" },
  ];

  const diasUteis = diasSemana.filter(
    (d) => d.id !== "DOMINGO" && d.id !== "SABADO",
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setReservaCopiada(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    async function carregarDadosIniciais() {
      try {
        const [
          { data: periodosDb },
          { data: categoriasDb },
          { data: espacosDb },
          { data: slotsDb },
          { data: disciplinasDb },
          { data: turmasDb },
        ] = await Promise.all([
          // BUSCA OS PERÍODOS LETIVOS ATIVOS NO NOVO MÓDULO
          supabase.from("periodos_letivos").select("*").eq("status", "ATIVO"),
          supabase.from("categorias_espacos").select("*").order("nome"),
          supabase.from("espacos").select("*").order("nome"),
          supabase
            .from("slots_horarios")
            .select("*")
            .eq("ativo", true)
            .order("hora_inicio"),
          supabase.from("disciplinas").select("id, nome"),
          supabase.from("turmas").select("id, codigo"),
        ]);

        // LÓGICA DE ENVELOPE: Junta os períodos ativos (ex: Integrado e Superior) num único intervalo
        if (periodosDb && periodosDb.length > 0) {
          let minData = new Date("2999-12-31T00:00:00");
          let maxData = new Date("2000-01-01T23:59:59");
          let nomesPeriodos: string[] = [];

          periodosDb.forEach((p) => {
            const dInicio = new Date(p.data_inicio + "T00:00:00");
            const dFim = new Date(p.data_fim + "T23:59:59");
            if (dInicio < minData) minData = dInicio;
            if (dFim > maxData) maxData = dFim;
            nomesPeriodos.push(p.sigla);
          });

          const semVirtual = {
            data_inicio: minData.toISOString().split("T")[0],
            data_fim: maxData.toISOString().split("T")[0],
            nome_semestre: nomesPeriodos.join(" / "),
          };

          setSemestreAtivo(semVirtual);
          const hoje = new Date();
          let dataAlvo =
            hoje < minData ? minData : hoje > maxData ? maxData : hoje;

          setDataBusca(dataAlvo.toISOString().split("T")[0]);

          const day = dataAlvo.getDay();
          const diff = dataAlvo.getDate() - day + (day === 0 ? -6 : 1);
          setDataSegundaFeira(new Date(dataAlvo.setDate(diff)));
        }

        setCategorias(categoriasDb || []);
        setEspacos(espacosDb || []);
        setSlots(slotsDb || []);
        setDisciplinas(disciplinasDb || []);
        setTurmas(turmasDb || []);
      } catch (error) {
        console.error("Erro ao carregar dados iniciais:", error);
      } finally {
        setCarregando(false);
      }
    }
    carregarDadosIniciais();
  }, []);

  const carregarOcupacaoDoEspaco = async () => {
    if (!espacoSelecionado || !dataSegundaFeira) return;
    setCarregandoGrid(true);
    try {
      const segundaStr = dataSegundaFeira.toISOString().split("T")[0];
      const sextaFeira = new Date(dataSegundaFeira);
      sextaFeira.setDate(sextaFeira.getDate() + 4);
      const sextaStr = sextaFeira.toISOString().split("T")[0];

      const [{ data: aulas }, { data: reservas }] = await Promise.all([
        supabase.from("aulas").select("*").eq("espaco_id", espacoSelecionado),
        supabase
          .from("reservas_espacos")
          .select("*")
          .eq("espaco_id", espacoSelecionado)
          .eq("status", "APROVADA")
          .gte("data_reserva", segundaStr)
          .lte("data_reserva", sextaStr),
      ]);

      setAulasDoEspaco(aulas || []);
      setReservasDoEspaco(reservas || []);
    } catch (error) {
      console.error("Erro ao puxar dados de ocupação:", error);
    } finally {
      setCarregandoGrid(false);
    }
  };

  useEffect(() => {
    carregarOcupacaoDoEspaco();
  }, [espacoSelecionado, dataSegundaFeira]);

  const espacosFiltrados = espacos.filter(
    (e) => String(e.categoria_id) === String(categoriaSelecionada),
  );
  const formatarHora = (hora: string) => (hora ? hora.substring(0, 5) : "");
  const obterDataDoDiaDaSemana = (diasAAdicionar: number) => {
    const d = new Date(dataSegundaFeira);
    d.setDate(d.getDate() + diasAAdicionar);
    return d;
  };

  const navegarSemana = (semanas: number) => {
    const novaData = new Date(dataSegundaFeira);
    novaData.setDate(novaData.getDate() + semanas * 7);
    const inicioSemestre = new Date(semestreAtivo.data_inicio + "T00:00:00");
    const fimSemestre = new Date(semestreAtivo.data_fim + "T23:59:59");
    const novaSexta = new Date(novaData);
    novaSexta.setDate(novaSexta.getDate() + 4);

    if (novaData <= fimSemestre && novaSexta >= inicioSemestre) {
      setDataSegundaFeira(novaData);
    }
  };

  const obterOcupacaoCelular = (
    diaId: string,
    slotId: string,
    diasAdicionais: number,
  ) => {
    const aula = aulasDoEspaco.find(
      (a) =>
        a.dia_semana === diaId && String(a.slot_horario_id) === String(slotId),
    );
    if (aula) {
      const disc = disciplinas.find(
        (d) => String(d.id) === String(aula.disciplina_id),
      );
      const turmaInfo = turmas.find(
        (t) => String(t.id) === String(aula.turma_id),
      );
      const codTurma = turmaInfo ? `${turmaInfo.codigo} - ` : "";
      return {
        tipo: "AULA",
        nome: `${codTurma}${disc?.nome || "Aula Regular"}`,
        raw: aula,
      };
    }
    const dataAlvoStr = obterDataDoDiaDaSemana(diasAdicionais)
      .toISOString()
      .split("T")[0];
    const reserva = reservasDoEspaco.find(
      (r) =>
        r.data_reserva === dataAlvoStr &&
        String(r.slot_horario_id) === String(slotId),
    );
    if (reserva) {
      const infoExtra = reserva.turma_curso ? ` [${reserva.turma_curso}]` : "";
      return {
        tipo: "RESERVA",
        nome: `${reserva.disciplina_evento}${infoExtra} (${reserva.nome_solicitante})`,
        raw: reserva,
      };
    }
    return null;
  };

  const handleSlotLivreClick = async (
    diaId: string,
    slot: any,
    diasAdicionais: number,
  ) => {
    const dataSelecionada = obterDataDoDiaDaSemana(diasAdicionais)
      .toISOString()
      .split("T")[0];

    if (reservaCopiada) {
      setCarregandoGrid(true);
      try {
        await supabase.from("reservas_espacos").insert([
          {
            espaco_id: espacoSelecionado,
            slot_horario_id: slot.id,
            dia_semana: diaId,
            data_reserva: dataSelecionada,
            nome_solicitante: reservaCopiada.nome_solicitante,
            email_solicitante: reservaCopiada.email_solicitante || null,
            turma_curso: reservaCopiada.turma_curso,
            disciplina_evento: reservaCopiada.disciplina_evento,
            status: "APROVADA",
          },
        ]);
        await carregarOcupacaoDoEspaco();
      } catch (error) {
        console.error("Erro ao colar:", error);
      }
      return;
    }

    setDadosReserva({
      id: null,
      espaco_id: espacoSelecionado,
      dia_semana: diaId,
      slot_horario_id: slot.id,
      data_reserva: dataSelecionada,
      hora_inicio: formatarHora(slot.hora_inicio),
      hora_fim: formatarHora(slot.hora_fim),
    });
    setFormReserva({
      nome_solicitante: "",
      email_solicitante: "",
      turma_curso: "",
      disciplina_evento: "",
    });
    setModalAberto(true);
  };

  const handleSlotOcupadoClick = (ocupacao: any) => {
    if (reservaCopiada) return;

    if (ocupacao.tipo === "AULA") {
      return;
    }

    if (ocupacao.tipo === "RESERVA") {
      const res = ocupacao.raw;
      const slot = slots.find((s) => s.id === res.slot_horario_id);

      setDadosReserva({
        id: res.id,
        espaco_id: res.espaco_id,
        dia_semana: res.dia_semana,
        slot_horario_id: res.slot_horario_id,
        data_reserva: res.data_reserva,
        hora_inicio: formatarHora(slot.hora_inicio),
        hora_fim: formatarHora(slot.hora_fim),
      });

      setFormReserva({
        nome_solicitante: res.nome_solicitante,
        email_solicitante: res.email_solicitante || "",
        turma_curso: res.turma_curso || "",
        disciplina_evento: res.disciplina_evento,
      });
      setModalAberto(true);
    }
  };

  const buscarEspacosLivres = async () => {
    if (!dataBusca || !slotBuscaId) {
      alert("Por favor, selecione uma data e um horário.");
      return;
    }

    setCarregandoBusca(true);
    setBuscaRealizada(false);

    try {
      const dataObj = new Date(dataBusca + "T12:00:00");
      const diaDaSemana = diasSemana[dataObj.getDay()].id;

      const { data: aulas } = await supabase
        .from("aulas")
        .select("espaco_id")
        .eq("dia_semana", diaDaSemana)
        .eq("slot_horario_id", slotBuscaId)
        .eq("status", "ATIVO");

      const { data: reservas } = await supabase
        .from("reservas_espacos")
        .select("espaco_id")
        .eq("data_reserva", dataBusca)
        .eq("slot_horario_id", slotBuscaId)
        .eq("status", "APROVADA");

      const ocupadosIds = new Set([
        ...(aulas || []).map((a) => a.espaco_id),
        ...(reservas || []).map((r) => r.espaco_id),
      ]);

      let livres = espacos.filter((espaco) => !ocupadosIds.has(espaco.id));
      if (categoriaBusca) {
        livres = livres.filter(
          (e) => String(e.categoria_id) === String(categoriaBusca),
        );
      }

      setEspacosDisponiveis(livres);
      setBuscaRealizada(true);
    } catch (error) {
      console.error("Erro na busca de espaços:", error);
      alert("Houve um erro ao realizar a busca.");
    } finally {
      setCarregandoBusca(false);
    }
  };

  const navegarParaGradeDoEspaco = (espaco: any) => {
    setCategoriaSelecionada(String(espaco.categoria_id));
    setEspacoSelecionado(String(espaco.id));

    const dataAlvo = new Date(dataBusca + "T12:00:00");
    const day = dataAlvo.getDay();
    const diff = dataAlvo.getDate() - day + (day === 0 ? -6 : 1);
    setDataSegundaFeira(new Date(dataAlvo.setDate(diff)));

    setVeioDaBusca(true);
    setAbaAtiva("ESPACO");
  };

  const salvarReserva = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    try {
      const payload = {
        nome_solicitante: formReserva.nome_solicitante,
        email_solicitante: formReserva.email_solicitante || null,
        turma_curso: formReserva.turma_curso,
        disciplina_evento: formReserva.disciplina_evento,
      };

      if (dadosReserva.id) {
        await supabase
          .from("reservas_espacos")
          .update(payload)
          .eq("id", dadosReserva.id);
      } else {
        await supabase.from("reservas_espacos").insert([
          {
            ...payload,
            espaco_id: dadosReserva.espaco_id,
            slot_horario_id: dadosReserva.slot_horario_id,
            dia_semana: dadosReserva.dia_semana,
            data_reserva: dadosReserva.data_reserva,
            status: "APROVADA",
          },
        ]);
      }
      setModalAberto(false);
      carregarOcupacaoDoEspaco();
    } catch (error) {
      alert("Erro ao salvar a reserva.");
    } finally {
      setSalvando(false);
    }
  };

  const excluirReserva = async () => {
    if (!dadosReserva.id) return;
    if (
      !window.confirm(
        "Tem certeza que deseja excluir esta reserva permanentemente?",
      )
    )
      return;

    setSalvando(true);
    try {
      await supabase
        .from("reservas_espacos")
        .delete()
        .eq("id", dadosReserva.id);
      setModalAberto(false);
      carregarOcupacaoDoEspaco();
    } catch (error) {
      alert("Erro ao excluir reserva.");
    } finally {
      setSalvando(false);
    }
  };

  const iniciarModoCopia = () => {
    setReservaCopiada({
      nome_solicitante: formReserva.nome_solicitante,
      email_solicitante: formReserva.email_solicitante,
      turma_curso: formReserva.turma_curso,
      disciplina_evento: formReserva.disciplina_evento,
    });
    setModalAberto(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-10 flex flex-col h-screen overflow-hidden relative">
      {/* BARRA FLUTUANTE DO MODO CÓPIA */}
      {reservaCopiada && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-blue-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-4 animate-bounce hover:animate-none cursor-default border-2 border-white">
          <div>
            <p className="text-sm font-black tracking-wider uppercase">
              ⧉ Modo Cópia Ativo
            </p>
            <p className="text-[10px] text-blue-100 font-bold">
              Clique nos horários verdes para colar (
              {reservaCopiada.disciplina_evento})
            </p>
          </div>
          <button
            onClick={() => setReservaCopiada(null)}
            className="bg-white/20 hover:bg-white/30 p-2 rounded-full transition-colors text-xs font-bold"
            title="Pressione ESC para cancelar"
          >
            ✕ Cancelar
          </button>
        </div>
      )}

      {/* MODAL DE RESERVA */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div
              className={`p-4 text-white flex justify-between items-center ${dadosReserva.id ? "bg-indigo-800" : "bg-green-800"}`}
            >
              <h3 className="font-black text-lg">
                {dadosReserva.id ? "Detalhes da Reserva" : "Nova Reserva"}
              </h3>
              <button
                onClick={() => setModalAberto(false)}
                className="text-white/70 hover:text-white font-bold text-xl"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-gray-50 border-b border-gray-100 text-sm">
              <div className="grid grid-cols-2 gap-2 text-gray-700">
                <p>
                  <span className="font-bold text-gray-800">Local:</span>{" "}
                  {
                    espacos.find(
                      (e) => String(e.id) === String(dadosReserva.espaco_id),
                    )?.nome
                  }
                </p>
                <p>
                  <span className="font-bold text-gray-800">Data:</span>{" "}
                  {new Date(
                    dadosReserva.data_reserva + "T12:00:00",
                  ).toLocaleDateString("pt-BR")}
                </p>
                <p className="col-span-2">
                  <span className="font-bold text-gray-800">Horário:</span>{" "}
                  {dadosReserva.hora_inicio} às {dadosReserva.hora_fim}
                </p>
              </div>
            </div>

            <form onSubmit={salvarReserva} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase mb-1">
                  Nome do Solicitante *
                </label>
                <input
                  required
                  type="text"
                  value={formReserva.nome_solicitante}
                  onChange={(e) =>
                    setFormReserva({
                      ...formReserva,
                      nome_solicitante: e.target.value,
                    })
                  }
                  onInvalid={(e) =>
                    (e.target as HTMLInputElement).setCustomValidity(
                      "Por favor, preencha o nome do solicitante.",
                    )
                  }
                  onInput={(e) =>
                    (e.target as HTMLInputElement).setCustomValidity("")
                  }
                  className="w-full border border-gray-300 rounded p-2 text-sm focus:border-green-600 focus:ring-1 focus:ring-green-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-500 uppercase mb-1">
                  E-mail (Opcional)
                </label>
                <input
                  type="email"
                  value={formReserva.email_solicitante}
                  onChange={(e) =>
                    setFormReserva({
                      ...formReserva,
                      email_solicitante: e.target.value,
                    })
                  }
                  onInvalid={(e) =>
                    (e.target as HTMLInputElement).setCustomValidity(
                      "Por favor, insira um endereço de e-mail válido.",
                    )
                  }
                  onInput={(e) =>
                    (e.target as HTMLInputElement).setCustomValidity("")
                  }
                  className="w-full border border-gray-300 rounded p-2 text-sm focus:border-green-600 focus:ring-1 focus:ring-green-600 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase mb-1">
                    Turma / Curso *
                  </label>
                  <input
                    required
                    type="text"
                    value={formReserva.turma_curso}
                    onChange={(e) =>
                      setFormReserva({
                        ...formReserva,
                        turma_curso: e.target.value,
                      })
                    }
                    onInvalid={(e) =>
                      (e.target as HTMLInputElement).setCustomValidity(
                        "Por favor, informe a turma ou curso.",
                      )
                    }
                    onInput={(e) =>
                      (e.target as HTMLInputElement).setCustomValidity("")
                    }
                    className="w-full border border-gray-300 rounded p-2 text-sm focus:border-green-600 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase mb-1">
                    Evento / Disciplina *
                  </label>
                  <input
                    required
                    type="text"
                    value={formReserva.disciplina_evento}
                    onChange={(e) =>
                      setFormReserva({
                        ...formReserva,
                        disciplina_evento: e.target.value,
                      })
                    }
                    onInvalid={(e) =>
                      (e.target as HTMLInputElement).setCustomValidity(
                        "Por favor, informe o evento ou disciplina.",
                      )
                    }
                    onInput={(e) =>
                      (e.target as HTMLInputElement).setCustomValidity("")
                    }
                    className="w-full border border-gray-300 rounded p-2 text-sm focus:border-green-600 outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-4 border-t border-gray-100 mt-6">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={iniciarModoCopia}
                    disabled={
                      !formReserva.nome_solicitante ||
                      salvando ||
                      abaAtiva === "HORARIO"
                    }
                    className={`flex-1 py-2 rounded-lg font-bold transition-colors text-xs disabled:opacity-50 ${abaAtiva === "HORARIO" ? "hidden" : "text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100"}`}
                  >
                    ⧉ Copiar para Colar
                  </button>
                  {dadosReserva.id && (
                    <button
                      type="button"
                      onClick={excluirReserva}
                      disabled={salvando}
                      className="flex-1 py-2 rounded-lg font-bold text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors text-xs disabled:opacity-50"
                    >
                      🗑️ Excluir Reserva
                    </button>
                  )}
                </div>
                <div className="flex gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setModalAberto(false)}
                    className="w-1/3 py-2.5 rounded-lg font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={salvando}
                    className={`w-2/3 py-2.5 rounded-lg font-black text-white transition-colors text-sm disabled:opacity-50 ${dadosReserva.id ? "bg-indigo-600 hover:bg-indigo-700" : "bg-green-600 hover:bg-green-700"}`}
                  >
                    {salvando
                      ? "Processando..."
                      : dadosReserva.id
                        ? "Salvar Alterações"
                        : "Confirmar Reserva"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      <header className="bg-green-800 text-white px-6 py-3 shadow-md shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-xl font-black italic tracking-tighter">
                SGH{" "}
                <span className="font-light not-italic text-green-200">
                  | IFNMG
                </span>
              </h1>
              <p className="text-[11px] font-medium text-green-100 uppercase tracking-widest mt-0.5">
                Reserva de Espaços
              </p>
            </div>
          </div>
          <div className="flex items-center bg-green-900/40 px-3 py-2 rounded-xl border border-green-700/50">
            <Link
              href="/"
              className="bg-white text-green-800 px-3 py-1.5 rounded text-xs font-bold shadow-sm hover:bg-green-50 transition-all active:scale-95 flex items-center gap-2"
            >
              <span>⬅</span> Voltar
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto mt-3 p-3 w-full flex-1 flex flex-col min-h-0">
        {carregando ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : !semestreAtivo ? (
          <div className="bg-red-50 border-l-4 border-red-600 p-6 rounded-r-xl shadow-sm">
            <h2 className="text-red-800 font-black text-lg">
              Semestre não parametrizado
            </h2>
            <p className="text-red-700 mt-1">
              Nenhum período letivo ativo foi localizado. A reserva automática
              foi desativada temporariamente.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full">
            <div className="flex border-b border-gray-200 bg-gray-50 shrink-0">
              <button
                onClick={() => {
                  setAbaAtiva("HORARIO");
                  setVeioDaBusca(false);
                  setReservaCopiada(null);
                }}
                className={`flex-1 py-2.5 text-[11px] font-black uppercase tracking-widest transition-all ${
                  abaAtiva === "HORARIO"
                    ? "bg-white text-green-700 border-b-2 border-green-600 shadow-sm"
                    : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                }`}
              >
                ⏱️ Buscar por Horário
              </button>
              <button
                onClick={() => {
                  setAbaAtiva("ESPACO");
                  setVeioDaBusca(false);
                  setReservaCopiada(null);
                }}
                className={`flex-1 py-2.5 text-[11px] font-black uppercase tracking-widest transition-all ${
                  abaAtiva === "ESPACO"
                    ? "bg-white text-green-700 border-b-2 border-green-600 shadow-sm"
                    : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                }`}
              >
                🔍 Buscar por Espaço
              </button>
            </div>

            <div className="p-3 md:p-4 flex-1 flex flex-col min-h-0">
              {abaAtiva === "HORARIO" && (
                <div className="flex flex-col h-full space-y-4">
                  <div className="shrink-0 bg-gray-50/50 p-4 rounded-xl border border-gray-100 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="w-full">
                      <label className="block text-[9px] font-black text-gray-400 uppercase tracking-wider mb-1">
                        1. Filtrar por Tipo
                      </label>
                      <select
                        value={categoriaBusca}
                        onChange={(e) => {
                          setCategoriaBusca(e.target.value);
                          setBuscaRealizada(false);
                        }}
                        className="w-full bg-white border border-gray-200 text-gray-700 rounded-lg p-2 text-sm font-bold outline-none shadow-sm focus:border-green-600 transition-all"
                      >
                        <option value="">Todas as Infraestruturas</option>
                        {categorias.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.nome}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="w-full">
                      <label className="block text-[9px] font-black text-gray-400 uppercase tracking-wider mb-1">
                        2. Data Desejada
                      </label>
                      <input
                        type="date"
                        value={dataBusca}
                        onChange={(e) => {
                          setDataBusca(e.target.value);
                          setBuscaRealizada(false);
                        }}
                        className="w-full bg-white border border-gray-200 text-gray-700 rounded-lg p-2 text-sm font-bold outline-none shadow-sm focus:border-green-600 transition-all"
                      />
                    </div>

                    <div className="w-full">
                      <label className="block text-[9px] font-black text-gray-400 uppercase tracking-wider mb-1">
                        3. Horário (Slot)
                      </label>
                      <select
                        value={slotBuscaId}
                        onChange={(e) => {
                          setSlotBuscaId(e.target.value);
                          setBuscaRealizada(false);
                        }}
                        className="w-full bg-white border border-gray-200 text-gray-700 rounded-lg p-2 text-sm font-bold outline-none shadow-sm focus:border-green-600 transition-all"
                      >
                        <option value="">Selecione o horário...</option>
                        {slots.map((s) => (
                          <option key={s.id} value={s.id}>
                            {formatarHora(s.hora_inicio)} às{" "}
                            {formatarHora(s.hora_fim)} ({s.turno})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="w-full">
                      <button
                        onClick={buscarEspacosLivres}
                        disabled={!dataBusca || !slotBuscaId || carregandoBusca}
                        className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-black text-sm px-4 py-2.5 rounded-lg shadow-sm transition-all"
                      >
                        {carregandoBusca ? "Buscando..." : "Buscar Espaços"}
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto bg-white rounded-xl border border-gray-200 p-4">
                    {!buscaRealizada && !carregandoBusca && (
                      <div className="h-full flex flex-col items-center justify-center text-center text-gray-400">
                        <span className="text-5xl mb-2">🔎</span>
                        <p className="font-bold">
                          Selecione os filtros acima para ver a disponibilidade.
                        </p>
                      </div>
                    )}

                    {carregandoBusca && (
                      <div className="h-full flex items-center justify-center">
                        <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}

                    {buscaRealizada &&
                      !carregandoBusca &&
                      espacosDisponiveis.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-center text-red-500">
                          <span className="text-5xl mb-2">🛑</span>
                          <p className="font-bold text-lg text-red-800">
                            Sem Vagas!
                          </p>
                          <p className="text-sm">
                            Nenhum espaço encontrado para os critérios
                            informados.
                          </p>
                        </div>
                      )}

                    {buscaRealizada &&
                      !carregandoBusca &&
                      espacosDisponiveis.length > 0 && (
                        <div className="space-y-6">
                          <div className="bg-green-50 border border-green-200 text-green-800 p-3 rounded-lg flex items-center gap-3">
                            <span className="text-xl">✅</span>
                            <div>
                              <p className="font-black text-sm">
                                Encontrámos {espacosDisponiveis.length} espaços
                                livres!
                              </p>
                              <p className="text-xs">
                                Para o dia{" "}
                                {new Date(
                                  dataBusca + "T12:00:00",
                                ).toLocaleDateString("pt-BR")}{" "}
                                no horário selecionado.
                              </p>
                            </div>
                          </div>

                          {categorias.map((cat) => {
                            const espacosDaCat = espacosDisponiveis.filter(
                              (e) => String(e.categoria_id) === String(cat.id),
                            );
                            if (espacosDaCat.length === 0) return null;

                            return (
                              <div key={cat.id} className="mb-6">
                                <h3 className="text-sm font-black text-gray-500 uppercase tracking-widest border-b border-gray-200 pb-2 mb-3">
                                  {cat.nome}
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                  {espacosDaCat.map((espaco) => (
                                    <div
                                      key={espaco.id}
                                      className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
                                    >
                                      <div>
                                        <h4 className="font-black text-gray-800">
                                          {espaco.nome}
                                        </h4>
                                        <p className="text-xs text-gray-500 mt-1">
                                          Capacidade: {espaco.capacidade}{" "}
                                          pessoas
                                        </p>
                                      </div>
                                      <button
                                        onClick={() =>
                                          navegarParaGradeDoEspaco(espaco)
                                        }
                                        className="mt-4 w-full bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 py-2 rounded font-bold text-xs transition-colors flex items-center justify-center gap-2"
                                      >
                                        <span>Ver Grade de Horários</span>{" "}
                                        <span>📅</span>
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                  </div>
                </div>
              )}

              {abaAtiva === "ESPACO" && (
                <div className="flex flex-col h-full space-y-3">
                  {veioDaBusca && (
                    <button
                      onClick={() => {
                        setAbaAtiva("HORARIO");
                        setVeioDaBusca(false);
                      }}
                      className="bg-blue-50 text-blue-700 border border-blue-200 font-bold px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-100 transition-colors w-fit text-xs"
                    >
                      ⬅ Voltar aos Resultados da Busca
                    </button>
                  )}

                  <div className="shrink-0 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-gray-50/50 p-3 rounded-xl border border-gray-100">
                      <div>
                        <label className="block text-[9px] font-black text-gray-400 uppercase tracking-wider mb-1">
                          1. Tipo de Infraestrutura
                        </label>
                        <select
                          value={categoriaSelecionada}
                          onChange={(e) => {
                            setCategoriaSelecionada(e.target.value);
                            setEspacoSelecionado("");
                          }}
                          className="w-full bg-white border border-gray-200 text-gray-700 rounded-lg p-2 text-xs font-bold outline-none shadow-sm focus:border-green-600 transition-all"
                        >
                          <option value="">Selecione uma categoria...</option>
                          {categorias.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.nome}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[9px] font-black text-gray-400 uppercase tracking-wider mb-1">
                          2. Local Desejado
                        </label>
                        <select
                          disabled={!categoriaSelecionada}
                          value={espacoSelecionado}
                          onChange={(e) => setEspacoSelecionado(e.target.value)}
                          className="w-full bg-white border border-gray-200 text-gray-700 rounded-lg p-2 text-xs font-bold outline-none shadow-sm focus:border-green-600 transition-all disabled:opacity-40"
                        >
                          <option value="">
                            {categoriaSelecionada
                              ? "Escolha a sala/laboratório..."
                              : "Aguardando tipo de espaço..."}
                          </option>
                          {espacosFiltrados.map((esp) => (
                            <option key={esp.id} value={esp.id}>
                              {esp.nome} (Capacidade: {esp.capacidade} p.)
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {espacoSelecionado && (
                      <div className="flex justify-between items-center bg-green-700 text-white px-3 py-2 rounded-lg shadow-sm">
                        <button
                          onClick={() => navegarSemana(-1)}
                          className="bg-green-900/60 hover:bg-green-900 px-2.5 py-1 rounded text-xs font-bold transition-colors"
                        >
                          ◀ Semana Anterior
                        </button>
                        <div className="text-center leading-tight">
                          <span className="text-[9px] font-black uppercase text-green-200 tracking-widest block">
                            Vigência: {semestreAtivo.nome_semestre}
                          </span>
                          <span className="text-sm font-black">
                            {obterDataDoDiaDaSemana(0).toLocaleDateString(
                              "pt-BR",
                            )}{" "}
                            até{" "}
                            {obterDataDoDiaDaSemana(4).toLocaleDateString(
                              "pt-BR",
                            )}
                          </span>
                        </div>
                        <button
                          onClick={() => navegarSemana(1)}
                          className="bg-green-900/60 hover:bg-green-900 px-2.5 py-1 rounded text-xs font-bold transition-colors"
                        >
                          Próxima Semana ▶
                        </button>
                      </div>
                    )}
                  </div>

                  {espacoSelecionado && (
                    <div
                      className={`flex-1 min-h-0 relative border rounded-lg bg-white overflow-hidden shadow-inner transition-colors ${reservaCopiada ? "border-blue-400 ring-2 ring-blue-100" : "border-gray-200"}`}
                    >
                      {carregandoGrid && (
                        <div className="absolute inset-0 z-20 bg-white/60 backdrop-blur-[1px] flex items-center justify-center">
                          <div className="w-8 h-8 border-4 border-gray-200 border-t-green-700 rounded-full animate-spin"></div>
                        </div>
                      )}

                      <div className="w-full h-full overflow-y-auto overflow-x-auto">
                        <table className="w-full border-collapse table-fixed min-w-[750px]">
                          <thead className="sticky top-0 z-10 shadow-sm bg-gray-100 ring-1 ring-gray-200">
                            <tr className="text-center">
                              <th className="p-3 w-28 border-r border-gray-200 text-[10px] font-black uppercase text-gray-500 bg-gray-100">
                                Horário
                              </th>
                              {diasUteis.map((dia, idx) => (
                                <th
                                  key={dia.id}
                                  className="p-3 border-r border-gray-200 bg-gray-100"
                                >
                                  <div className="text-[10px] text-gray-500 font-bold uppercase">
                                    {dia.nome}
                                  </div>
                                  <div className="text-sm text-green-800 font-black mt-0.5">
                                    {obterDataDoDiaDaSemana(idx)
                                      .toLocaleDateString("pt-BR")
                                      .substring(0, 5)}
                                  </div>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 text-center">
                            {slots.map((slot, index) => {
                              const proxSlot = slots[index + 1];
                              let isFimTurno = false;
                              if (proxSlot) {
                                const currHora = slot.hora_inicio;
                                const proxHora = proxSlot.hora_inicio;
                                if (currHora < "12:00" && proxHora >= "12:00")
                                  isFimTurno = true;
                                if (currHora < "18:00" && proxHora >= "18:00")
                                  isFimTurno = true;
                              }

                              return (
                                <tr
                                  key={slot.id}
                                  className={`min-h-[4rem] hover:bg-gray-50/30 transition-colors ${isFimTurno ? "border-b-4 border-gray-400" : ""}`}
                                >
                                  <td className="p-2 border-r border-gray-200 bg-green-50/40 align-middle">
                                    <div className="font-black text-green-800 text-sm">
                                      {formatarHora(slot.hora_inicio)}
                                    </div>
                                    <div className="text-[9px] text-green-600/70 font-bold uppercase tracking-widest mt-0.5">
                                      até {formatarHora(slot.hora_fim)}
                                    </div>
                                  </td>

                                  {diasUteis.map((dia, idx) => {
                                    const ocupacao = obterOcupacaoCelular(
                                      dia.id,
                                      slot.id,
                                      idx,
                                    );

                                    if (ocupacao) {
                                      const isReserva =
                                        ocupacao.tipo === "RESERVA";
                                      return (
                                        <td
                                          key={dia.id}
                                          onClick={() =>
                                            handleSlotOcupadoClick(ocupacao)
                                          }
                                          className={`p-1.5 border-r border-gray-200 align-middle text-[10px] md:text-[11px] font-bold uppercase tracking-tight select-none transition-colors ${
                                            isReserva && !reservaCopiada
                                              ? "bg-gray-100 hover:bg-indigo-50 cursor-pointer"
                                              : "bg-gray-100 text-gray-500"
                                          }`}
                                        >
                                          <div
                                            className={`rounded p-2 line-clamp-3 leading-snug ${isReserva && !reservaCopiada ? "bg-white border border-indigo-100 text-indigo-800 shadow-sm" : "bg-gray-200/60 text-gray-600"}`}
                                          >
                                            {ocupacao.tipo === "AULA"
                                              ? "🔒 "
                                              : "📆 "}
                                            {ocupacao.nome}
                                          </div>
                                        </td>
                                      );
                                    }

                                    return (
                                      <td
                                        key={dia.id}
                                        onClick={() =>
                                          handleSlotLivreClick(
                                            dia.id,
                                            slot,
                                            idx,
                                          )
                                        }
                                        className={`p-1.5 border-r border-gray-200 align-middle group transition-all cursor-pointer ${
                                          reservaCopiada
                                            ? "bg-blue-50/50 hover:bg-blue-500"
                                            : "bg-green-50/30 hover:bg-green-600"
                                        }`}
                                      >
                                        <div
                                          className={`font-black text-[10px] tracking-wider uppercase group-hover:text-white ${reservaCopiada ? "text-blue-600/60" : "text-green-700/60"}`}
                                        >
                                          {reservaCopiada
                                            ? "Colar +"
                                            : "Disponível +"}
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
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
