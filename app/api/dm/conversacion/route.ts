import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { usuarioDeLaPeticion } from "@/lib/sesion";
import { ventanaAbierta } from "@/lib/ventana";
import { leerSesion, envioConfigurado } from "@/lib/dm";

/**
 * La conversación de Instagram o Messenger de un lead, para responderla sin
 * escribir a ciegas: hasta ahora el panel ofrecía un cuadro de texto sin mostrar
 * lo que la persona había dicho, y había que ir a la aplicación de Meta a leerlo.
 *
 * La ventana de 24 horas se calcula acá, con el último mensaje entrante real, en
 * vez de deducirla en la pantalla: es el mismo dato que usa el envío.
 */

const LIMITE_MENSAJES = 50;

export async function GET(req: NextRequest) {
  const quien = await usuarioDeLaPeticion(req);
  if (!quien.ok) return NextResponse.json({ ok: false, error: quien.error }, { status: quien.status });

  const leadId = req.nextUrl.searchParams.get("lead_id")?.trim() ?? "";
  if (!leadId) return NextResponse.json({ ok: false, error: "falta_lead_id" }, { status: 400 });

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, error: "sin_base_de_datos" }, { status: 500 });

  const { data: lead, error: eLead } = await db
    .from("leads")
    .select("id, nombre, sesion_id")
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

  const { data: mensajes, error: eMsg } = await db
    .from("mensajes")
    .select("direccion, cuerpo, creado")
    .eq("lead_id", leadId)
    .in("canal", ["instagram", "facebook"])
    .order("creado", { ascending: false })
    .limit(LIMITE_MENSAJES);

  // Un error acá no puede verse como "todavía no te escribió": la pantalla
  // ofrecería responder a alguien cuya ventana quizá ya venció.
  if (eMsg) {
    return NextResponse.json({ ok: false, error: "mensajes_no_disponibles", detalle: eMsg.message }, { status: 500 });
  }

  const lista = (mensajes ?? []) as { direccion: string; cuerpo: string | null; creado: string }[];
  const ultimoEntrante = lista.find((m) => m.direccion === "entrante")?.creado ?? null;

  return NextResponse.json({
    ok: true,
    lead: { id: lead.id, nombre: lead.nombre },
    canal: destino.canal,
    configurado: envioConfigurado(destino.canal),
    ventana: ventanaAbierta(ultimoEntrante),
    // En orden de lectura: el más antiguo primero, como una conversación.
    mensajes: [...lista].reverse(),
  });
}
