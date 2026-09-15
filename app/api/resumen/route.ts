import { NextRequest, NextResponse } from "next/server";
import { TIPO_DESMARCA, TIPO_MARCA, leadsDePrueba, sinPruebas } from "@/lib/prueba";
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

  // telefono y email: para contar los que entraron por DM y no dejaron cómo
  // contactarlos (lib/resumen.ts).
  // `id` va en el select para poder descartar los leads marcados como prueba:
  // sin eso, el resumen de los lunes cuenta pruebas del sistema como negocio.
  const campos = "id, canal, clasificacion, estado, apto_para_llamar, creado, telefono, email";
  const [recientes, pendientes, ediciones, perdidos, chats, marcas] = await Promise.all([
    db.from("leads").select(campos).gte("creado", hace14).limit(5000),
    db.from("leads").select(campos).eq("clasificacion", "A").eq("estado", "contacto_inicial").limit(5000),
    db.from("actividad").select("antes, despues").eq("tipo", "edicion").gte("creado", hace7).limit(5000),
    db.from("leads").select("motivo_no_prospero").eq("estado", "no_prospero").gte("ultima_actividad", hace7).limit(5000),
    db.from("mensajes").select("lead_id, direccion, creado").eq("canal", "whatsapp").gte("creado", hace7).limit(10000),
    db
      .from("actividad")
      .select("lead_id, tipo, creado")
      .in("tipo", [TIPO_MARCA, TIPO_DESMARCA])
      .order("creado", { ascending: false })
      .limit(1000),
  ]);
  if (recientes.error || pendientes.error) {
    return NextResponse.json(
      { ok: false, error: "consulta", detalle: recientes.error?.message ?? pendientes.error?.message },
      { status: 500 },
    );
  }

  const dePrueba = leadsDePrueba((marcas.data ?? []) as { lead_id: string; tipo: string; creado: string }[]);
  const conId = (recientes.data ?? []) as (FilaLead & { id: string })[];
  const filas = sinPruebas(conId, dePrueba);
  const semana = filas.filter((l) => l.creado >= hace7);
  const anterior = filas.filter((l) => l.creado < hace7);
  const r = resumirSemana(
    semana,
    anterior,
    contarPendientesA(sinPruebas((pendientes.data ?? []) as (FilaLead & { id: string })[], dePrueba)),
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
