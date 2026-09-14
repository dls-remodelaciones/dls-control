/**
 * Responder un DM de Instagram o de Messenger desde el panel.
 *
 * Hasta ahora esos mensajes solo entraban: el lead quedaba registrado y había
 * que ir a contestar a la aplicación de Meta. Acá se cierra el circuito.
 *
 * Los dos canales hablan la misma Messenger Platform y el mismo endpoint
 * (`/me/messages`), pero **no son intercambiables**:
 *
 *   - Instagram usa la app "DLS Control-IG" con permisos estándar: apenas hay
 *     identificador de acceso, se le puede escribir a cualquier cliente.
 *   - Messenger usa `pages_messaging`, que sin Advanced Access solo deja
 *     escribirle a quien tenga un rol en la aplicación. Hasta que Meta apruebe
 *     la revisión, un envío a un cliente cualquiera lo rechaza Meta, no este
 *     código.
 *
 * Igual que WhatsApp, Meta solo deja responder texto libre dentro de las 24
 * horas siguientes al último mensaje de la persona.
 */

export const VENTANA_HORAS_DM = 24;

export type EnvioDM = { ok: true; id_mensaje: string } | { ok: false; error: string; detalle: string };

export type CanalDM = "instagram" | "facebook";

/**
 * Cómo se guarda cada canal en `sesion_id`, de dónde saca su identificador de
 * acceso y contra qué host habla.
 *
 * Los dos hosts NO son intercambiables, y confundirlos cuesta una tarde: el
 * identificador que entrega "Configuración de la API con el inicio de sesión de
 * Instagram" es de Instagram Login, y `graph.facebook.com` ni siquiera puede
 * interpretarlo — responde "Cannot parse access token", que suena a token mal
 * copiado y no lo es. Los tokens de página de Messenger sí van por Facebook.
 */
const CONFIG: Record<CanalDM, { prefijo: string; env: string; visible: string; host: string }> = {
  instagram: {
    prefijo: "ig",
    env: "IG_ACCESS_TOKEN",
    visible: "Instagram",
    host: "https://graph.instagram.com/v23.0",
  },
  facebook: {
    prefijo: "fb",
    env: "FB_PAGE_ACCESS_TOKEN",
    visible: "Messenger",
    host: "https://graph.facebook.com/v23.0",
  },
};

/**
 * Del `sesion_id` del lead al canal y al identificador de la conversación.
 * `"ig:178414..."` → `{ canal: "instagram", id: "178414..." }`.
 */
export function leerSesion(sesionId: string | null | undefined): { canal: CanalDM; id: string } | null {
  const s = String(sesionId ?? "").trim();
  const corte = s.indexOf(":");
  if (corte < 1) return null;
  const prefijo = s.slice(0, corte);
  const id = s.slice(corte + 1).trim();
  if (!id) return null;
  for (const [canal, c] of Object.entries(CONFIG) as [CanalDM, (typeof CONFIG)[CanalDM]][]) {
    if (c.prefijo === prefijo) return { canal, id };
  }
  return null;
}

/** ¿Está configurado el envío para este canal? */
export function envioConfigurado(canal: CanalDM): boolean {
  return Boolean((process.env[CONFIG[canal].env] ?? "").trim());
}

/**
 * Manda un texto a una conversación de Instagram o Messenger.
 *
 * `sesionId` es el del lead (`ig:<id>` o `fb:<id>`): así quien llama no tiene
 * que saber de prefijos ni de qué identificador de acceso corresponde.
 */
export async function enviarDM(sesionId: string | null | undefined, texto: string): Promise<EnvioDM> {
  const destino = leerSesion(sesionId);
  if (!destino) {
    return { ok: false, error: "sesion_invalida", detalle: "Este lead no tiene una conversación de Instagram ni de Messenger." };
  }
  const { canal, id } = destino;
  const conf = CONFIG[canal];
  const token = (process.env[conf.env] ?? "").trim();
  if (!token) {
    return {
      ok: false,
      error: "sin_configuracion",
      detalle: `Falta ${conf.env}: todavía no se puede responder ${conf.visible} desde el panel.`,
    };
  }

  const cuerpo = texto.trim();
  if (!cuerpo) return { ok: false, error: "mensaje_vacio", detalle: "No hay nada que enviar." };

  try {
    const r = await fetch(`${conf.host}/me/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id },
        // RESPONSE: es la contestación a algo que la persona escribió, que es
        // lo único permitido dentro de la ventana sin etiquetas especiales.
        messaging_type: "RESPONSE",
        message: { text: cuerpo.slice(0, 1000) },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const j = (await r.json()) as Record<string, unknown>;

    if (!r.ok) {
      const err = (j.error ?? {}) as Record<string, unknown>;
      return { ok: false, ...traducir(canal, Number(err.code ?? 0), String(err.message ?? "")) };
    }
    return { ok: true, id_mensaje: String(j.message_id ?? "") };
  } catch (e) {
    return { ok: false, error: "sin_conexion", detalle: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Los errores de Meta en palabras que sirvan mirando el panel. El texto crudo
 * ("This message is sent outside of allowed window") no le dice nada a quien
 * está intentando contestarle a un cliente.
 */
function traducir(canal: CanalDM, codigo: number, mensaje: string): { error: string; detalle: string } {
  if (codigo === 10 || /outside of allowed window|24 ?hours?/i.test(mensaje)) {
    return {
      error: "ventana_cerrada",
      detalle: `Pasaron más de 24 horas desde su último mensaje. ${CONFIG[canal].visible} ya no deja responder texto libre: hay que escribirle desde la aplicación.`,
    };
  }
  if (codigo === 200 || codigo === 10_303 || /permission/i.test(mensaje)) {
    const extra =
      canal === "facebook"
        ? " Messenger necesita que Meta apruebe la revisión de la aplicación antes de poder escribirle a un cliente."
        : "";
    return { error: "sin_permiso", detalle: `Meta no autorizó el envío.${extra}` };
  }
  return { error: "meta_rechazo", detalle: mensaje || "Meta rechazó el envío." };
}
