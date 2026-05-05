export const dynamic = "force-dynamic"; // Obriga o Next.js a buscar dados novos a cada acesso

import { supabase } from "@/lib/supabase";

/**
 * Página principal de Consulta Pública de Horários do IFNMG - Campus Januária.
 *
 * Esta função é um Server Component do Next.js. Ela é executada no servidor
 * no momento em que o usuário acessa a URL, garantindo que os dados buscados
 * sejam sempre os mais recentes antes de enviar a tela (HTML) para o navegador.
 *
 * @async
 * @function ConsultaPublicaPage
 * @returns {Promise<JSX.Element>} Retorna a interface de usuário (UI) renderizada,
 * contendo o cabeçalho institucional e a lista de cursos disponíveis (ou uma
 * mensagem de estado vazio, caso não haja dados).
 */
export default async function ConsultaPublicaPage() {
  // 1. BUSCA DE DADOS (Data Fetching)
  // ---------------------------------------------------------------------------
  // Comunicação assíncrona com o banco de dados Supabase.
  // Estamos solicitando todas as colunas (*) da tabela 'cursos'.
  //const { data: cursos, error } = await supabase.from("cursos").select("*");

  const { data: cursos, error } = await supabase.from("cursos").select("*");

  // Injetando o Raio-X no terminal do VS Code
  console.log("🔍 TESTE DE CONEXÃO - Erro:", error);
  console.log("🔍 TESTE DE CONEXÃO - Dados:", cursos);

  if (error) {
    console.error("Erro ao buscar cursos na base de dados:", error);
  }

  // 2. TRATAMENTO DE ERROS
  // ---------------------------------------------------------------------------
  // Verifica se a API do Supabase retornou algum erro (ex: falha de rede ou
  // política RLS bloqueando o acesso). Em caso positivo, o erro é impresso
  // no console do servidor (terminal do VS Code).
  if (error) {
    console.error("Erro ao buscar cursos na base de dados:", error);
  }

  // 3. RENDERIZAÇÃO DA INTERFACE (Render)
  // ---------------------------------------------------------------------------
  // Retorna a estrutura HTML com classes do Tailwind CSS para a estilização.
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center p-8">
      {/* --- Cabeçalho Institucional --- */}
      <header className="w-full max-w-4xl bg-green-700 text-white rounded-lg p-6 shadow-md mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">Projeto Horários</h1>
        <p className="text-green-100">IFNMG - Campus Januária</p>
      </header>

      {/* --- Área Principal de Conteúdo --- */}
      <section className="w-full max-w-4xl bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          Cursos Disponíveis
        </h2>

        {/* 
          Renderização Condicional:
          Avalia se a variável 'cursos' é nula ou se o array está vazio.
          - Se estiver vazio: Renderiza a mensagem de aviso (estado vazio).
          - Se possuir dados: Renderiza a lista (ul) mapeando cada item.
        */}
        {!cursos || cursos.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            Nenhum curso cadastrado ainda. O banco de dados está conectado, mas
            vazio!
          </p>
        ) : (
          <ul className="space-y-3">
            {/* 
              Iteração de Array (.map):
              Percorre cada objeto 'curso' retornado do banco de dados e cria 
              um elemento de lista (li) correspondente. A propriedade 'key' é 
              obrigatória no React para otimização de performance.
            */}
            {cursos.map((curso) => (
              <li
                key={curso.id}
                className="p-4 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
              >
                <span className="font-medium text-gray-700">{curso.nome}</span>
                <span className="ml-3 text-xs font-semibold px-2 py-1 bg-green-100 text-green-800 rounded-full">
                  {curso.modalidade}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
