import { NextRequest, NextResponse, after } from "next/server";
import { firmaValida } from "@/lib/firma-meta";
import { avisar } from "@/lib/avisos";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { procesarFacebook, type EntradaFB } from "@/lib/procesar-facebook";

/**
 * Entrada de Messenger (página "DLS Expertos en Remodelaciones").
 *
 * Mismo patrón que /api/instagram/webhook y /api/whatsapp/webhook: verificar
 * y responder rápido, el procesamiento real vive en lib/procesar-facebook.ts
 * (con pruebas).
 *
 * Meta llama a esta ruta de dos formas:
 *   GET  — una sola vez, para verificar que la URL es nuestra (hub.challenge).
 *   POST — cada DM entrante (y el eco de los que nosotros mandamos).
 */

/* ── GET: el apretón de manos de Meta ───────────────────────────────────── */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const modo = p.get("hub.mode");
  const token = p.get("hub.verify_token");
  const reto = p.get("hub.challenge");

  const esperado = process.env.FB_VERIFY_TOKEN;
  if (!esperado) {
    return new NextResponse("falta FB_VERIFY_TOKEN en el servidor", { status: 500 });
  }
  if (modo === "subscribe" && token === esperado && reto) {
    return new NextResponse(reto, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  const crudo = await req.text();

  // Messenger y WhatsApp viven en la misma app de Meta ("DLS Control"), a
  // diferencia de Instagram que tiene una app separada: es la misma clave.
  const appSecret = process.env.FB_APP_SECRET || process.env.WA_APP_SECRET;
  if (!firmaValida(crudo, req.headers.get("x-hub-signature-256"), appSecret)) {
    return new NextResponse("firma_invalida", { status: 401 });
  }

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = JSON.parse(crudo);
  } catch {
    return NextResponse.json({ ok: false, error: "json_invalido" }, { status: 400 });
  }

  if (cuerpo.object !== "page") {
    // No es nuestro: 200 igual, o Meta reintenta en bucle.
    return NextResponse.json({ ok: true, ignorado: "objeto_no_esperado" });
  }

  const entradas = (cuerpo.entry as EntradaFB[]) ?? [];
  const db = supabaseAdmin();
  const r = await procesarFacebook(entradas, db);

  for (const aviso of r.avisos) after(() => avisar(aviso).then(() => undefined));

  // Siempre 200: si Meta recibe un error, reintenta el mismo mensaje durante horas.
  return NextResponse.json({ ok: true, procesados: r.procesados, duplicados: r.duplicados });
}
