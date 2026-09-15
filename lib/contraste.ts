/**
 * Contraste entre dos colores, para que la paleta no se elija a ojo.
 *
 * Nació de un error propio: el ámbar de "en nutrición" (`#b8895a`) se usó para
 * textos de 11 y 12 px —"sin moverse hace 9 días", "Quedan 9,4 h"— y al medirlo
 * daba **2,3 sobre el beige** donde la norma pide 4,5. En el monitor se leía
 * bien; en el celular, que es donde Daniel usa el panel y a veces al sol, no.
 *
 * Ningún error de tipos ni prueba de comportamiento detecta eso: el panel
 * funciona perfecto con texto ilegible. La prueba que acompaña a este archivo
 * es lo único que lo impide.
 *
 * La fórmula es la de WCAG 2.1: luminancia relativa y (L1+0,05)/(L2+0,05).
 */

/** Los tres fondos sobre los que se dibuja texto en el panel. */
export const FONDOS_PANEL = {
  bg: "#efeae1",
  surface: "#fbf9f5",
  warm: "#e4dccc",
} as const;

/** Mínimo para texto de menos de 18 px, que es casi todo el panel. */
export const MINIMO_TEXTO_CHICO = 4.5;
/** Mínimo para texto grande o en negrita de 18 px o más (las cifras). */
export const MINIMO_TEXTO_GRANDE = 3;

function canal(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** Luminancia relativa de un `#rrggbb`. */
export function luminancia(hex: string): number {
  const limpio = hex.trim().replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(limpio)) throw new Error(`color inválido: ${hex}`);
  const n = parseInt(limpio, 16);
  return 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
}

/** Razón de contraste entre dos colores: de 1 (idénticos) a 21 (negro y blanco). */
export function contraste(a: string, b: string): number {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (oscuro + 0.05);
}

/** El peor caso de un color contra los tres fondos del panel. */
export function peorContraste(color: string): number {
  return Math.min(...Object.values(FONDOS_PANEL).map((f) => contraste(color, f)));
}

/** ¿Sirve para texto chico sobre cualquier fondo del panel? */
export function sirveParaTextoChico(color: string): boolean {
  return peorContraste(color) >= MINIMO_TEXTO_CHICO;
}
