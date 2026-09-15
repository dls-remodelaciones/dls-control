import { canalVisual, type CanalVisual } from "@/lib/canal-visual";

/**
 * La bandeja partida por canal: todo lo de WhatsApp junto, todo lo de Instagram
 * junto, todo lo del sitio junto.
 *
 * Antes era una sola lista ordenada por puntaje, y con cinco canales cayendo en
 * el mismo buzón se volvía indistinguible: no se sabía de dónde venía cada uno
 * ni cuál había llegado primero. Agrupar por canal es cómo Daniel piensa el
 * trabajo — "voy a contestar los Instagram" es una tarea, "voy a contestar los
 * de puntaje 70" no lo es.
 *
 * Dos órdenes distintos, y ninguno es alfabético:
 *
 * ENTRE canales: primero el canal que tiene gente esperando respuesta, y entre
 * esos, el que tiene a alguien esperando desde más atrás — porque a ese se le
 * cierra antes la ventana de 24 horas de Meta. Después los canales sin nadie
 * esperando, por volumen.
 *
 * DENTRO de un canal: primero quienes esperan respuesta, el más antiguo arriba;
 * después el resto por orden de llegada, lo más nuevo primero. Es lo que
 * contesta la pregunta "¿cuál llegó antes?" sin tener que leer todas las fechas.
 */

/** Lo mínimo que se necesita saber de un lead para agruparlo. */
export interface LeadAgrupable {
  id: string;
  canal?: string | null;
  creado?: string;
}

export interface GrupoCanal<T> {
  /** El canal tal como viene en la base, ya normalizado. */
  clave: string;
  visual: CanalVisual;
  leads: T[];
  /** Cuántos de este canal escribieron y siguen sin respuesta. */
  esperando: number;
  /** Fecha del que lleva más rato esperando, o null si no hay ninguno. */
  masAntiguoEsperando: string | null;
}

function tiempo(iso: string | null | undefined): number {
  const t = Date.parse(String(iso ?? ""));
  return Number.isFinite(t) ? t : 0;
}

export function agruparPorCanal<T extends LeadAgrupable>(
  filas: T[],
  sinResponder: Map<string, string>,
): GrupoCanal<T>[] {
  const grupos = new Map<string, T[]>();
  for (const f of filas) {
    const clave = String(f.canal ?? "").trim().toLowerCase();
    const lista = grupos.get(clave);
    if (lista) lista.push(f);
    else grupos.set(clave, [f]);
  }

  const armados: GrupoCanal<T>[] = [];
  for (const [clave, leads] of grupos) {
    const esperas = leads.map((f) => sinResponder.get(f.id)).filter((x): x is string => Boolean(x)).map(tiempo);

    const ordenados = [...leads].sort((a, b) => {
      const ea = sinResponder.get(a.id);
      const eb = sinResponder.get(b.id);
      // Quien espera respuesta va antes que quien no, sin importar su puntaje.
      if (ea && !eb) return -1;
      if (eb && !ea) return 1;
      // Entre los que esperan: el que lleva más rato, arriba.
      if (ea && eb) return tiempo(ea) - tiempo(eb);
      // Entre los demás: lo último que entró, arriba.
      return tiempo(b.creado) - tiempo(a.creado);
    });

    armados.push({
      clave,
      visual: canalVisual(clave),
      leads: ordenados,
      esperando: esperas.length,
      masAntiguoEsperando: esperas.length ? new Date(Math.min(...esperas)).toISOString() : null,
    });
  }

  return armados.sort((a, b) => {
    // Un canal con alguien esperando manda sobre uno sin nadie, tenga el
    // segundo cien leads dormidos.
    if (a.esperando > 0 !== b.esperando > 0) return a.esperando > 0 ? -1 : 1;
    if (a.esperando > 0 && b.esperando > 0) {
      return tiempo(a.masAntiguoEsperando) - tiempo(b.masAntiguoEsperando);
    }
    if (b.leads.length !== a.leads.length) return b.leads.length - a.leads.length;
    // Desempate estable: si no, dos canales del mismo tamaño se turnan de lugar
    // en cada refresco y la pantalla parece moverse sola.
    return a.clave.localeCompare(b.clave);
  });
}
