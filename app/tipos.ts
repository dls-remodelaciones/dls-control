import type { Clase, Lead, Senal } from "@/lib/negocio";

/** Tipos y constantes que comparten la pantalla de inicio y sus piezas. */

export type Proyecto = {
  tipo: string;
  comuna: string;
  m2: number;
  presupuesto: string;
  tier: string;
  fecha: string;
};

export type Fila = Lead & {
  id: string;
  clasificacion: Clase;
  score: number;
  apto_para_llamar: boolean;
  estado: string;
  creado: string;
  proyectos?: Proyecto[];
  desglose?: Senal[];
  proxima_accion?: string | null;
  fecha_proxima_accion?: string | null;
  /**
   * Última vez que alguien tocó este lead: un mensaje, una llamada registrada o
   * una edición de la ficha. La usa `lib/quieto.ts` para decir cuánto lleva sin
   * moverse, que es distinto de cuándo entró.
   */
  ultima_actividad?: string | null;
};

export type { Tab } from "@/lib/visibles";

/**
 * El color de cada clase para BORDES y fondos: el borde izquierdo de la tarjeta.
 *
 * Son los tonos de la marca y acá funcionan, porque un borde no se lee.
 */
export const CLASE_COLOR: Record<Clase, string> = {
  A: "var(--color-a)",
  B: "var(--color-b)",
  C: "var(--color-c)",
  D: "var(--color-line)",
};

/**
 * El color de cada clase para TEXTO: el "B 58" de la esquina, en 12 px.
 *
 * Existe aparte porque el ámbar y el gris de marca dan 2,3 y 2,6 de contraste
 * donde el texto chico necesita 4,5 — se leían en el monitor y no en el
 * celular. El mismo mapa servía para el borde y para el puntaje, así que
 * oscurecer uno arruinaba el otro. Ver `lib/contraste.ts`.
 */
export const CLASE_COLOR_TEXTO: Record<Clase, string> = {
  A: "var(--color-a)",
  B: "var(--color-b-texto)",
  C: "var(--color-c-texto)",
  D: "var(--color-muted)",
};
