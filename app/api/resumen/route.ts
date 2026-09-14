import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { avisar } from "@/lib/avisos";
import { quienLlama } from "@/lib/cron";
import { registrarLatido } from "@/lib/latidos";
import {
  resumirSemana,
  contarPendientesA,
  avancesSemana,
  motivosSemana,
  tiempoRespuesta,
  textoTiempo,
  type CambioEstado,
  type FilaLead,
  type MensajeTiempo,
} from "@/lib/resumen";

/**
 * Resumen semanal (cron de los lunes, `vercel.json`). Avisa al celular con los
 * leads de los últimos 7 días comparados con los 7 anteriores. La lógica está en
 * `lib/resumen.ts`. Daniel con sesión puede abrirla para ver el texto sin avisar.
 */
export async function GET(req: NextRequest) {
  const { cron, sesion } = await quienLlama(req);
  if (!cron && !sesion) return NextResponse.json({ ok: false, error: "sin_sesion" }, { status: 401 });

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, error: "sin_base_de_datos" }, { status: 500 });
  // Latido: la revisión diaria vigila que esta tarea siga corriendo (lib/latidos.ts).
  if (cron) await registrarLatido(db, "resumen");

  const DIA = 86_400_000;
  const ahora = Date.now();
  const hace7 = new Date(ahora - 7 * DIA).toISOString();
  const hace14 = new Date(ahora - 14 * DIA).toISOString();

  const campos = "canal, clasificacion, estado, apto_para_llamar, creado";
  const [recientes, pendientes, ediciones, perdidos, chats] = await Promise.all([
    db.from("leads").select(campos).gte("creado", hace14).limit(5000),
    db.from("leads").select(campos).eq("clasificacion", "A").eq("estado", "contacto_inicial").limit(5000),
    db.from("actividad").select("antes, despues").eq("tipo", "edicion").gte("creado", hace7).limit(5000),
    db.from("leads").select("motivo_no_prospero").eq("estado", "no_prospero").gte("ultima_actividad", hace7).limit(5000),
    db.from("mensajes").select("lead_id, direccion, creado").eq("canal", "whatsapp").gte("creado", hace7).limit(10000),
  ]);
  if (recientes.error || pendientes.error) {
    return NextResponse.json(
      { ok: false, error: "consulta", detalle: recientes.error?.message ?? pendientes.error?.message },
      { status: 500 },
    );
  }

  const filas = (recientes.data ?? []) as FilaLead[];
  const semana = filas.filter((l) => l.creado >= hace7);
  const anterior = filas.filter((l) => l.creado < hace7);
  const r = resumirSemana(
    semana,
    anterior,
    contarPendientesA((pendientes.data ?? []) as FilaLead[]),
    avancesSemana((ediciones.data ?? []) as CambioEstado[]),
  );
  const extras = [
    motivosSemana((perdidos.data ?? []) as { motivo_no_prospero: string | null }[]),
    textoTiempo(tiempoRespuesta((chats.data ?? []) as MensajeTiempo[])),
  ].filter(Boolean);
  if (extras.length) r.cuerpo = `${r.cuerpo} ${extras.join(" ")}`;

  const aviso = cron ? await avisar({ ...r, url: "/", tag: "resumen-semanal" }) : null;
  return NextResponse.json({ ok: true, ...r, aviso });
}
