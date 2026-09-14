import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { quienLlama } from "@/lib/cron";
import { avisar } from "@/lib/avisos";
import { respaldar } from "@/lib/respaldo";

/**
 * Respaldo semanal (cron de los domingos, `vercel.json`). Daniel con sesión
 * también puede abrirla para respaldar en el momento. Detalle en `lib/respaldo.ts`.
 */
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const { cron, sesion } = await quienLlama(req);
  if (!cron && !sesion) return NextResponse.json({ ok: false, error: "sin_sesion" }, { status: 401 });

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, error: "sin_base_de_datos" }, { status: 500 });

  try {
    const r = await respaldar(db);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    const detalle = e instanceof Error ? e.message : String(e);
    console.error("Respaldo:", detalle);
    if (cron) await avisar({ titulo: "El respaldo semanal falló", cuerpo: detalle, url: "/", tag: "respaldo" });
    return NextResponse.json({ ok: false, error: "respaldo", detalle }, { status: 500 });
  }
}
