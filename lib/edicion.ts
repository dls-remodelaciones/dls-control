import { emailValido, normalizarTelefono } from "@/lib/negocio";

/**
 * Reglas de la edición manual de la ficha (`app/api/leads/actualizar`).
 * Viven acá y no en la ruta para poder probarlas sin levantar el servidor.
 */

/**
 * Teléfono o correo que vinieron escritos pero no son válidos.
 *
 * Antes se guardaban como vacío: un dígito de menos en la ficha borraba en
 * silencio el teléfono con que se llamaba al cliente. Dejar el campo en blanco
 * a propósito sigue borrando; lo que se rechaza es lo escrito mal.
 */
export function datoInvalido(
  body: Record<string, unknown>,
  tiene: (k: string) => boolean,
): { error: string; detalle: string } | null {
  const escrito = (k: string) => String(body[k] ?? "").trim();
  if (tiene("telefono") && escrito("telefono") && !normalizarTelefono(body.telefono)) {
    return {
      error: "telefono_invalido",
      detalle: `El teléfono "${escrito("telefono")}" no parece un celular o fijo de Chile. Revísalo o déjalo en blanco.`,
    };
  }
  if (tiene("email") && escrito("email") && !emailValido(body.email)) {
    return {
      error: "correo_invalido",
      detalle: `El correo "${escrito("email")}" no es válido. Revísalo o déjalo en blanco.`,
    };
  }
  return null;
}

/** Campos de la ficha que se registran en el historial cuando cambian. */
export const CAMPOS_HISTORIAL: Record<string, string> = {
  nombre: "nombre",
  telefono: "teléfono",
  email: "correo",
  tipo_proyecto: "proyecto",
  comuna: "comuna",
  superficie_m2: "superficie",
  rango_presupuesto: "presupuesto",
  plazo: "plazo",
  propiedad: "propiedad",
  motivo_no_prospero: "motivo",
  proxima_accion: "próxima acción",
  fecha_proxima_accion: "recordatorio",
  nota_interna: "nota",
};

/**
 * Qué datos cambiaron entre la ficha guardada y la editada, para el historial.
 * Números y textos se comparan como texto ("40" y 40 son lo mismo) y vacío,
 * null y undefined cuentan igual: si no, guardar sin tocar nada anotaría cambios.
 */
export function camposCambiados(
  previo: Record<string, unknown>,
  nuevo: Record<string, unknown>,
): { antes: Record<string, unknown>; despues: Record<string, unknown> } {
  // La base devuelve las fechas como "…+00:00" y la ficha las manda como "….000Z".
  const norm = (k: string, v: unknown) =>
    v == null || v === "" ? "" : k === "fecha_proxima_accion" ? String(Date.parse(String(v))) : String(v).trim();
  const antes: Record<string, unknown> = {};
  const despues: Record<string, unknown> = {};
  for (const k of Object.keys(CAMPOS_HISTORIAL)) {
    if (norm(k, previo[k]) === norm(k, nuevo[k])) continue;
    // Las notas pueden ser largas: basta con saber que cambió.
    antes[k] = k === "nota_interna" ? null : previo[k] ?? null;
    despues[k] = k === "nota_interna" ? null : nuevo[k] ?? null;
  }
  return { antes, despues };
}
