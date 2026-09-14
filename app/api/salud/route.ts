import { NextRequest, NextResponse } from "next/server";
import { revisarSalud } from "@/lib/salud";
import { avisar } from "@/lib/avisos";
import { quienLlama } from "@/lib/cron";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { cambioDeNombre, type EstadoNombre } from "@/lib/novedades";

/**
 * Revisión diaria del circuito de leads (cron de Vercel, ver `vercel.json`).
 *
 * Si todo está bien, no molesta: no manda ningún aviso. Si algo falló, avisa al
 * celular con lo primero que hay que arreglar. Aparte, si Meta cambió el estado
 * del nombre de WhatsApp (aprobado, rechazado), también avisa.
 *
 * Acceso: el cron o Daniel con sesión (ver `lib/cron.ts`).
 */
export const maxDuration = 60;

const CLAVE_NOMBRE = "meta_nombre";

export async function GET(req: NextRequest) {
  const { cron: pareceCron, sesion: conSesion } = await quienLlama(req);
  if (!pareceCron && !conSesion) {
    return NextResponse.json({ ok: false, error: "sin_sesion" }, { status: 401 });
  }

  const { chequeos, nombreMeta } = await revisarSalud();
  const fallas = chequeos.filter((c) => !c.ok);

  // Solo avisa la corrida programada (o Daniel pidiendo ?avisar=1): abrir la
  // ruta para mirar el detalle no debería mandar un aviso cada vez.
  const debeAvisar = pareceCron || (conSesion && req.nextUrl.searchParams.get("avisar") === "1");
  let aviso: Awaited<ReturnType<typeof avisar>> | null = null;
  if (fallas.length && debeAvisar) {
    aviso = await avisar({
      titulo: fallas.length === 1 ? `Falla en DLS Control: ${fallas[0].nombre}` : `${fallas.length} fallas en DLS Control`,
      cuerpo: fallas.map((f) => f.detalle).join(" "),
      url: "/",
      tag: "salud",
    });
  }
  if (fallas.length) console.error("Salud:", JSON.stringify(fallas));

  // Nombre de WhatsApp: se compara con lo que se vio la vez anterior. Solo la
  // corrida programada guarda y avisa, para que mirar la ruta no "gaste" la novedad.
  let novedadNombre: { titulo: string; cuerpo: string } | null = null;
  const db = supabaseAdmin();
  if (nombreMeta && db && debeAvisar) {
    const { data } = await db.from("config").select("valor").eq("clave", CLAVE_NOMBRE).maybeSingle();
    novedadNombre = cambioDeNombre((data?.valor as EstadoNombre | undefined) ?? null, nombreMeta);
    await db
      .from("config")
      .upsert({ clave: CLAVE_NOMBRE, valor: nombreMeta, actualizado: new Date().toISOString() }, { onConflict: "clave" });
    if (novedadNombre) await avisar({ ...novedadNombre, url: "/", tag: "meta-nombre" });
  }

  return NextResponse.json({
    ok: fallas.length === 0,
    chequeos,
    nombre_whatsapp: nombreMeta,
    novedad_nombre: novedadNombre,
    aviso,
    revisado: new Date().toISOString(),
  });
}
