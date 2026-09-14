import { NextRequest, NextResponse, after } from "next/server";
import { firmaValida } from "@/lib/firma-meta";
import { avisar } from "@/lib/avisos";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { procesarInstagram, type EntradaIG } from "@/lib/procesar-instagram";

/**
 * Entrada de Instagram Direct (API de Instagram, app "DLS Control-IG").
 *
 * Mismo patrón que /api/whatsapp/webhook: verificar y responder rápido, el
 * procesamiento real vive en lib/procesar-instagram.ts (con pruebas).
 *
 * Meta llama a esta ruta de dos formas:
 *   GET  — una sola vez, para verificar que la URL es nuestra (hub.challenge).
 *   POST — cada DM entrante (y el eco de los que nosotros mandamos).
 */

/* ── GET: el apretón de manos de Meta ─────────────────────────────────────
   Igual que en WhatsApp: manda hub.verify_token y espera hub.challenge tal
   cual, en texto plano. Si el token no calza, 403. */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const modo = p.get("hub.mode");
  const token = p.get("hub.verify_token");
  const reto = p.get("hub.challenge");

  const esperado = process.env.IG_VERIFY_TOKEN;
  if (!esperado) {
    return new NextResponse("falta IG_VERIFY_TOKEN en el servidor", { status: 500 });
  }
  if (modo === "subscribe" && token === esperado && reto) {
    return new NextResponse(reto, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  const crudo = await req.text();

  if (!firmaValida(crudo, req.headers.get("x-hub-signature-256"), process.env.IG_APP_SECRET)) {
    return new NextResponse("firma_invalida", { status: 401 });
  }

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = JSON.parse(crudo);
  } catch {
    return NextResponse.json({ ok: false, error: "json_invalido" }, { status: 400 });
  }

  if (cuerpo.object !== "instagram") {
    // No es nuestro: 200 igual, o Meta reintenta en bucle.
    return NextResponse.json({ ok: true, ignorado: "objeto_no_esperado" });
  }

  const entradas = (cuerpo.entry as EntradaIG[]) ?? [];
  const db = supabaseAdmin();
  const r = await procesarInstagram(entradas, db);

  // Igual que WhatsApp: el aviso va después de responder, Meta reintenta si no recibe respuesta a tiempo.
  for (const aviso of r.avisos) after(() => avisar(aviso).then(() => undefined));

  // Siempre 200: si Meta recibe un error, reintenta el mismo mensaje durante horas.
  return NextResponse.json({ ok: true, procesados: r.procesados, duplicados: r.duplicados });
}
