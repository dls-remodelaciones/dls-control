import { createClient } from "@supabase/supabase-js";

/**
 * Cliente de Supabase para el navegador.
 *
 * La publishable key es pública por diseño — viaja en el bundle. Lo que protege
 * los datos es el Row Level Security que activa `supabase/schema.sql`: sin sesión
 * no se lee ni se escribe nada.
 *
 * La secret key NO va acá. Vive solo en variables de entorno de Vercel y la usan
 * el webhook y el cron, que necesitan saltarse el RLS.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const configurado = Boolean(url && key);

export const supabase = configurado
  ? createClient(url as string, key as string, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;
