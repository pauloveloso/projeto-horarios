import { createClient } from "@supabase/supabase-js";

// Pegamos as variáveis de ambiente que você configurou no .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Criamos o cliente (a "ponte") e exportamos para usar em qualquer tela do sistema
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
