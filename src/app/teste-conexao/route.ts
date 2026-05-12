// src/app/teste-conexao/route.ts
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: "Variáveis de ambiente faltando" },
      { status: 500 },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Tenta contar as turmas (tabela que deve existir no novo banco)
  const { count, error } = await supabase
    .from("turmas")
    .select("*", { count: "exact", head: true });

  if (error) {
    return NextResponse.json(
      {
        erro: "Falha na conexão",
        mensagem: error.message,
        detalhes: error,
      },
      { status: 500 },
    );
  }

  // Tenta buscar uma aula para ver se a tabela nova existe
  const { data: aulas, error: erroAulas } = await supabase
    .from("aulas")
    .select("id")
    .limit(1);

  return NextResponse.json({
    sucesso: true,
    conexao: "OK",
    url_usada: supabaseUrl,
    total_turmas: count,
    tabela_aulas_existe: !erroAulas,
    primeira_aula: aulas && aulas.length > 0 ? aulas[0] : "Nenhuma aula ainda",
  });
}
