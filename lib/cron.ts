import { NextRequest } from "next/server";
import { usuarioDeLaPeticion } from "@/lib/sesion";

/**
 * Quién llama a una ruta programada (`vercel.json` → crons).
 *
 *   - Vercel Cron manda `Authorization: Bearer <CRON_SECRET>` cuando esa variable
 *     existe en el proyecto; en ese caso se exige.
 *   - Sin CRON_SECRET se reconoce al cron por su user-agent. Eso se puede imitar,
 *     y es aceptable para rutas que no escriben datos ni devuelven secretos: lo
 *     peor que provoca un tercero es repetir un aviso que ya existe (mismo tag,
 *     se reemplaza en el celular). Si algún día molesta, se agrega CRON_SECRET.
 *   - Daniel con su sesión del panel también puede abrirlas, para mirar.
 */
export async function quienLlama(
  req: NextRequest,
): Promise<{ cron: boolean; sesion: boolean }> {
  const secreto = (process.env.CRON_SECRET ?? "").trim();
  const auth = req.headers.get("authorization") ?? "";
  if (secreto && auth === `Bearer ${secreto}`) return { cron: true, sesion: false };

  const sesion = (await usuarioDeLaPeticion(req)).ok;
  const agente = (req.headers.get("user-agent") ?? "").startsWith("vercel-cron");
  return { cron: !secreto && agente, sesion };
}
