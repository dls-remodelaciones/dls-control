/**
 * Lo que un mensaje de WhatsApp dice, en texto legible para el panel.
 *
 * Hasta el 14-sep-2026 todo lo que no era texto llegaba como "[image recibido
 * por WhatsApp]". Un cliente que manda su ubicación, la foto de su cocina o
 * toca un botón de una plantilla dejaba a Daniel sin saber qué había mandado.
 */

export interface MensajeEntrante {
  id?: string;
  type?: string;
  text?: { body?: string };
  image?: { id?: string; caption?: string; mime_type?: string };
  audio?: { id?: string; mime_type?: string; voice?: boolean };
  video?: { id?: string; caption?: string; mime_type?: string };
  document?: { id?: string; caption?: string; filename?: string; mime_type?: string };
  sticker?: { id?: string; mime_type?: string };
  location?: { latitude?: number; longitude?: number; name?: string; address?: string };
  contacts?: { name?: { formatted_name?: string }; phones?: { phone?: string }[] }[];
  reaction?: { emoji?: string };
  button?: { text?: string };
  interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
}

/** Tipos con archivo adjunto que vale la pena guardar. */
export const ADJUNTOS: Record<string, { etiqueta: string; ext: string }> = {
  image: { etiqueta: "foto", ext: "jpg" },
  audio: { etiqueta: "audio", ext: "ogg" },
  video: { etiqueta: "video", ext: "mp4" },
  document: { etiqueta: "documento", ext: "pdf" },
  sticker: { etiqueta: "sticker", ext: "webp" },
};

/** El id de medio de Meta, si el mensaje trae un archivo. */
export function medioDe(m: MensajeEntrante): { id: string; tipo: string; mime: string; nombre: string } | null {
  const t = m.type ?? "";
  if (!(t in ADJUNTOS)) return null;
  const obj = (m as Record<string, unknown>)[t] as { id?: string; mime_type?: string; filename?: string } | undefined;
  if (!obj?.id) return null;
  return { id: obj.id, tipo: t, mime: obj.mime_type ?? "", nombre: obj.filename ?? "" };
}

/** Extensión a partir del tipo MIME que informa Meta; si no se sabe, la del tipo. */
export function extension(tipo: string, mime: string, nombre = ""): string {
  const deNombre = nombre.match(/\.([a-z0-9]{2,5})$/i)?.[1];
  if (deNombre) return deNombre.toLowerCase();
  const mapa: Record<string, string> = {
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "audio/ogg": "ogg", "audio/mpeg": "mp3",
    "audio/mp4": "m4a", "video/mp4": "mp4", "application/pdf": "pdf",
  };
  return mapa[mime.split(";")[0].trim()] ?? ADJUNTOS[tipo]?.ext ?? "bin";
}

export function textoDeMensaje(m: MensajeEntrante): string {
  const t = m.type ?? "";
  switch (t) {
    case "text":
      return String(m.text?.body ?? "");
    case "image":
    case "video":
    case "document": {
      const o = (m as Record<string, { caption?: string; filename?: string }>)[t] ?? {};
      const nombre = t === "document" && o.filename ? ` ${o.filename}` : "";
      return `[${ADJUNTOS[t].etiqueta}${nombre}]${o.caption ? " " + o.caption : ""}`;
    }
    case "audio":
      return m.audio?.voice ? "[nota de voz]" : "[audio]";
    case "sticker":
      return "[sticker]";
    case "location": {
      const l = m.location ?? {};
      const donde = [l.name, l.address].filter(Boolean).join(", ");
      const mapa = l.latitude != null && l.longitude != null ? ` https://maps.google.com/?q=${l.latitude},${l.longitude}` : "";
      return `[ubicación]${donde ? " " + donde : ""}${mapa}`;
    }
    case "contacts": {
      const c = (m.contacts ?? []).map((x) => [x.name?.formatted_name, x.phones?.[0]?.phone].filter(Boolean).join(" ")).join("; ");
      return `[contacto] ${c}`.trim();
    }
    case "reaction":
      return `[reaccionó con ${m.reaction?.emoji || "un emoji"}]`;
    case "button":
      return m.button?.text ? `[tocó el botón] ${m.button.text}` : "[tocó un botón]";
    case "interactive": {
      const titulo = m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title;
      return titulo ? `[eligió] ${titulo}` : "[respuesta interactiva]";
    }
    default:
      return `[${t || "mensaje"} recibido por WhatsApp]`;
  }
}
