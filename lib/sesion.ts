import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Quién está pidiendo esto.
 *
 * Las rutas del panel (a diferencia de los webhooks, que los llama Meta o el
 * sitio) solo deben responderle a Daniel. El navegador manda el JWT de Supabase
 * en `Authorization: Bearer`, y acá se valida contra Supabase.
 *
 * Se prefirió esto a una clave en la URL porque una clave en la URL queda en el
 * historial del navegador, en los logs del servidor y en cualquier captura de
 * pantalla que se comparta.
 */
export async function usuarioDeLaPeticion(
  req: NextRequest,
): Promise<{ ok: true; email: string } | { ok: false; error: string; status: number }> {
  const auth = req.headers.get("authorization") ?? "";
  const jwt = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!jwt) return { ok: false, error: "sin_sesion", status: 401 };

  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "sin_base_de_datos", status: 500 };

  const { data, error } = await db.auth.getUser(jwt);
  if (error || !data?.user) return { ok: false, error: "sesion_invalida", status: 401 };

  return { ok: true, email: data.user.email ?? "" };
}
