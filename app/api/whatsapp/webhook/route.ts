import { NextRequest, NextResponse, after } from "next/server";
import { firmaValida } from "@/lib/firma-meta";
import { avisar } from "@/lib/avisos";
import { guardarAdjunto } from "@/lib/adjuntos";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { procesarWhatsApp, asuntoDe, type CambioWA } from "@/lib/procesar-whatsapp";

/**
 * Entrada de WhatsApp (Cloud API de Meta).
 *
 * Un mensaje de WhatsApp trae poco: un número, un nombre de perfil y un texto.
 * No trae comuna, ni m², ni presupuesto. Así que **este canal no califica, captura**:
 * el lead entra con su teléfono — o sea, llamable desde el primer segundo — y
 * se le saca al texto lo que se pueda (tipo de proyecto y metros, si los menciona).
 *
 * Esta ruta solo verifica la firma y responde rápido. Lo que se hace con cada
 * mensaje vive en `lib/procesar-whatsapp.ts` (con pruebas): dedupe de reintentos,
 * alta del lead con las mismas reglas de la web, y la lista de tareas posteriores
 * — descargar adjuntos y avisar al celular — que corren después de responder.
 *
 * Meta llama a esta ruta de dos formas:
 *   GET  — una sola vez, para verificar que la URL es nuestra (hub.challenge).
 *   POST — cada mensaje entrante y cada acuse de entrega.
 */

/* ── GET: el apretón de manos de Meta ─────────────────────────────────────
   Meta manda hub.verify_token y espera que le devolvamos hub.challenge tal
   cual, en texto plano. Si el token no calza, 403. */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const modo = p.get("hub.mode");
  const token = p.get("hub.verify_token");
  const reto = p.get("hub.challenge");

  const esperado = process.env.WA_VERIFY_TOKEN;
  if (!esperado) {
    return new NextResponse("falta WA_VERIFY_TOKEN en el servidor", { status: 500 });
  }
  if (modo === "subscribe" && token === esperado && reto) {
    return new NextResponse(reto, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

/** Aviso al celular y rastro en la ficha cuando Meta no pudo entregar un mensaje. */
async function avisarNoEntregado(telefono: string, motivo: string, codigo: number | null) {
  const db = supabaseAdmin();
  const { data: lead } = db
    ? await db.from("leads").select("id, nombre").eq("telefono", telefono).limit(1).maybeSingle()
    : { data: null };
  const quien = (lead?.nombre as string | undefined) || `+${telefono}`;
  if (db && lead?.id) {
    await db.from("actividad").insert({
      lead_id: lead.id,
      tipo: "whatsapp_no_entregado",
      despues: { motivo, codigo },
      quien: "sistema",
    });
  }
  await avisar({
    titulo: `No se entregó tu WhatsApp a ${quien}`,
    cuerpo: `Motivo: ${motivo}.`,
    url: lead?.id ? `/?lead=${lead.id}` : "/",
    tag: `wa-fallido-${telefono}`,
  });
}

export async function POST(req: NextRequest) {
  const crudo = await req.text();

  if (!firmaValida(crudo, req.headers.get("x-hub-signature-256"), process.env.WA_APP_SECRET)) {
    return new NextResponse("firma_invalida", { status: 401 });
  }

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = JSON.parse(crudo);
  } catch {
    return NextResponse.json({ ok: false, error: "json_invalido" }, { status: 400 });
  }

  if (cuerpo.object !== "whatsapp_business_account") {
    // No es nuestro: 200 igual, o Meta reintenta en bucle.
    return NextResponse.json({ ok: true, ignorado: "objeto_no_esperado" });
  }

  const cambios = ((cuerpo.entry as { changes?: CambioWA[] }[]) ?? []).flatMap((e) => e.changes ?? []);
  const db = supabaseAdmin();
  const r = await procesarWhatsApp(cambios, db);

  // Todo lo lento va después de responder: Meta reintenta si no recibe respuesta a tiempo.
  for (const f of r.noEntregados) after(() => avisarNoEntregado(f.telefono, f.motivo, f.codigo));
  for (const a of r.adjuntos) {
    after(async () => {
      if (!db) return;
      const ruta = await guardarAdjunto(db, a.medio, a.idMeta);
      if (ruta) {
        await db.from("mensajes").update({ cuerpo: `${a.legible}\nadjunto:${ruta}` }).eq("asunto", asuntoDe(a.idMeta));
      }
    });
  }
  for (const aviso of r.avisos) after(() => avisar(aviso).then(() => undefined));

  // Siempre 200: si Meta recibe un error, reintenta el mismo mensaje durante
  // horas. Lo que falle queda en el log, no en una cola de reintentos.
  return NextResponse.json({ ok: true, procesados: r.procesados, duplicados: r.duplicados });
}
