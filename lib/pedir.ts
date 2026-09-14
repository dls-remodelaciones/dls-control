/**
 * `fetch` + JSON para las pantallas del panel, que nunca lanza.
 *
 * Antes cada botón hacía `await fetch(...)` y `await r.json()` a pelo: sin señal
 * (una obra, un ascensor) el `fetch` lanzaba, nadie lo atrapaba y el botón se
 * quedaba para siempre en "Guardando…" o "Enviando…", sin decir qué pasó. Lo
 * mismo si Vercel respondía una página de error en vez de JSON.
 *
 * Siempre devuelve un objeto con `ok`; si falla, trae `error` y `detalle` en
 * palabras, igual que las respuestas de las rutas del panel.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- cada ruta responde su propia forma
export type Respuesta = { ok: boolean; error?: string; detalle?: string; [k: string]: any };

export async function pedirJson(url: string, init?: RequestInit): Promise<Respuesta> {
  let r: Response;
  try {
    r = await fetch(url, init);
  } catch {
    return {
      ok: false,
      error: "sin_conexion",
      detalle: "No hay conexión con el panel. Revisa la señal e inténtalo de nuevo: no se guardó ni se envió nada.",
    };
  }
  try {
    const j = (await r.json()) as Respuesta;
    return typeof j === "object" && j !== null && "ok" in j ? j : { ok: false, error: "respuesta_rara", detalle: `El servidor respondió ${r.status} sin datos.` };
  } catch {
    return { ok: false, error: "respuesta_rara", detalle: `El servidor respondió ${r.status} y no se entendió la respuesta. Inténtalo de nuevo en un momento.` };
  }
}
