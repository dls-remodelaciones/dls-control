import { NextRequest, NextResponse } from "next/server";
import { revisarSalud } from "@/lib/salud";
import { avisar } from "@/lib/avisos";
import { quienLlama } from "@/lib/cron";

/**
 * Revisión diaria del circuito de leads (cron de Vercel, ver `vercel.json`).
 *
 * Si todo está bien, no molesta: no manda ningún aviso. Si algo falló, avisa al
 * celular con lo primero que hay que arreglar.
 *
 * Acceso: el cron o Daniel con sesión (ver `lib/cron.ts`).
 */
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const { cron: pareceCron, sesion: conSesion } = await quienLlama(req);
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
