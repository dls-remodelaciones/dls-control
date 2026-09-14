import { coincide } from "@/lib/busqueda";

/**
 * Qué leads se ven en pantalla según la pestaña, el filtro y la búsqueda.
 *
 * Vive en `lib` y no en la pantalla porque decide qué ve Daniel y qué no: un
 * error acá esconde un cliente sin que nada falle a la vista, que es la forma
 * más cara de romperse en este proyecto.
 *
 * Sin memoizar a propósito: son filtros sobre 1.000 elementos como mucho, y un
 * `useMemo` en el componente impedía que el compilador de React optimizara la
 * pantalla entera ("existing memoization could not be preserved").
 */

export type Tab = "hoy" | "bandeja" | "pipeline";

/** Lo mínimo que esta función necesita saber de un lead. */
export interface LeadVisible {
  id: string;
  estado: string;
  clasificacion: string;
}

export function leadsVisibles<T extends LeadVisible>(o: {
  filas: T[];
  tab: Tab;
  filtro: string | null;
  busqueda: string;
  /** Los A aptos para llamar y todavía en contacto inicial. */
  listaA: T[];
  sinResponder: Map<string, string>;
  paraHoy: T[];
}): T[] {
  let v = o.filas;
  // En "Hoy" no se repiten arriba y abajo: si está esperando respuesta o tiene
  // un recordatorio para hoy, ya aparece en su propia sección.
  if (o.tab === "hoy") {
    v = o.listaA.filter((f) => !o.sinResponder.has(f.id) && !o.paraHoy.some((p) => p.id === f.id));
  }
  if (o.tab === "pipeline") v = o.filas.filter((f) => f.estado !== "contacto_inicial");
  if (o.filtro) v = v.filter((f) => f.clasificacion === o.filtro);
  if (o.tab === "bandeja" && o.busqueda.trim()) {
    v = v.filter((f) => coincide(f as unknown as Record<string, unknown>, o.busqueda));
  }
  return v;
}
