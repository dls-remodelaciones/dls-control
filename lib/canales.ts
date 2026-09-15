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

/**
 * Canales donde alguien te escribe y se queda esperando respuesta.
 *
 * Los tres tienen ventana de 24 horas en Meta y la misma urgencia: un DM de
 * Instagram sin contestar es tan caliente como un WhatsApp, y hasta ahora solo
 * WhatsApp llegaba a la sección "Te escribieron" — los demás quedaban
 * enterrados en la Bandeja hasta que alguien se acordara de mirar.
 */
export const CANALES_CONVERSACION = ["whatsapp", "instagram", "facebook"] as const;

export interface ComoResponder {
  /** Texto del botón, en palabras de Daniel. */
  texto: string;
  /** Adónde lleva: la bandeja de esa red. */
  href: string;
  /**
   * El nombre de la red, aparte del texto del botón.
   *
   * La pantalla lo sacaba del propio botón con un `replace("Responder en ", "")`,
   * que se rompía en silencio con solo reescribir el botón: la ficha terminaría
   * diciendo "abrir la conversación en Responder en Instagram" o algo peor.
   */
  nombre: string;
}

const BANDEJAS: Record<string, ComoResponder> = {
  instagram: {
    nombre: "Instagram",
    texto: "Responder en Instagram",
    href: "https://www.instagram.com/direct/inbox/",
  },
  facebook: {
    nombre: "Messenger",
    texto: "Responder en Messenger",
    href: "https://business.facebook.com/latest/inbox/all",
  },
};

/**
 * Cómo contestarle a alguien que escribió por una red y no dejó teléfono.
 * Devuelve null cuando no hay nada mejor que ofrecer (un formulario web
 * abandonado sin datos, por ejemplo): ahí "Sin teléfono" es la verdad.
 */
export function comoResponder(canal: string | null | undefined): ComoResponder | null {
  return BANDEJAS[String(canal ?? "").trim().toLowerCase()] ?? null;
}
