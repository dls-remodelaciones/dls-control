import { NextRequest, NextResponse } from "next/server";
import { revisarSalud } from "@/lib/salud";
import { avisar } from "@/lib/avisos";
import { usuarioDeLaPeticion } from "@/lib/sesion";

/**
 * Revisión diaria del circuito de leads (cron de Vercel, ver `vercel.json`).
 *
 * Si todo está bien, no molesta: no manda ningún aviso. Si algo falló, avisa al
 * celular con lo primero que hay que arreglar.
 *
 * Acceso:
 *   - Vercel Cron manda `Authorization: Bearer <CRON_SECRET>` cuando esa variable
 *     existe en el proyecto; en ese caso se exige.
 *   - Daniel con su sesión del panel puede abrirla para ver el detalle.
 *   - Sin CRON_SECRET se reconoce al cron por su user-agent. Eso se puede imitar,
 *     y es aceptable: la ruta no escribe nada ni devuelve valores secretos, y lo
 *     peor que provoca un tercero es repetir un aviso de falla que ya existe
 *     (mismo tag, se reemplaza). Si algún día molesta, se agrega CRON_SECRET.
 */
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secreto = (process.env.CRON_SECRET ?? "").trim();
  const auth = req.headers.get("authorization") ?? "";
  const esCron = !!secreto && auth === `Bearer ${secreto}`;

  const conSesion = !esCron && (await usuarioDeLaPeticion(req)).ok;
  if (secreto && !esCron && !conSesion) {
    return NextResponse.json({ ok: false, error: "sin_sesion" }, { status: 401 });
  }
  const pareceCron = esCron || (req.headers.get("user-agent") ?? "").startsWith("vercel-cron");
  if (!pareceCron && !conSesion) {
    return NextResponse.json({ ok: false, error: "sin_sesion" }, { status: 401 });
  }

  const chequeos = await revisarSalud();
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

  return NextResponse.json({ ok: fallas.length === 0, chequeos, aviso, revisado: new Date().toISOString() });
}
