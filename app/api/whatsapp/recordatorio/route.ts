import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { avisar } from "@/lib/avisos";
import { quienLlama } from "@/lib/cron";
import { registrarLatido } from "@/lib/latidos";
import { porVencer, accionesProximas, type AccionConFecha, type MensajeWA } from "@/lib/recordatorio";
import { VENTANA_HORAS } from "@/lib/whatsapp";
import { separarAdjunto } from "@/lib/adjuntos";

/**
 * Cada hora (cron en `vercel.json`): avisa por los recordatorios de la ficha que
 * caen en la hora siguiente, y por cada WhatsApp sin
 * responder al que le quedan menos de 3 horas de ventana. La regla vive en
 * `lib/recordatorio.ts`. Acceso: el cron o Daniel con sesión (`lib/cron.ts`);
 * Daniel mirando no dispara avisos.
 */
export async function GET(req: NextRequest) {
  const { cron, sesion } = await quienLlama(req);
  if (!cron && !sesion) return NextResponse.json({ ok: false, error: "sin_sesion" }, { status: 401 });

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, error: "sin_base_de_datos" }, { status: 500 });
  // Latido: la revisión diaria vigila que esta tarea siga corriendo (lib/latidos.ts).
  if (cron) await registrarLatido(db, "recordatorio");

  // Basta con los mensajes de la ventana: una respuesta posterior al último
  // mensaje de la persona también cae dentro de estas 24 horas.
  const desde = new Date(Date.now() - VENTANA_HORAS * 3_600_000).toISOString();
  const { data, error } = await db
    .from("mensajes")
    .select("lead_id, direccion, cuerpo, creado")
    .eq("canal", "whatsapp")
    .gte("creado", desde)
    .limit(2000);
  if (error) return NextResponse.json({ ok: false, error: "consulta", detalle: error.message }, { status: 500 });

  // Un chat marcado como atendido cuenta como respondido en ese momento.
  const { data: atendidos } = await db
    .from("actividad")
    .select("lead_id, creado")
    .eq("tipo", "wa_atendido")
    .gte("creado", desde)
    .limit(2000);
  const lista = porVencer([
    ...((data ?? []) as MensajeWA[]),
    ...((atendidos ?? []) as { lead_id: string; creado: string }[]).map((a) => ({
      lead_id: a.lead_id,
      direccion: "saliente",
      cuerpo: null,
      creado: a.creado,
    })),
  ]);

  // Recordatorios que Daniel se puso en la ficha y caen en la hora siguiente.
  const ahora = Date.now();
  const { data: conFecha } = await db
    .from("leads")
    .select("id, nombre, proxima_accion, fecha_proxima_accion")
    .gt("fecha_proxima_accion", new Date(ahora).toISOString())
    .lte("fecha_proxima_accion", new Date(ahora + 3_600_000).toISOString())
    .limit(100);
  const acciones = accionesProximas((conFecha ?? []) as AccionConFecha[], ahora);

  let enviados = 0;
  if (cron) {
    for (const a of acciones) {
      const hora = new Date(a.fecha_proxima_accion!).toLocaleTimeString("es-CL", {
        timeZone: "America/Santiago",
        hour: "2-digit",
        minute: "2-digit",
      });
      const r = await avisar({
        titulo: `A las ${hora}: ${a.nombre || "un lead"}`,
        cuerpo: a.proxima_accion || "Tienes una próxima acción anotada para este lead.",
        url: `/?lead=${a.id}`,
        tag: `accion-${a.id}`,
      });
      enviados += r.enviados;
    }
  }

  if (!lista.length) {
    return NextResponse.json({ ok: true, por_vencer: 0, acciones: acciones.length, avisos_enviados: enviados });
  }

  const { data: leads } = await db
    .from("leads")
    .select("id, nombre, telefono")
    .in("id", lista.map((l) => l.lead_id));
  const nombreDe = new Map((leads ?? []).map((l) => [l.id as string, (l.nombre as string) || `+${l.telefono}`]));

  if (cron) {
    for (const l of lista) {
      const r = await avisar({
        titulo: `Quedan ${Math.floor(l.horas_restantes)} h para responderle a ${nombreDe.get(l.lead_id) ?? "un cliente"}`,
        cuerpo: `Escribió: "${separarAdjunto(l.cuerpo).texto.slice(0, 120)}". Después solo podrás mandarle plantillas.`,
        url: `/?lead=${l.lead_id}`,
        // Mismo tag que el aviso del mensaje: reemplaza al original en vez de sumar otro.
        tag: `wa-${l.lead_id}`,
      });
      enviados += r.enviados;
    }
  }
  return NextResponse.json({
    ok: true,
    por_vencer: lista.length,
    acciones: acciones.length,
    leads: lista.map((l) => ({ nombre: nombreDe.get(l.lead_id) ?? "", horas_restantes: l.horas_restantes })),
    avisos_enviados: enviados,
  });
}
