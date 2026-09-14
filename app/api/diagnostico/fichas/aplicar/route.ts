import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { usuarioDeLaPeticion } from "@/lib/sesion";
import { diagnosticar, type LeadDiag, type MensajeDiag } from "@/lib/diagnostico";
import { calificar, interaccionPrevia, type Lead } from "@/lib/negocio";

/**
 * Aplica las propuestas del diagnóstico de fichas (ver `lib/diagnostico.ts`).
 *
 * Las propuestas se recalculan acá, en el servidor: no se aplica lo que mande
 * el navegador. Cada cambio deja en `actividad` el valor anterior y el nuevo,
 * así que cualquier recuperación se puede deshacer a mano.
 *
 * Autorizado por Daniel el 14-sep-2026 ("soluciona solo todo lo que puedas"),
 * después de ver las propuestas en el informe de las 20 mejoras.
 */
export async function POST(req: NextRequest) {
  const quien = await usuarioDeLaPeticion(req);
  if (!quien.ok) return NextResponse.json({ ok: false, error: quien.error }, { status: quien.status });

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, error: "sin_base_de_datos" }, { status: 500 });

  const [leads, mensajes, cotizaciones] = await Promise.all([
    db.from("leads").select("*").limit(5000),
    db.from("mensajes").select("lead_id, canal, cuerpo, creado").eq("direccion", "entrante").limit(20000),
    db.from("cotizaciones").select("lead_id").limit(20000),
  ]);
  const error = leads.error ?? mensajes.error ?? cotizaciones.error;
  if (error) return NextResponse.json({ ok: false, error: "consulta", detalle: error.message }, { status: 500 });

  const porId = new Map((leads.data ?? []).map((l) => [l.id as string, l as Record<string, unknown>]));
  const propuestas = diagnosticar(
    (leads.data ?? []) as LeadDiag[],
    (mensajes.data ?? []) as MensajeDiag[],
    new Set((cotizaciones.data ?? []).map((c) => c.lead_id as string)),
  );

  const aplicadas: { lead_id: string; nombre: string; cambios: string[] }[] = [];
  for (const p of propuestas) {
    const lead = porId.get(p.lead_id);
    if (!lead) continue;
    const cambios: Record<string, unknown> = {};
    const antes: Record<string, unknown> = {};

    for (const c of p.cambios) {
      if (c.campo === "nombre" || c.campo === "fuente_original") {
        antes[c.campo] = lead[c.campo] ?? null;
        cambios[c.campo] = c.propuesto;
      }
    }
    if (p.cambios.some((c) => c.campo === "puntaje")) {
      const cal = calificar({
        ...(lead as unknown as Lead),
        ...(cambios as Partial<Lead>),
        superficie_m2: Number(lead.superficie_m2) || 0,
        fotos: Array.isArray(lead.fotos) ? (lead.fotos as string[]) : [],
        termino_cotizador: true,
        respondio_followup: interaccionPrevia(lead).respondio_followup,
      });
      Object.assign(antes, { score: lead.score, clasificacion: lead.clasificacion, apto_para_llamar: lead.apto_para_llamar });
      Object.assign(cambios, {
        score: cal.score,
        clasificacion: cal.clasificacion,
        desglose: cal.desglose,
        apto_para_llamar: cal.apto_para_llamar,
      });
    }
    if (!Object.keys(cambios).length) continue;

    const { error: e } = await db.from("leads").update(cambios).eq("id", p.lead_id);
    if (e) return NextResponse.json({ ok: false, error: "db_update", detalle: e.message, aplicadas }, { status: 500 });

    const { desglose: _d, ...despues } = cambios;
    await db.from("actividad").insert({
      lead_id: p.lead_id,
      tipo: "recuperacion",
      antes,
      despues,
      quien: quien.email,
    });
    aplicadas.push({ lead_id: p.lead_id, nombre: p.nombre_actual, cambios: p.cambios.map((c) => `${c.campo}: ${c.ahora} → ${c.propuesto}`) });
  }

  return NextResponse.json({ ok: true, aplicadas });
}
