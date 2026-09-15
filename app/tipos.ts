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

export const CLASE_COLOR: Record<Clase, string> = {
  A: "var(--color-a)",
  B: "var(--color-b)",
  C: "var(--color-c)",
  D: "var(--color-line)",
};
