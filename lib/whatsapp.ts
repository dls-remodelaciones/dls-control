/**
 * Envío de mensajes por WhatsApp (Cloud API de Meta).
 *
 * Contexto que explica por qué esto existe: el número del negocio
 * (+56 9 5638 1974) está conectado a la API, y un número conectado a la API
 * **no vive en ninguna aplicación de WhatsApp**. No hay un teléfono donde
 * aparezca la conversación ni donde se pueda contestar a mano. Si DLS Control
 * no envía, nadie responde.
 *
 * La regla que manda es la **ventana de 24 horas**: Meta solo deja escribir
 * texto libre dentro de las 24 horas siguientes al último mensaje del cliente.
 * Pasado ese plazo hay que usar una plantilla aprobada. Por eso todo lo de acá
 * distingue esos dos mundos y se niega a intentar lo que sabe que va a fallar.
 */

const GRAPH = "https://graph.facebook.com/v21.0";

export const VENTANA_HORAS = 24;

export type Envio =
  | { ok: true; id_mensaje: string }
  | { ok: false; error: string; detalle: string };

function credenciales() {
  return {
    token: process.env.WA_ACCESS_TOKEN ?? "",
    numeroId: process.env.WA_PHONE_NUMBER_ID ?? "",
  };
}

export function whatsappConfigurado(): boolean {
  const { token, numeroId } = credenciales();
  return Boolean(token && numeroId);
}

/**
 * ¿Se puede escribir texto libre a esta persona ahora?
 *
 * `ultimoEntrante` es la fecha del último mensaje que ELLA nos mandó. Si no hay
 * ninguno, la ventana nunca se abrió: Meta rechazaría el envío.
 */
export function ventanaAbierta(ultimoEntrante: string | null | undefined): {
  abierta: boolean;
  horas_restantes: number;
} {
  if (!ultimoEntrante) return { abierta: false, horas_restantes: 0 };
  const t = Date.parse(ultimoEntrante);
  if (!Number.isFinite(t)) return { abierta: false, horas_restantes: 0 };
  const transcurridas = (Date.now() - t) / 3_600_000;
  const restantes = VENTANA_HORAS - transcurridas;
  return {
    abierta: restantes > 0,
    horas_restantes: restantes > 0 ? Math.round(restantes * 10) / 10 : 0,
  };
}

/** Envía un texto libre. Solo funciona con la ventana abierta. */
export async function enviarTexto(telefono: string, texto: string): Promise<Envio> {
  const { token, numeroId } = credenciales();
  if (!token || !numeroId) {
    return { ok: false, error: "sin_configuracion", detalle: "Falta WA_ACCESS_TOKEN o WA_PHONE_NUMBER_ID." };
  }
  if (!/^\d{8,15}$/.test(telefono)) {
    return { ok: false, error: "telefono_invalido", detalle: "El teléfono no está en formato internacional." };
  }
  const cuerpo = texto.trim();
  if (!cuerpo) {
    return { ok: false, error: "mensaje_vacio", detalle: "No hay nada que enviar." };
  }

  try {
    const r = await fetch(`${GRAPH}/${numeroId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: telefono,
        type: "text",
        // `preview_url` deja que WhatsApp muestre la tarjeta de un enlace, que
        // es justo lo que se quiere al mandar una cotización.
        text: { preview_url: true, body: cuerpo.slice(0, 4000) },
      }),
    });

    const j = (await r.json()) as Record<string, unknown>;

    if (!r.ok) {
      const err = (j.error ?? {}) as Record<string, unknown>;
      const codigo = Number(err.code ?? 0);
      // 131047 y 131051: fuera de la ventana de 24 horas. Se traduce porque el
      // texto de Meta ("Message failed to send because more than 24 hours...")
      // no le dice nada a quien está mirando la pantalla.
      const fueraDeVentana = codigo === 131047 || codigo === 131051;
      return {
        ok: false,
        error: fueraDeVentana ? "ventana_cerrada" : "meta_rechazo",
        detalle: fueraDeVentana
          ? "Pasaron más de 24 horas desde su último mensaje. WhatsApp ya no deja escribir texto libre."
          : String(err.message ?? "Meta rechazó el envío."),
      };
    }

    const mensajes = (j.messages as { id?: string }[]) ?? [];
    return { ok: true, id_mensaje: String(mensajes[0]?.id ?? "") };
  } catch (e) {
    return {
      ok: false,
      error: "sin_conexion",
      detalle: e instanceof Error ? e.message : String(e),
    };
  }
}
