"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function PeriodosLetivosPage() {
  const [periodos, setPeriodos] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [exibirFormulario, setExibirFormulario] = useState(false);

  // Estados do formulário
  const [sigla, setSigla] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState("SEMESTRAL");
  const [ano, setAno] = useState(new Date().getFullYear());
  const [semestre, setSemestre] = useState<string>("1");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [diasPrevistos, setDiasPrevistos] = useState(100);
  const [status, setStatus] = useState("PLANEJAMENTO");

  // Controla o ajuste automático de dias previstos com base no tipo
  useEffect(() => {
    if (tipo === "ANUAL") {
      setDiasPrevistos(200);
      setSemestre("");
    } else {
      setDiasPrevistos(100);
      setSemestre("1");
    }
  }, [tipo]);

  async function carregarPeriodos() {
    setCarregando(true);
    const { data, error } = await supabase
      .from("periodos_letivos")
      .select("*")
      .order("ano", { ascending: false })
      .order("semestre", { ascending: false });

    if (!error && data) {
      setPeriodos(data);
    }
    setCarregando(false);
  }

  useEffect(() => {
    carregarPeriodos();
  }, []);

  async function salvarPeriodo(e: React.FormEvent) {
    e.preventDefault();

    if (!sigla || !descricao || !dataInicio || !dataFim) {
      alert("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    const novoPeriodo = {
      sigla,
      descricao,
      tipo,
      ano: Number(ano),
      semestre: tipo === "SEMESTRAL" ? Number(semestre) : null,
      data_inicio: dataInicio,
      data_fim: dataFim,
      dias_letivos_previstos: Number(diasPrevistos),
      status,
    };

    const { error } = await supabase
      .from("periodos_letivos")
      .insert([novoPeriodo]);

    if (error) {
      console.error(error);
      alert("Erro ao salvar o período letivo. Verifique se a sigla já existe.");
    } else {
      alert("Período letivo cadastrado com sucesso!");
      resetarFormulario();
      carregarPeriodos();
    }
  }

  async function alterarStatus(id: string, novoStatus: string) {
    const { error } = await supabase
      .from("periodos_letivos")
      .update({ status: novoStatus })
      .eq("id", id);

    if (error) {
      alert("Erro ao atualizar status.");
    } else {
      carregarPeriodos();
    }
  }

  async function excluirPeriodo(id: string, siglaPeriodo: string) {
    if (
      confirm(
        `Tem certeza que deseja excluir o período ${siglaPeriodo}? Isso apagará todos os eventos vinculados a ele.`,
      )
    ) {
      const { error } = await supabase
        .from("periodos_letivos")
        .delete()
        .eq("id", id);
      if (error) {
        alert("Erro ao excluir o período.");
      } else {
        carregarPeriodos();
      }
    }
  }

  function resetarFormulario() {
    setSigla("");
    setDescricao("");
    setTipo("SEMESTRAL");
    setAno(new Date().getFullYear());
    setSemestre("1");
    setDataInicio("");
    setDataFim("");
    setDiasPrevistos(100);
    setStatus("PLANEJAMENTO");
    setExibirFormulario(false);
  }

  const formatarDataBR = (dataStr: string) => {
    if (!dataStr) return "";
    const [ano, mes, dia] = dataStr.split("-");
    return `${dia}/${mes}/${ano}`;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-xl font-black uppercase text-green-950 tracking-tight">
            Calendários e Períodos Letivos
          </h1>
          <p className="text-xs text-gray-500 font-medium uppercase mt-0.5 tracking-wider">
            Controle de semestres (superior) e anos letivos (técnico integrado)
          </p>
        </div>
        <button
          onClick={() => setExibirFormulario(!exibirFormulario)}
          className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-colors ${
            exibirFormulario
              ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
              : "bg-green-600 text-white hover:bg-green-700"
          }`}
        >
          {exibirFormulario ? "✕ Cancelar" : "➕ Novo Período"}
        </button>
      </div>

      {/* FORMULÁRIO DE CADASTRO */}
      {exibirFormulario && (
        <form
          onSubmit={salvarPeriodo}
          className="bg-white p-6 rounded-xl shadow-md border border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-4 animate-fadeIn"
        >
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">
              Sigla identificadora *
            </label>
            <input
              type="text"
              placeholder="Ex: 2026.1-SUP ou 2026-INT"
              value={sigla}
              onChange={(e) => setSigla(e.target.value.toUpperCase())}
              className="w-full border border-gray-200 bg-gray-50 text-gray-900 rounded p-2 text-sm font-medium outline-none focus:border-green-600"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">
              Descrição amigável *
            </label>
            <input
              type="text"
              placeholder="Ex: 1º Semestre 2026 - Cursos Superiores"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="w-full border border-gray-200 bg-gray-50 text-gray-900 rounded p-2 text-sm font-medium outline-none focus:border-green-600"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">
              Regime do Período *
            </label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="w-full border border-gray-200 bg-gray-50 text-gray-900 rounded p-2 text-sm font-bold outline-none focus:border-green-600 cursor-pointer"
            >
              <option value="SEMESTRAL">
                SEMESTRAL (Superior / Subsequente)
              </option>
              <option value="ANUAL">ANUAL (Técnico Integrado)</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">
              Ano Letivo *
            </label>
            <input
              type="number"
              value={ano}
              onChange={(e) => setAno(Number(e.target.value))}
              className="w-full border border-gray-200 bg-gray-50 text-gray-900 rounded p-2 text-sm font-medium outline-none focus:border-green-600"
            />
          </div>

          {tipo === "SEMESTRAL" && (
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">
                Semestre de Referência
              </label>
              <select
                value={semestre}
                onChange={(e) => setSemestre(e.target.value)}
                className="w-full border border-gray-200 bg-gray-50 text-gray-900 rounded p-2 text-sm font-bold outline-none focus:border-green-600 cursor-pointer"
              >
                <option value="1">1º Semestre</option>
                <option value="2">2º Semestre</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">
              Dias Letivos Previstos
            </label>
            <input
              type="number"
              value={diasPrevistos}
              onChange={(e) => setDiasPrevistos(Number(e.target.value))}
              className="w-full border border-gray-200 bg-gray-50 text-gray-900 rounded p-2 text-sm font-medium outline-none focus:border-green-600"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">
              Data de Início das Aulas *
            </label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-full border border-gray-200 bg-gray-50 text-gray-900 rounded p-2 text-sm font-medium outline-none focus:border-green-600"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">
              Data de Término *
            </label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="w-full border border-gray-200 bg-gray-50 text-gray-900 rounded p-2 text-sm font-medium outline-none focus:border-green-600"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">
              Status Inicial
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full border border-gray-200 bg-gray-50 text-gray-900 rounded p-2 text-sm font-bold outline-none focus:border-green-600 cursor-pointer"
            >
              <option value="PLANEJAMENTO">📝 PLANEJAMENTO</option>
              <option value="ATIVO">✅ ATIVO (Em vigor)</option>
              <option value="ENCERRADO">🔒 ENCERRADO</option>
            </select>
          </div>

          <div className="md:col-span-3 flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={resetarFormulario}
              className="px-4 py-2 bg-gray-100 text-gray-600 font-bold text-xs uppercase rounded hover:bg-gray-200"
            >
              Limpar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-green-600 text-white font-black text-xs uppercase rounded hover:bg-green-700 shadow-sm"
            >
              Salvar Período
            </button>
          </div>
        </form>
      )}

      {/* LISTAGEM DE PERÍODOS */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {carregando ? (
          <div className="flex justify-center my-12">
            <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : periodos.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <span className="text-4xl block mb-2">📅</span>
            <p className="font-bold text-gray-500">
              Nenhum período letivo cadastrado.
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              Clique em "Novo Período" para começar.
            </p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-black uppercase tracking-wider text-gray-500">
                <th className="p-4">Sigla</th>
                <th className="p-4">Descrição / Tipo</th>
                <th className="p-4">Vigência</th>
                <th className="p-4 text-center">Dias Metas</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm font-medium text-gray-700">
              {periodos.map((p) => {
                const badgeCor =
                  p.status === "ATIVO"
                    ? "bg-green-100 text-green-700"
                    : p.status === "ENCERRADO"
                      ? "bg-gray-100 text-gray-600"
                      : "bg-amber-100 text-amber-700";

                return (
                  <tr
                    key={p.id}
                    className="hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="p-4 font-bold text-gray-900 tracking-tight">
                      {p.sigla}
                    </td>
                    <td className="p-4">
                      <div>{p.descricao}</div>
                      <div className="text-[10px] uppercase font-bold tracking-wide text-gray-400 mt-0.5">
                        {p.tipo} {p.semestre ? `• ${p.semestre}º SEMESTRE` : ""}
                      </div>
                    </td>
                    <td className="p-4 text-xs font-mono text-gray-600">
                      {formatarDataBR(p.data_inicio)} até{" "}
                      {formatarDataBR(p.data_fim)}
                    </td>
                    <td className="p-4 text-center font-bold text-gray-600">
                      {p.dias_letivos_previstos} dias
                    </td>
                    <td className="p-4 text-center">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide ${badgeCor}`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-3">
                        {/* Seletor rápido de Status */}
                        <select
                          value={p.status}
                          onChange={(e) => alterarStatus(p.id, e.target.value)}
                          className="bg-gray-50 border border-gray-200 rounded p-1 text-[11px] font-bold outline-none cursor-pointer focus:border-green-600"
                        >
                          <option value="PLANEJAMENTO">PLANEJAMENTO</option>
                          <option value="ATIVO">ATIVO</option>
                          <option value="ENCERRADO">ENCERRADO</option>
                        </select>

                        <button
                          onClick={() => excluirPeriodo(p.id, p.sigla)}
                          className="text-gray-400 hover:text-red-600 transition-colors text-xs"
                          title="Excluir período"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
