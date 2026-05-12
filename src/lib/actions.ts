"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { executarValidacoes, ValidacaoResultado } from "./validacoes/engine";

// Inicialização do cliente Supabase (Server-side)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Usamos a chave de serviço para bypass de RLS se necessário
);

// ============================================================
// AÇÕES DE LEITURA (GET)
// ============================================================

export async function getCursos() {
  const { data, error } = await supabase
    .from("cursos")
    .select("*")
    .order("nome");

  if (error) throw error;
  return data || [];
}

export async function getTurmas() {
  const { data, error } = await supabase
    .from("turmas")
    .select("*, cursos(nome)")
    .order("codigo");

  if (error) throw error;
  return data || [];
}

export async function getDisciplinas() {
  const { data, error } = await supabase
    .from("disciplinas")
    .select("*, cursos(nome)")
    .order("nome");

  if (error) throw error;
  return data || [];
}

export async function getProfessores() {
  const { data, error } = await supabase
    .from("professores")
    .select("*")
    .order("nome");

  if (error) throw error;
  return data || [];
}

export async function getEspacos() {
  const { data, error } = await supabase
    .from("espacos")
    .select("*")
    .order("nome");

  if (error) throw error;
  return data || [];
}

export async function getSlotsHorarios() {
  const { data, error } = await supabase
    .from("slots_horarios")
    .select("*")
    .order("hora_inicio");

  if (error) throw error;
  return data || [];
}

export async function getVersoesGrade() {
  const { data, error } = await supabase
    .from("versoes_grade")
    .select("*")
    .order("semestre", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getAulasPorVersao(versaoId: number) {
  // Utiliza a View Materializada para performance
  const { data, error } = await supabase
    .from("mv_grade_horaria_completa")
    .select("*")
    .eq("versao_id", versaoId)
    .eq("status", "ATIVO");

  if (error) throw error;
  return data || [];
}

export async function getAulasPorTurma(turmaId: number, versaoId?: number) {
  let query = supabase
    .from("mv_grade_horaria_completa")
    .select("*")
    .eq("turma_id", turmaId)
    .eq("status", "ATIVO");

  if (versaoId) {
    query = query.eq("versao_id", versaoId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// ============================================================
// AÇÕES DE ESCRITA COM VALIDAÇÃO (POST/UPDATE)
// ============================================================

interface AulaInput {
  turma_id: number;
  disciplina_id: number;
  professor_id: number;
  espaco_id: number | null;
  slot_horario_id: number;
  dia_semana: string;
  versao_id: number;
}

export async function salvarAulaComValidacoes(dados: AulaInput) {
  try {
    // 1. Inserir a aula no banco (Constraints UNIQUE do banco já protegem contra duplicidade exata)
    const { data: aulaSalva, error: insertError } = await supabase
      .from("aulas")
      .insert([
        {
          turma_id: dados.turma_id,
          disciplina_id: dados.disciplina_id,
          professor_id: dados.professor_id,
          espaco_id: dados.espaco_id,
          slot_horario_id: dados.slot_horario_id,
          dia_semana: dados.dia_semana,
          versao_id: dados.versao_id,
          status: "ATIVO",
        },
      ])
      .select()
      .single();

    if (insertError) {
      // Tratamento de erros de constraint do banco
      if (insertError.code === "23505") {
        return {
          success: false,
          message:
            "Já existe uma aula cadastrada neste horário para esta turma/professor/espaço.",
          validacoes: [],
        };
      }
      throw insertError;
    }

    // 2. Executar o motor de validações (Regras de Negócio Complexas)
    const validacoes = await executarValidacoes(aulaSalva);

    // 3. Se houver validações, registrar na tabela de logs
    if (validacoes.length > 0) {
      const logsParaInserir = validacoes.map((v) => ({
        aula_id: aulaSalva.id,
        regra: v.regra,
        gravidade: v.gravidade,
        mensagem: v.mensagem,
        dados_conflito: v.dadosConflito || {},
      }));

      await supabase.from("validacoes_logs").insert(logsParaInserir);
    }

    // 4. Revalidar a cache da página de lançamentos e grade
    revalidatePath("/(admin)/lancamentos");
    revalidatePath("/(admin)/grade");

    return {
      success: true,
      message:
        validacoes.length > 0
          ? "Aula salva com alertas."
          : "Aula salva com sucesso!",
      validacoes: validacoes,
      aula: aulaSalva,
    };
  } catch (error: any) {
    console.error("Erro ao salvar aula:", error);
    return {
      success: false,
      message: error.message || "Erro desconhecido ao salvar.",
      validacoes: [],
    };
  }
}

export async function cancelarAula(aulaId: number) {
  // Soft delete: apenas muda o status
  const { error } = await supabase
    .from("aulas")
    .update({ status: "CANCELADO" })
    .eq("id", aulaId);

  if (error) throw error;

  revalidatePath("/(admin)/lancamentos");
  revalidatePath("/(admin)/grade");

  return { success: true };
}
