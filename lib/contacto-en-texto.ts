/**
 * Teléfono y correo escritos dentro de un mensaje.
 *
 * Un DM de Instagram o Messenger no trae ningún dato de contacto: el lead entra
 * SIN CONTACTO y no se puede llamar. Pero muy seguido la persona lo escribe en
 * el propio mensaje — "hola, llámame al 9 8765 4321" — y ese dato se estaba
 * perdiendo aunque estuviera a la vista.
 *
 * Al encontrarlo, el lead deja de ser SIN CONTACTO y además se fusiona con el
 * lead que ya tuviera ese teléfono (`registrar-lead.ts` deduplica por teléfono
 * y correo), que es como un DM y un formulario de la misma persona dejan de ser
 * dos fichas separadas.
 *
 * **Acá el falso positivo es caro**: un número mal detectado significa llamar a
 * un desconocido, o peor, fusionar la ficha de dos clientes distintos. Por eso
 * solo se acepta lo que tiene forma inequívoca de móvil chileno, y ante la duda
 * se prefiere no encontrar nada.
 */

/**
 * Móvil chileno: nueve dígitos que empiezan en 9, con o sin el 56 del país.
 * Los fijos quedan fuera a propósito — son más cortos y se confunden con
 * cualquier cifra del mensaje.
 */
const MOVIL = /(?:\+?\s*56[\s.-]*)?(9)[\s.-]?(\d{4})[\s.-]?(\d{4})(?!\d)/g;

/** Lo que en una remodelación es una cifra, no un teléfono. */
const UNIDADES = /\b(m2|m²|mts?2?|metros?|uf|clp|pesos?|millones?|ambientes?|dormitorios?)\b/i;

export function telefonoEnTexto(texto: string): string {
  const s = String(texto ?? "");
  for (const m of s.matchAll(MOVIL)) {
    const numero = `9${m[2]}${m[3]}`;
    // Que no sea una cifra del proyecto: se mira lo que viene justo después.
    // "90.000.000 pesos" o "120 m2" no son teléfonos por más que calcen.
    const despues = s.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 14);
    if (UNIDADES.test(despues)) continue;
    // Un monto suele venir pegado a un signo o separado por puntos de miles.
    const antes = s.slice(Math.max(0, (m.index ?? 0) - 2), m.index ?? 0);
    if (/[$€]/.test(antes)) continue;
    return numero;
  }
  return "";
}

/** Correo escrito en el mensaje. Mucho menos ambiguo que un número. */
export function correoEnTexto(texto: string): string {
  const m = String(texto ?? "").match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  return m ? m[0].toLowerCase() : "";
}
