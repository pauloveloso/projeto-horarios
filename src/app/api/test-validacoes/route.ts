import { NextResponse } from "next/server";
import { executarTestes } from "../../../tests/test-validacoes";

export async function GET() {
  try {
    await executarTestes();
    return NextResponse.json({
      message: "Testes executados com sucesso. Verifique o console.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Erro ao executar testes", details: error },
      { status: 500 },
    );
  }
}
