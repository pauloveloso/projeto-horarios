"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function ExportarPDFIntegradoPage() {
  const [carregando, setCarregando] = useState(true);
  const [versoes, setVersoes] = useState<any[]>([]);
  const [versaoSelecionada, setVersaoSelecionada] = useState("");
  const [dados, setDados] = useState<any>(null);

  const dias = [
    { id: "SEGUNDA", label: "Segunda" },
    { id: "TERCA", label: "Terça" },
    { id: "QUARTA", label: "Quarta" },
    { id: "QUINTA", label: "Quinta" },
    { id: "SEXTA", label: "Sexta" },
  ];

  // Horários restritos: 4 aulas de manhã e 4 aulas de tarde
  const horasPermitidas = [
    "07:30",
    "08:20",
    "09:25",
    "10:15",
    "13:30",
    "14:20",
    "15:25",
    "16:15",
  ];

  useEffect(() => {
    async function carregarVersoes() {
      const { data } = await supabase
        .from("versoes_grade")
        .select("*")
        .order("data_inicio_vigencia", { ascending: false });
      if (data && data.length > 0) {
        setVersoes(data);
        const ativa = data.find((v) => v.status === "PUBLICADA") || data[0];
        if (ativa) setVersaoSelecionada(ativa.id);
      } else {
        setCarregando(false);
      }
    }
    carregarVersoes();
  }, []);

  const carregarRelatorio = async () => {
    if (!versaoSelecionada) return;
    setCarregando(true);

    try {
      const [
        { data: aulas },
        { data: turmas },
        { data: cursos },
        { data: professores },
        { data: disciplinas },
        { data: espacos },
        { data: slots },
      ] = await Promise.all([
        supabase.from("aulas").select("*").eq("versao_id", versaoSelecionada),
        supabase.from("turmas").select("*").order("codigo"),
        supabase.from("cursos").select("*"),
        supabase.from("professores").select("*"),
        supabase.from("disciplinas").select("*"),
        supabase.from("espacos").select("*"),
        supabase.from("slots_horarios").select("*").order("hora_inicio"),
      ]);

      const cursosIntegrados =
        cursos?.filter((c) => {
          const modalidade = (c.modalidade || "").toUpperCase();
          return modalidade === "INTEGRADO";
        }) || [];

      const slotsFiltrados =
        slots?.filter((s) =>
          horasPermitidas.includes(s.hora_inicio.substring(0, 5)),
        ) || [];

      const anos = ["1", "2", "3"];
      const gruposParaImpressao: any[] = [];

      cursosIntegrados.forEach((curso) => {
        anos.forEach((ano) => {
          const turmasDoGrupo =
            turmas?.filter((t) => {
              if (String(t.curso_id) !== String(curso.id)) return false;
              const codigo = (t.codigo || "").toUpperCase();
              return (
                codigo.includes(` ${ano}`) ||
                codigo.includes(`-${ano}`) ||
                codigo.includes(`${ano}º`)
              );
            }) || [];

          if (turmasDoGrupo.length > 0) {
            gruposParaImpressao.push({
              id: `${curso.id}-${ano}`,
              nomeGrupo: `${curso.nome} - ${ano}º Ano`,
              turmas: turmasDoGrupo,
            });
          }
        });
      });

      setDados({
        aulas: aulas || [],
        grupos: gruposParaImpressao,
        professores,
        disciplinas,
        espacos,
        slots: slotsFiltrados,
      });
    } catch (error) {
      console.error("Erro:", error);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarRelatorio();
  }, [versaoSelecionada]);

  const getAula = (turmaId: string, diaId: string, slotId: string) => {
    return dados?.aulas?.find(
      (a: any) =>
        String(a.turma_id) === String(turmaId) &&
        a.dia_semana === diaId &&
        String(a.slot_horario_id) === String(slotId),
    );
  };

  if (carregando && !dados)
    return (
      <div className="p-10 text-center font-bold">
        Gerando Relatório Técnico Integrado...
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-xl font-black text-green-800">
            Relatório Integrado (Oficial)
          </h1>
          <p className="text-xs text-gray-500 font-bold uppercase mt-1">
            Filtro: Modalidade "INTEGRADO" • Correção de Quebra de Texto
          </p>
        </div>
        <div className="flex flex-wrap gap-4 w-full md:w-auto">
          <select
            value={versaoSelecionada}
            onChange={(e) => setVersaoSelecionada(e.target.value)}
            className="border border-green-300 rounded p-2 text-sm font-bold bg-green-50 text-green-800 outline-none"
          >
            {versoes.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nome} ({v.semestre})
              </option>
            ))}
          </select>
          <button
            onClick={() => window.print()}
            className="bg-green-600 text-white px-6 py-2 rounded font-black text-sm shadow hover:bg-green-700"
          >
            IMPRIMIR PDF 📄
          </button>
        </div>
      </div>

      <div className="print:block space-y-6 print:space-y-4">
        {dados?.grupos.map((grupo: any) => (
          <div key={grupo.id} className="print:mt-4">
            <div className="text-center mb-2 border-b-[1.5px] border-black pb-1">
              <h2 className="text-[10px] font-black uppercase tracking-tight">
                IFNMG - Campus Januária | Quadro de Horário: {grupo.nomeGrupo}
              </h2>
            </div>

            <div className="space-y-4 print:space-y-2">
              {grupo.turmas.map((turma: any) => (
                <div
                  key={turma.id}
                  className="relative print:break-inside-avoid print:mb-2 mb-6"
                >
                  <div className="text-[9px] font-black uppercase mb-0.5 ml-1">
                    TURMA: {turma.codigo}
                  </div>

                  <table className="w-full border-collapse border-[1.2px] border-black table-fixed text-[8px]">
                    <thead>
                      <tr className="bg-gray-100 font-black">
                        <th className="border border-black p-0.5 w-[12%] text-[9px]">
                          Horários
                        </th>
                        {dias.map((d) => (
                          <th
                            key={d.id}
                            className="border border-black p-0.5 w-[17.6%] text-[9px]"
                          >
                            {d.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {dados.slots.map((slot: any) => (
                        <tr
                          key={slot.id}
                          className="h-auto print:break-inside-avoid"
                        >
                          <td className="border border-black p-0.5 text-center font-bold bg-gray-50 align-middle">
                            {slot.hora_inicio.substring(0, 5)}
                            <br />
                            {slot.hora_fim.substring(0, 5)}
                          </td>
                          {dias.map((dia) => {
                            const aula = getAula(turma.id, dia.id, slot.id);
                            if (!aula)
                              return (
                                <td
                                  key={dia.id}
                                  className="border border-black p-0.5"
                                ></td>
                              );

                            const disc = dados.disciplinas?.find(
                              (d: any) =>
                                String(d.id) === String(aula.disciplina_id),
                            );
                            const prof = dados.professores?.find(
                              (p: any) =>
                                String(p.id) === String(aula.professor_id),
                            );
                            const sala = dados.espacos?.find(
                              (e: any) =>
                                String(e.id) === String(aula.espaco_id),
                            );

                            return (
                              <td
                                key={dia.id}
                                /* REMOVIDO overflow-hidden E ADICIONADO break-words */
                                className="border border-black p-1 align-top break-words"
                              >
                                <div
                                  className="font-black uppercase leading-[1.1] mb-0.5"
                                  title={disc?.nome}
                                >
                                  {disc?.nome}
                                </div>
                                <div
                                  className="text-gray-800 leading-[1.1] mb-0.5"
                                  title={prof?.nome}
                                >
                                  {prof?.nome}
                                </div>
                                <div
                                  className="italic text-gray-500 text-[7px] leading-[1.1]"
                                  title={sala?.nome}
                                >
                                  {sala?.nome || "S/S"}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: landscape;
            margin: 0.5cm;
          }
          html,
          body,
          #__next,
          main,
          .flex-1,
          .h-screen,
          .overflow-hidden,
          .overflow-y-auto {
            height: auto !important;
            min-height: auto !important;
            overflow: visible !important;
            position: static !important;
            display: block !important;
          }
          body {
            background: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:break-inside-avoid {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            display: block !important;
          }
          table {
            border-collapse: collapse !important;
            width: 100% !important;
            table-layout: fixed !important;
          }
          td,
          th {
            border: 1px solid black !important;
            word-wrap: break-word !important;
            white-space: normal !important;
          }
        }
      `}</style>
    </div>
  );
}
