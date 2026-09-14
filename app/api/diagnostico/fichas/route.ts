import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { usuarioDeLaPeticion } from "@/lib/sesion";
import { diagnosticar, type LeadDiag, type MensajeDiag } from "@/lib/diagnostico";

/**
 * Qué se podría recuperar de las fichas dañadas (ver `lib/diagnostico.ts`).
 * Solo lectura: no cambia ningún dato. Requiere la sesión de Daniel.
 */
export async function GET(req: NextRequest) {
  const quien = await usuarioDeLaPeticion(req);
  if (!quien.ok) return NextResponse.json({ ok: false, error: quien.error }, { status: quien.status });

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, error: "sin_base_de_datos" }, { status: 500 });

  const [leads, mensajes, cotizaciones] = await Promise.all([
    db.from("leads").select("id, nombre, fuente_original, desglose, comuna").limit(5000),
    db.from("mensajes").select("lead_id, canal, cuerpo, creado").eq("direccion", "entrante").limit(20000),
    db.from("cotizaciones").select("lead_id").limit(20000),
  ]);
  const error = leads.error ?? mensajes.error ?? cotizaciones.error;
  if (error) return NextResponse.json({ ok: false, error: "consulta", detalle: error.message }, { status: 500 });

  const propuestas = diagnosticar(
    (leads.data ?? []) as LeadDiag[],
    (mensajes.data ?? []) as MensajeDiag[],
    new Set((cotizaciones.data ?? []).map((c) => c.lead_id as string)),
  );
  return NextResponse.json({ ok: true, revisadas: leads.data?.length ?? 0, con_propuestas: propuestas.length, propuestas });
}
