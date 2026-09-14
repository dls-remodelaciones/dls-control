import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { usuarioDeLaPeticion } from "@/lib/sesion";
import { ventanaAbierta } from "@/lib/whatsapp";
import { enviarDM, leerSesion } from "@/lib/dm";

/**
 * Responder un DM de Instagram o Messenger desde el panel.
 *
 * Misma forma que /api/whatsapp/conversacion: solo con sesión del panel, la
 * ventana se comprueba ANTES de llamar a Meta (si no, el mensaje se pierde sin
 * explicación y el intento igual cuenta contra los límites de la cuenta), y lo
 * enviado queda guardado como mensaje saliente para que el historial del lead
 * muestre la conversación completa.
 */

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

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, error: "sin_base_de_datos" }, { status: 500 });

  const { data: lead, error: eLead } = await db
    .from("leads")
    .select("id, nombre, sesion_id, canal")
    .eq("id", leadId)
    .maybeSingle();
  if (eLead) return NextResponse.json({ ok: false, error: "consulta", detalle: eLead.message }, { status: 500 });
  if (!lead) return NextResponse.json({ ok: false, error: "lead_no_encontrado" }, { status: 404 });

  const destino = leerSesion(lead.sesion_id as string | null);
  if (!destino) {
    return NextResponse.json(
      { ok: false, error: "sin_conversacion", detalle: "Este lead no llegó por Instagram ni por Messenger." },
      { status: 422 },
    );
  }

  // La ventana de 24 horas corre desde el último mensaje de la persona. Sin
  // ningún entrante nunca se abrió, y Meta rechazaría el envío.
  const { data: entrantes } = await db
    .from("mensajes")
    .select("creado")
    .eq("lead_id", leadId)
    .eq("direccion", "entrante")
    .order("creado", { ascending: false })
    .limit(1);
  const ventana = ventanaAbierta((entrantes?.[0]?.creado as string | undefined) ?? null);
  if (!ventana.abierta) {
    return NextResponse.json(
      {
        ok: false,
        error: "ventana_cerrada",
        detalle:
          "Pasaron más de 24 horas desde su último mensaje. Meta ya no deja responder desde acá: hay que escribirle desde la aplicación.",
      },
      { status: 409 },
    );
  }

  const envio = await enviarDM(lead.sesion_id as string, texto);
  if (!envio.ok) {
    const estado = envio.error === "ventana_cerrada" ? 409 : envio.error === "sin_configuracion" ? 503 : 502;
    return NextResponse.json({ ok: false, error: envio.error, detalle: envio.detalle }, { status: estado });
  }

  // Queda con el correo de quien lo mandó, igual que en WhatsApp.
  const { error: eGuardar } = await db.from("mensajes").insert({
    lead_id: leadId,
    direccion: "saliente",
    canal: destino.canal,
    asunto: `Respuesta por ${destino.canal === "instagram" ? "Instagram" : "Messenger"}`,
    cuerpo: texto,
    enviado_por: quien.email,
  });
  // El mensaje ya salió: si no se pudo guardar, se anota y se responde ok igual.
  // Decir que falló haría que se reenvíe y el cliente reciba lo mismo dos veces.
  if (eGuardar) console.error("DM: se envió pero no se pudo guardar", eGuardar.message);

  return NextResponse.json({ ok: true, id_mensaje: envio.id_mensaje, guardado: !eGuardar });
}
