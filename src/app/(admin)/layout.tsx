"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [menuAberto, setMenuAberto] = useState(false);

  // Estrutura do Menu
  const gruposMenu = [
    {
      titulo: "Visão Geral",
      itens: [{ nome: "Dashboard", href: "/painel", icone: "📊" }],
    },
    {
      titulo: "Gestão de Horários",
      itens: [
        { nome: "Lançamentos", href: "/lancamentos", icone: "🗓️" },
        { nome: "Carga Horária", href: "/relatorios/professores", icone: "📈" },
      ],
    },
    {
      titulo: "Base de Dados",
      itens: [
        // Juntamos Cursos e Turmas em um link só!
        { nome: "Cursos e Turmas", href: "/cadastros/cursos", icone: "🎓" },
        { nome: "Disciplinas", href: "/cadastros/disciplinas", icone: "📚" },
        { nome: "Professores", href: "/cadastros/professores", icone: "👨‍🏫" },
        { nome: "Espaços Físicos", href: "/cadastros/espacos", icone: "🏫" },
      ],
    },
  ];

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      {/* OVERLAY PARA MENU MOBILE */}
      {menuAberto && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setMenuAberto(false)}
        />
      )}

      {/* SIDEBAR (MENU LATERAL) */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-green-900 text-white shadow-2xl md:shadow-none transform transition-transform duration-300 ease-in-out print:hidden flex flex-col ${
          menuAberto ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* LOGO / CABEÇALHO DO MENU */}
        <div className="p-6 bg-green-950 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-2xl font-black italic tracking-tighter text-white">
              SGH{" "}
              <span className="font-light not-italic text-green-400">
                | Admin
              </span>
            </h1>
            <p className="text-[10px] uppercase tracking-widest text-green-200 mt-1">
              IFNMG - Campus Januária
            </p>
          </div>
          {/* Botão fechar no mobile */}
          <button
            onClick={() => setMenuAberto(false)}
            className="md:hidden text-green-200 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* LINKS DE NAVEGAÇÃO */}
        <nav className="flex-1 overflow-y-auto py-4 custom-scrollbar">
          {gruposMenu.map((grupo, index) => (
            <div key={index} className="mb-6">
              <h2 className="px-6 text-[10px] font-black uppercase tracking-wider text-green-400 mb-2">
                {grupo.titulo}
              </h2>
              <ul className="space-y-1">
                {grupo.itens.map((item) => {
                  const ativo =
                    pathname === item.href ||
                    pathname?.startsWith(item.href + "/");
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setMenuAberto(false)}
                        className={`flex items-center gap-3 px-6 py-2.5 transition-colors relative ${
                          ativo
                            ? "bg-green-800 text-white font-bold"
                            : "text-green-100 hover:bg-green-800/50 hover:text-white font-medium"
                        }`}
                      >
                        {ativo && (
                          <span className="absolute left-0 top-0 bottom-0 w-1.5 bg-green-400 rounded-r-md"></span>
                        )}
                        <span className="text-lg">{item.icone}</span>
                        <span className="text-sm">{item.nome}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* RODAPÉ DO MENU (LINK PARA VISÃO PÚBLICA) */}
        <div className="p-4 bg-green-950/50 border-t border-green-800 shrink-0">
          <Link
            href="/"
            target="_blank"
            className="flex items-center justify-center gap-2 w-full bg-green-800 hover:bg-green-700 text-white py-2 rounded-lg text-xs font-bold transition-colors"
          >
            <span>👁️</span> Visão Pública
          </Link>
        </div>
      </aside>

      {/* ÁREA DE CONTEÚDO PRINCIPAL */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* HEADER MOBILE */}
        <header className="md:hidden bg-white shadow-sm border-b border-gray-200 p-4 flex items-center gap-4 shrink-0 print:hidden">
          <button
            onClick={() => setMenuAberto(true)}
            className="p-2 -ml-2 bg-gray-50 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <span className="font-black text-green-800 italic">SGH | Admin</span>
        </header>

        {/* RENDERIZAÇÃO DAS TELAS AQUI DENTRO */}
        <main className="flex-1 overflow-y-auto bg-gray-50 relative p-4 md:p-8">
          {children}
        </main>
      </div>

      {/* CSS para barra de rolagem estilizada no menu */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(74, 222, 128, 0.2);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(74, 222, 128, 0.4);
        }
      `}</style>
    </div>
  );
}
