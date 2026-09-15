/**
 * Qué secciones de canal dejó cerradas Daniel, para encontrarlas igual mañana.
 *
 * Se guarda como texto —el JSON crudo del navegador— y no como objeto a
 * propósito: así el hook que lo lee puede comparar dos lecturas con `===` y
 * saber si cambió algo. Con un objeto, cada lectura sería distinta de la
 * anterior aunque el contenido fuera idéntico, y la pantalla se repintaría en
 * un bucle sin fin.
 *
 * Todo acá aguanta basura: si alguien edita el almacenamiento del navegador a
 * mano o queda un valor viejo de otra versión, lo peor que puede pasar es que
 * las secciones aparezcan abiertas. Nunca que la pantalla no cargue.
 */

export const CLAVE_CERRADOS = "dls-control:canales-cerrados";

/** El texto guardado cuando no hay nada cerrado. */
export const VACIO = "{}";

export function leerCerrados(crudo: string | null | undefined): Record<string, boolean> {
  try {
    const v = JSON.parse(crudo || VACIO) as unknown;
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    const limpio: Record<string, boolean> = {};
    for (const [k, valor] of Object.entries(v as Record<string, unknown>)) {
      if (valor === true) limpio[k] = true;
    }
    return limpio;
  } catch {
    return {};
  }
}

export function estaCerrado(crudo: string | null | undefined, llave: string): boolean {
  return leerCerrados(crudo)[llave] === true;
}

/**
 * Abre lo cerrado y cierra lo abierto, y devuelve el texto nuevo para guardar.
 *
 * Las secciones abiertas NO se anotan: solo se guarda lo cerrado. Si se
 * guardaran las dos cosas, un canal nuevo tendría que existir en la lista para
 * verse, y el día que entre un canal que nadie previó aparecería oculto —
 * justo lo contrario de la regla de la casa, que nada se pierda de vista.
 */
export function alternarCerrado(crudo: string | null | undefined, llave: string): string {
  const actual = leerCerrados(crudo);
  if (actual[llave]) delete actual[llave];
  else actual[llave] = true;
  return JSON.stringify(actual);
}
