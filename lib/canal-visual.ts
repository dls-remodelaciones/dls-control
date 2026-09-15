/**
 * De dónde te están hablando, en un golpe de vista.
 *
 * El panel guardaba el canal de cada lead desde el primer día, pero no lo
 * mostraba en ninguna parte: todas las tarjetas se veían idénticas y había que
 * abrir la ficha para saber si esa persona escribió por WhatsApp, por Instagram
 * o si llenó el formulario del sitio. Con cinco canales entrando al mismo
 * buzón, eso convierte la lista en un muro plano.
 *
 * Acá vive el nombre, el color y la forma del ícono de cada canal. Es una
 * función pura y sin React a propósito: así se puede probar, y el componente
 * que dibuja (`app/canal.tsx`) solo traduce esto a SVG.
 *
 * Los colores son los de marca de cada red, bajados de saturación para que
 * convivan con la paleta cálida del panel sin gritar. El reconocimiento manda:
 * verde es WhatsApp, magenta es Instagram, azul es Messenger. Cambiarlos por
 * colores "más bonitos" rompería justamente lo que se busca — que se distinga
 * sin leer.
 *
 * **Todos están medidos contra los dos fondos del panel** (la tarjeta `#fbf9f5`
 * y el fondo `#efeae1`) y llegan al 4.5 que exige el texto chico. El verde de
 * WhatsApp quedaba en 4.17 y hubo que oscurecerlo: el nombre del canal se lee a
 * 11 px, muchas veces en el celular y a veces al sol. Si se cambia alguno, hay
 * que volver a medirlo, no elegirlo a ojo.
 */

/** Qué dibuja `app/canal.tsx`. Una forma por familia, no una por canal. */
export type Forma = "whatsapp" | "instagram" | "messenger" | "correo" | "cotizador" | "chatbot" | "formulario" | "mano";

export interface CanalVisual {
  /** Como lo llama Daniel, no como se llama la columna. */
  nombre: string;
  color: string;
  forma: Forma;
  /**
   * Si la persona llegó escribiendo (y entonces espera respuesta) o si llegó
   * por un formulario que se llena solo. Cambia qué tan fuerte se muestra.
   */
  conversacion: boolean;
}

const CANALES: Record<string, CanalVisual> = {
  whatsapp: { nombre: "WhatsApp", color: "#15703e", forma: "whatsapp", conversacion: true },
  instagram: { nombre: "Instagram", color: "#b8336a", forma: "instagram", conversacion: true },
  facebook: { nombre: "Messenger", color: "#1b63b3", forma: "messenger", conversacion: true },
  correo: { nombre: "Correo", color: "#6d5e48", forma: "correo", conversacion: true },
  cotizador: { nombre: "Cotizador", color: "#4a6b80", forma: "cotizador", conversacion: false },
  chatbot: { nombre: "Chatbot", color: "#526574", forma: "chatbot", conversacion: false },
  web: { nombre: "Formulario", color: "#625f58", forma: "formulario", conversacion: false },
  manual: { nombre: "Anotado a mano", color: "#625f58", forma: "mano", conversacion: false },
};

/**
 * Lo que se muestra para un canal desconocido.
 *
 * No devuelve null a propósito: si mañana entra un canal nuevo y nadie tocó
 * esta tabla, la tarjeta igual muestra de dónde vino en vez de quedar muda.
 * Regla de la casa: nada se pierde, ni un lead ni el dato de su origen.
 */
function otro(canal: string): CanalVisual {
  return { nombre: canal || "Origen desconocido", color: "#625f58", forma: "formulario", conversacion: false };
}

export function canalVisual(canal: string | null | undefined): CanalVisual {
  const clave = String(canal ?? "").trim().toLowerCase();
  return CANALES[clave] ?? otro(clave);
}
