import { ETAPAS } from "@/lib/etapas";

/**
 * Cuánto lleva un lead sin que nadie lo mueva.
 *
 * El panel decía cuándo entró cada cliente, pero no cuánto llevaba quieto, y no
 * es lo mismo: un lead que entró hace tres meses y se movió ayer está vivo, y
 * uno que entró hace diez días y nadie tocó desde entonces se está enfriando.
 * En el pipeline los dos se veían igual, que es justo lo que un pipeline no
 * debería permitir.
 *
 * `ultima_actividad` no distingue entre "lo llamé" y "le corregí la comuna":
 * cualquier edición la actualiza. Así que esto mide **atención**, no avance — y
 * eso es suficiente para lo que se usa, que es notar al que nadie mira. Decir
 * que mide algo más fino sería mentir.
 */

/** Días que puede estar quieto un lead antes de que valga la pena decirlo. */
export const DIAS_QUIETO = 3;

const DIA = 86_400_000;

/** Los estados que siguen en juego. Un lead cerrado no está "quieto": terminó. */
const VIVAS = new Set(ETAPAS.filter((e) => e.viva).map((e) => e.clave));

export interface LeadQuieto {
  estado?: string | null;
  ultima_actividad?: string | null;
  creado?: string;
}

/**
 * Días enteros sin movimiento, o null si no aplica.
 *
 * Devuelve null —y no 0— cuando el lead está cerrado, cuando no hay fecha
 * válida, o cuando lleva menos del umbral. Así la pantalla solo tiene que
 * preguntar si hay algo que decir, sin repetir la regla en cada lugar donde se
 * muestra.
 */
export function diasQuieto(lead: LeadQuieto, ahora: Date = new Date(), umbral = DIAS_QUIETO): number | null {
  if (!VIVAS.has(String(lead.estado ?? ""))) return null;

  const t = Date.parse(lead.ultima_actividad || lead.creado || "");
  if (!Number.isFinite(t)) return null;

  const dias = Math.floor((ahora.getTime() - t) / DIA);
  return dias >= umbral ? dias : null;
}

/** "sin moverse hace 4 días". Ya redactado, para no repetirlo en cada pantalla. */
export function textoQuieto(dias: number): string {
  return `sin moverse hace ${dias} ${dias === 1 ? "día" : "días"}`;
}
