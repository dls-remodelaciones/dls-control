/**
 * Leads que son pruebas del sistema y no clientes.
 *
 * Nace de un problema concreto: los leads a nombre de "Daniel De Los Santos" y
 * "Tamara Mednik" son pruebas, pero el sistema los trata como clientes. El
 * aviso de las 8:00 insiste cada mañana con que hay "leads A sin llamar", el
 * resumen de los lunes los cuenta como negocio, y las tres cifras de arriba del
 * panel los suman. Peor: un lead de prueba con 87 puntos tapa a un cliente real
 * de 60, porque la lista va ordenada por puntaje.
 *
 * **La marca es explícita, nunca por nombre.** Detectar "prueba" o "test" en el
 * nombre parece práctico y es una trampa: el día que escriba una clienta que se
 * apellide Testa, su lead desaparece de la vista sin que nada falle. Es la misma
 * razón por la que la migración 003 borra leads de prueba uno por uno en vez de
 * usar `like '%test%'`.
 *
 * Se guarda en la tabla `actividad`, igual que "marcar como atendido": sin
 * migración, reversible, y con el registro de cuándo se marcó. La marca más
 * reciente gana, así que desmarcar es solo marcar de nuevo al revés.
 */

export const TIPO_MARCA = "marcado_prueba";
export const TIPO_DESMARCA = "desmarcado_prueba";

/** Lo mínimo que se necesita de una fila de actividad. */
export interface MarcaPrueba {
  lead_id: string;
  tipo: string;
  creado: string;
}

/**
 * Los leads marcados como prueba, según el historial de actividad.
 *
 * `actividad` puede venir en cualquier orden: se compara por fecha y no por
 * posición. Si dos marcas opuestas tienen exactamente la misma fecha —algo que
 * solo pasa con datos raros— gana "no es prueba", porque esconder un lead es el
 * error caro y mostrarlo de más no cuesta nada.
 */
export function leadsDePrueba(actividad: MarcaPrueba[]): Set<string> {
  const ultima = new Map<string, { tipo: string; t: number }>();

  for (const a of actividad) {
    if (a.tipo !== TIPO_MARCA && a.tipo !== TIPO_DESMARCA) continue;
    if (!a.lead_id) continue;
    const t = Date.parse(a.creado ?? "");
    if (!Number.isFinite(t)) continue;

    const previa = ultima.get(a.lead_id);
    if (!previa || t > previa.t) {
      ultima.set(a.lead_id, { tipo: a.tipo, t });
    } else if (t === previa.t && a.tipo === TIPO_DESMARCA) {
      // Empate: se queda con la que NO esconde el lead.
      ultima.set(a.lead_id, { tipo: a.tipo, t });
    }
  }

  const marcados = new Set<string>();
  for (const [id, m] of ultima) if (m.tipo === TIPO_MARCA) marcados.add(id);
  return marcados;
}

/** Quita los leads de prueba de una lista, sin tocar el orden de los demás. */
export function sinPruebas<T extends { id: string }>(filas: T[], dePrueba: Set<string>): T[] {
  return dePrueba.size === 0 ? filas : filas.filter((f) => !dePrueba.has(f.id));
}
