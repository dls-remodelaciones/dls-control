/**
 * Errores de JavaScript que les ocurren a los visitantes del sitio.
 *
 * Si el cotizador se rompe en el Safari de algún iPhone, nadie ve el error:
 * el cliente simplemente no puede cotizar y se va. El sitio reporta sus propios
 * errores al panel (solo los de sus archivos, no los de extensiones del
 * navegador) y la revisión diaria avisa si se repiten.
 *
 * Se guardan en `config`, clave `errores_sitio`: los últimos 50, sin datos
 * personales — mensaje, archivo, línea y navegador.
 */

export const CLAVE = "errores_sitio";
const MAX = 50;
/** Errores en 24 h a partir de los cuales la revisión diaria avisa. */
export const UMBRAL_24H = 3;

export interface ErrorSitio {
  mensaje: string;
  fuente: string;
  linea: number;
  navegador: string;
  cuando: string;
}

/** Limpia lo que manda el navegador: nada de largos infinitos ni datos raros. */
export function normalizar(e: Record<string, unknown>, ahora: Date): ErrorSitio | null {
  const mensaje = String(e.mensaje ?? "").trim().slice(0, 300);
  if (!mensaje) return null;
  // "Script error." sin detalle viene de scripts de otros dominios: no dice nada útil.
  if (/^script error\.?$/i.test(mensaje)) return null;
  return {
    mensaje,
    fuente: String(e.fuente ?? "").slice(0, 200),
    linea: Math.max(0, Math.floor(Number(e.linea) || 0)),
    navegador: String(e.navegador ?? "").slice(0, 160),
    cuando: ahora.toISOString(),
  };
}

export function agregar(previos: ErrorSitio[] | null | undefined, nuevo: ErrorSitio): ErrorSitio[] {
  return [...(previos ?? []), nuevo].slice(-MAX);
}

/** Cuántos hubo en las últimas 24 h y cuál se repite más. */
export function resumen(items: ErrorSitio[], ahora: Date): { cantidad: number; masComun: string | null; veces: number } {
  const desde = ahora.getTime() - 86_400_000;
  const recientes = items.filter((e) => Date.parse(e.cuando) >= desde);
  const conteo = new Map<string, number>();
  for (const e of recientes) {
    const k = `${e.mensaje} (${e.fuente.split("/").pop() || "?"}:${e.linea})`;
    conteo.set(k, (conteo.get(k) ?? 0) + 1);
  }
  const [masComun, veces] = [...conteo.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
  return { cantidad: recientes.length, masComun, veces };
}
