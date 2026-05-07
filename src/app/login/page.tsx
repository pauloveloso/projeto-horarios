"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  const fazerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    setErro("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (error) {
      setErro("E-mail ou senha incorretos.");
      setCarregando(false);
    } else if (data.session) {
      // Se o login der certo, manda para o painel gerencial
      router.push("/painel");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        {/* CABEÇALHO DO LOGIN */}
        <div className="bg-green-800 p-8 text-center">
          <h1 className="text-3xl font-black italic tracking-tighter text-white">
            SGH{" "}
            <span className="font-light not-italic text-green-200">
              | IFNMG
            </span>
          </h1>
          <p className="text-green-100 text-sm mt-2 font-medium">
            Acesso Restrito - Coordenação
          </p>
        </div>

        {/* FORMULÁRIO */}
        <div className="p-8">
          <form onSubmit={fazerLogin} className="space-y-6">
            {erro && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-bold text-center border border-red-200">
                {erro}
              </div>
            )}

            <div>
              <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">
                E-mail Institucional
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-green-500 bg-gray-50 focus:bg-white transition-colors"
                placeholder="coordenacao@ifnmg.edu.br"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">
                Senha
              </label>
              <input
                type="password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-green-500 bg-gray-50 focus:bg-white transition-colors"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={carregando}
              className="w-full bg-green-600 text-white font-black py-3 rounded-lg shadow-md hover:bg-green-700 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center"
            >
              {carregando ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                "ENTRAR NO SISTEMA"
              )}
            </button>
          </form>
        </div>

        {/* RODAPÉ DO LOGIN */}
        <div className="bg-gray-50 p-4 text-center border-t border-gray-100">
          <Link
            href="/"
            className="text-sm font-bold text-gray-500 hover:text-green-700 transition-colors"
          >
            ← Voltar para Consulta Pública
          </Link>
        </div>
      </div>
    </div>
  );
}
