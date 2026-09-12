import { NextRequest, NextResponse } from "next/server";
import { usuarioDeLaPeticion } from "@/lib/sesion";

/**
 * Suscribe la cuenta de WhatsApp a esta aplicación.
 *
 * Sin esto **no llega ni un mensaje**, aunque el webhook esté configurado, la
 * URL sea correcta, el campo `messages` esté suscrito y la app publicada. Meta
 * no avisa en ninguna parte: los paneles se ven todos en verde y los mensajes
 * simplemente se pierden. Costó una prueba fallida descubrirlo.
 *
 * Es la contraparte del chequeo `?subs=1` en `/api/whatsapp/salud`: ese dice si
 * falta, esto lo arregla. Se deja como ruta y no como un paso manual porque, si
 * algún día alguien desconecta y reconecta el número en los paneles de Meta, la
 * suscripción se pierde y hay que rehacerla exactamente igual.
 */

const GRAPH = "https://graph.facebook.com/v21.0";

export async function POST(req: NextRequest) {
  const quien = await usuarioDeLaPeticion(req);
  if (!quien.ok) return NextResponse.json({ ok: false, error: quien.error }, { status: quien.status });

  const token = process.env.WA_ACCESS_TOKEN ?? "";
  if (!token) {
    return NextResponse.json({ ok: false, error: "sin_token" }, { status: 500 });
  }

  let body: { waba?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "json_invalido" }, { status: 400 });
  }

  const waba = String(body.waba ?? "").trim();
  if (!/^\d{5,25}$/.test(waba)) {
    return NextResponse.json({ ok: false, error: "waba_invalido" }, { status: 400 });
  }

  const r = await fetch(`${GRAPH}/${waba}/subscribed_apps`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const j = (await r.json()) as Record<string, unknown>;

  if (!r.ok) {
    const err = (j.error ?? {}) as Record<string, unknown>;
    return NextResponse.json(
      { ok: false, error: "meta_rechazo", detalle: String(err.message ?? "no se pudo suscribir") },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, respuesta: j });
}
