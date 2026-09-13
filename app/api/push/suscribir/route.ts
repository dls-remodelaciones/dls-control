import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { usuarioDeLaPeticion } from "@/lib/sesion";

/**
 * Registra (POST) o quita (DELETE) un dispositivo para recibir avisos.
 *
 * Exige sesión del panel: si cualquiera pudiera suscribirse, cualquiera
 * recibiría el nombre y el teléfono de cada lead nuevo en su celular.
 *
 * Se guarda por `endpoint` único, así que activar los avisos dos veces en el
 * mismo teléfono no duplica: actualiza.
 */

type Suscripcion = { endpoint?: string; keys?: { p256dh?: string; auth?: string } };

export async function POST(req: NextRequest) {
  const quien = await usuarioDeLaPeticion(req);
  if (!quien.ok) return NextResponse.json({ ok: false, error: quien.error }, { status: quien.status });

  let sub: Suscripcion;
  try {
    sub = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "json_invalido" }, { status: 400 });
  }
  const endpoint = String(sub.endpoint ?? "");
  const p256dh = String(sub.keys?.p256dh ?? "");
  const auth = String(sub.keys?.auth ?? "");
  if (!endpoint.startsWith("https://") || !p256dh || !auth) {
    return NextResponse.json({ ok: false, error: "suscripcion_invalida" }, { status: 422 });
  }

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, error: "sin_base_de_datos" }, { status: 500 });

  const { error } = await db.from("push_subs").upsert(
    { endpoint, p256dh, auth, user_agent: (req.headers.get("user-agent") ?? "").slice(0, 300) },
    { onConflict: "endpoint" },
  );
  if (error) return NextResponse.json({ ok: false, error: "db", detalle: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const quien = await usuarioDeLaPeticion(req);
  if (!quien.ok) return NextResponse.json({ ok: false, error: quien.error }, { status: quien.status });

  let body: { endpoint?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "json_invalido" }, { status: 400 });
  }
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, error: "sin_base_de_datos" }, { status: 500 });
  await db.from("push_subs").delete().eq("endpoint", String(body.endpoint ?? ""));
  return NextResponse.json({ ok: true });
}
