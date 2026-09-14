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

  // Tener sesión no basta: tiene que ser alguien del panel. Hasta el 13-sep-2026
  // Supabase permitía registrarse, así que cualquiera que pidiera un código con
  // su correo quedaba "con sesión" — y estas rutas mandan WhatsApp a clientes.
  const email = (data.user.email ?? "").toLowerCase();
  if (!correoDelPanel(email)) return { ok: false, error: "sin_permiso", status: 403 };

  return { ok: true, email };
}

/** Correos con acceso al panel. Mismo listado que la función `es_del_panel()` de la base (007). */
export function correoDelPanel(email: string): boolean {
  const lista = (process.env.PANEL_EMAILS || "dls.lehmann@gmail.com")
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
  return lista.includes(email.trim().toLowerCase());
}
