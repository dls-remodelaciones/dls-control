import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { usuarioDeLaPeticion } from "@/lib/sesion";
import { enviarTexto, ventanaAbierta, whatsappConfigurado } from "@/lib/whatsapp";

/**
 * La conversación de WhatsApp de un lead, desde el panel.
 *
 *   GET  ?lead_id=…  → los últimos mensajes y si se puede escribir ahora.
 *   POST {lead_id, texto} → envía desde el número del negocio y lo registra.
 *
 * Por qué el envío pasa por acá y no por el navegador: el token de Meta no
 * puede salir del servidor. Si estuviera en el bundle, cualquiera que abriera
 * el código fuente podría mandar WhatsApps a nombre de DLS.
 *
 * Todo lo que sale queda guardado en `mensajes` como `saliente`. El historial
 * de una conversación no puede depender de que alguien se acuerde de anotarlo.
 */

const LIMITE_MENSAJES = 30;

type Mensaje = {
  id: string;
  direccion: string;
  canal: string | null;
  cuerpo: string | null;
  enviado_por: string | null;
  creado: string;
};

/** El último mensaje que ESCRIBIÓ la persona. Es lo que abre la ventana. */
function ultimoEntrante(mensajes: Mensaje[]): string | null {
  const entrantes = mensajes.filter((m) => m.direccion === "entrante" && m.canal === "whatsapp");
  if (!entrantes.length) return null;
  return entrantes.reduce((a, b) => (Date.parse(a.creado) > Date.parse(b.creado) ? a : b)).creado;
}

async function cargar(leadId: string) {
  const db = supabaseAdmin();
  if (!db) return { error: "sin_base_de_datos" as const };

  const { data: lead, error: e1 } = await db
    .from("leads")
    .select("id, nombre, telefono")
    .eq("id", leadId)
    .single();
  if (e1 || !lead) return { error: "lead_no_existe" as const };

  const { data: mensajes } = await db
    .from("mensajes")
    .select("id, direccion, canal, cuerpo, enviado_por, creado")
    .eq("lead_id", leadId)
    .eq("canal", "whatsapp")
    .order("creado", { ascending: false })
    .limit(LIMITE_MENSAJES);

  return { db, lead, mensajes: (mensajes ?? []) as Mensaje[] };
}

export async function GET(req: NextRequest) {
  const quien = await usuarioDeLaPeticion(req);
  if (!quien.ok) return NextResponse.json({ ok: false, error: quien.error }, { status: quien.status });

  const leadId = req.nextUrl.searchParams.get("lead_id")?.trim() ?? "";
  if (!leadId) return NextResponse.json({ ok: false, error: "falta_lead_id" }, { status: 400 });

  const r = await cargar(leadId);
  if ("error" in r) return NextResponse.json({ ok: false, error: r.error }, { status: 404 });

  const ultimo = ultimoEntrante(r.mensajes);
  const ventana = ventanaAbierta(ultimo);

  return NextResponse.json({
    ok: true,
    lead: { id: r.lead.id, nombre: r.lead.nombre, telefono: r.lead.telefono },
    puede_escribir: whatsappConfigurado() && Boolean(r.lead.telefono) && ventana.abierta,
    ventana: { ...ventana, ultimo_mensaje_del_cliente: ultimo },
    configurado: whatsappConfigurado(),
    // En orden de lectura: el más antiguo primero, como una conversación.
    mensajes: [...r.mensajes].reverse(),
  });
}

export async function POST(req: NextRequest) {
  const quien = await usuarioDeLaPeticion(req);
  if (!quien.ok) return NextResponse.json({ ok: false, error: quien.error }, { status: quien.status });

  let body: { lead_id?: unknown; texto?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "json_invalido" }, { status: 400 });
  }

  const leadId = String(body.lead_id ?? "").trim();
  const texto = String(body.texto ?? "").trim();
  if (!leadId) return NextResponse.json({ ok: false, error: "falta_lead_id" }, { status: 400 });
  if (!texto) return NextResponse.json({ ok: false, error: "mensaje_vacio" }, { status: 400 });

  const r = await cargar(leadId);
  if ("error" in r) return NextResponse.json({ ok: false, error: r.error }, { status: 404 });
  if (!r.lead.telefono) {
    return NextResponse.json(
      { ok: false, error: "sin_telefono", detalle: "Este lead no dejó teléfono." },
      { status: 422 },
    );
  }

  // Se comprueba la ventana ANTES de llamar a Meta. Se podría dejar que Meta lo
  // rechace, pero entonces el mensaje se pierde sin explicación clara y el
  // intento igual cuenta contra los límites de la cuenta.
  const ventana = ventanaAbierta(ultimoEntrante(r.mensajes));
  if (!ventana.abierta) {
    return NextResponse.json(
      {
        ok: false,
        error: "ventana_cerrada",
        detalle:
          "Pasaron más de 24 horas desde su último mensaje (o nunca escribió). WhatsApp solo permite plantillas aprobadas en ese caso.",
      },
      { status: 409 },
    );
  }

  const envio = await enviarTexto(r.lead.telefono, texto);
  if (!envio.ok) {
    return NextResponse.json(
      { ok: false, error: envio.error, detalle: envio.detalle },
      { status: envio.error === "ventana_cerrada" ? 409 : 502 },
    );
  }

  // Queda registrado con el correo de quien lo mandó: si algún día hay más de
  // una persona respondiendo, se sabe quién dijo qué.
  await r.db.from("mensajes").insert({
    lead_id: leadId,
    direccion: "saliente",
    canal: "whatsapp",
    asunto: "Respuesta por WhatsApp",
    cuerpo: texto,
    enviado_por: quien.email || "panel",
  });
  await r.db.from("leads").update({ ultima_actividad: new Date().toISOString() }).eq("id", leadId);

  return NextResponse.json({ ok: true, id_mensaje: envio.id_mensaje });
}
