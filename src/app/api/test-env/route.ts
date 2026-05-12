// src/app/api/test-env/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return NextResponse.json({
    urlConfigurada: !!url,
    urlValor: url, // Cuidado: isso expõe a URL no console, ok para debug local
    chaveConfigurada: !!key,
    chavePrimeirosCaracteres: key
      ? key.substring(0, 15) + "..."
      : "não definida",
  });
}
