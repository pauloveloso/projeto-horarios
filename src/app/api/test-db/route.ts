// src/app/api/test-db/route.ts
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { erro: "Variáveis de ambiente faltando" },
      { status: 500 },
    );
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Tenta buscar uma tabela que sabemos que existe (ex: cursos)
    const { data, error } = await supabase
      .from("cursos")
      .select("id, nome")
      .limit(1);

    if (error) {
      return NextResponse.json(
        {
          erro: "Erro na consulta",
          mensagem: error.message,
          detalhes: error.details,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      sucesso: true,
      mensagem: "Conexão OK! Tabelas encontradas.",
      dados: data,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        erro: "Falha na conexão",
        mensagem: err.message,
      },
      { status: 500 },
    );
  }
}
