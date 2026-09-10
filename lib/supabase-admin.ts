import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con la service role key — **solo servidor**.
 *
 * Esta key se salta el Row Level Security por diseño, que es justo lo que el
 * webhook y el cron necesitan (entran sin sesión de usuario). Por eso vive
 * únicamente en variables de entorno de Vercel y nunca lleva el prefijo
 * NEXT_PUBLIC_, que la expondría en el navegador.
 */
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
