/**
 * Qué se puede hacer con un lead que no dejó teléfono.
 *
 * Un DM de Instagram o de Messenger no trae teléfono ni correo: entra con
 * `sesion_id` y queda SIN CONTACTO. Hasta ahora la tarjeta de ese lead decía
 * "Sin teléfono" y ahí moría — el aviso llegaba al celular, Daniel abría el
 * panel y no había ni un botón que tocar. La conversación existe, pero en la
 * aplicación de Meta, no acá.
 *
 * Mientras no se pueda responder desde el panel (falta el identificador de
 * acceso de la página y la aprobación de `pages_messaging`), lo honesto es
 * llevarlo a donde sí puede contestar, en vez de dejarlo mirando un botón
 * muerto.
 */

export interface ComoResponder {
  /** Texto del botón, en palabras de Daniel. */
  texto: string;
  /** Adónde lleva: la bandeja de esa red. */
  href: string;
}

const BANDEJAS: Record<string, ComoResponder> = {
  instagram: { texto: "Responder en Instagram", href: "https://www.instagram.com/direct/inbox/" },
  facebook: { texto: "Responder en Messenger", href: "https://business.facebook.com/latest/inbox/all" },
};

/**
 * Cómo contestarle a alguien que escribió por una red y no dejó teléfono.
 * Devuelve null cuando no hay nada mejor que ofrecer (un formulario web
 * abandonado sin datos, por ejemplo): ahí "Sin teléfono" es la verdad.
 */
export function comoResponder(canal: string | null | undefined): ComoResponder | null {
  return BANDEJAS[String(canal ?? "").trim().toLowerCase()] ?? null;
}
