/**
 * Las etapas del pipeline y cómo se agrupan los leads en ellas.
 *
 * El pipeline mostraba todas las etapas revueltas en una sola lista ordenada
 * por puntaje, con un renglón de conteos arriba. Así no se podía ver lo único
 * que un pipeline sirve para ver: en qué parte del camino se está quedando la
 * gente. Un presupuesto enviado hace tres semanas sin respuesta y una visita
 * agendada para mañana aparecían mezclados.
 *
 * El orden de las etapas es el del negocio, no el alfabético ni el de puntaje:
 * es el camino que recorre un cliente. "Cerrado" y "No prosperó" van al final
 * porque ya salieron del camino.
 */

export interface Etapa {
  /** El valor de la columna `estado` en la base. */
  clave: string;
  nombre: string;
  /** Lo que hay que hacer para que avance, en una línea. */
  pendiente: string;
  color: string;
  /** Si sigue en juego. Las cerradas no piden acción. */
  viva: boolean;
}

export const ETAPAS: Etapa[] = [
  {
    clave: "contacto_inicial",
    nombre: "Contacto inicial",
    pendiente: "Falta llamar o responder",
    color: "var(--color-a)",
    viva: true,
  },
  {
    clave: "cotizador_web",
    nombre: "Cotizó",
    pendiente: "Dejó sus datos: falta contactarlo",
    color: "var(--color-a)",
    viva: true,
  },
  {
    clave: "visita_terreno",
    nombre: "Visita",
    pendiente: "Falta ir a terreno o cerrar la fecha",
    color: "var(--color-b)",
    viva: true,
  },
  {
    clave: "presupuesto_enviado",
    nombre: "Presupuesto",
    pendiente: "Enviado: falta la respuesta",
    color: "var(--color-b)",
    viva: true,
  },
  { clave: "cerrado", nombre: "Cerrado", pendiente: "Ganado", color: "var(--color-ok)", viva: false },
  { clave: "no_prospero", nombre: "No prosperó", pendiente: "Cerrado sin venta", color: "var(--color-c)", viva: false },
];

export interface GrupoEtapa<T> {
  etapa: Etapa;
  leads: T[];
}

/** Lo mínimo que se necesita saber de un lead para ubicarlo en el pipeline. */
export interface LeadEnEtapa {
  estado: string;
  creado?: string;
}

/**
 * Reparte los leads por etapa, en el orden del negocio.
 *
 * Las etapas vacías no se devuelven —una sección con cero adentro es ruido—,
 * pero un estado que no está en la lista SÍ aparece, en su propio grupo al
 * final: si mañana alguien agrega un estado en la base y nadie tocó este
 * archivo, esos leads tienen que verse igual y no desaparecer de la pantalla.
 */
export function agruparPorEtapa<T extends LeadEnEtapa>(filas: T[]): GrupoEtapa<T>[] {
  const porClave = new Map<string, T[]>();
  for (const f of filas) {
    const clave = String(f.estado ?? "").trim();
    const lista = porClave.get(clave);
    if (lista) lista.push(f);
    else porClave.set(clave, [f]);
  }

  const orden = (a: T, b: T) => Date.parse(b.creado ?? "") - Date.parse(a.creado ?? "") || 0;

  const grupos: GrupoEtapa<T>[] = [];
  for (const etapa of ETAPAS) {
    const leads = porClave.get(etapa.clave);
    if (leads?.length) {
      grupos.push({ etapa, leads: [...leads].sort(orden) });
      porClave.delete(etapa.clave);
    }
  }
  // Lo que quedó: estados que esta lista no conoce.
  for (const [clave, leads] of porClave) {
    grupos.push({
      etapa: {
        clave,
        nombre: clave || "Sin etapa",
        pendiente: "Estado sin clasificar",
        color: "var(--color-c)",
        viva: true,
      },
      leads: [...leads].sort(orden),
    });
  }
  return grupos;
}
