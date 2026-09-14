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
    waba: process.env.WA_WABA_ID ?? "",
  };
}

/** Una plantilla aprobada, lista para usarse. */
export interface Plantilla {
  nombre: string;
  idioma: string;
  categoria: string;
  /** El texto con {{1}}, {{2}}… tal cual lo aprobó Meta. */
  cuerpo: string;
  /** Cuántos huecos hay que rellenar antes de enviarla. */
  variables: number;
  estado: string;
}

/**
 * Plantillas aprobadas, copiadas del Administrador de WhatsApp (verificado el
 * 14-sep-2026: las tres "Activa"). Solo se usan como RESPALDO cuando Meta no
 * deja listar las plantillas en vivo: el token del panel recibe "(#200) Need
 * either permission on WhatsApp Business Account" al consultarlas, aunque sí
 * puede enviarlas. Sin este respaldo, pasadas las 24 horas no había forma de
 * escribirle a un cliente desde el panel.
 *
 * Si Meta pausa o rechaza una, el envío falla con el motivo de Meta a la vista.
 * Al arreglar el permiso en Meta, la lista en vivo vuelve a mandar sola.
 */
export const PLANTILLAS_APROBADAS: Plantilla[] = [
  {
    nombre: "cotizacion_lista",
    idioma: "es_CL",
    categoria: "UTILITY",
    cuerpo:
      "Hola {{1}}, te escribo de DLS Arquitectura y Construcción. Ya tenemos lista la cotización de tu proyecto de {{2}}. ¿Te parece si te la envío por acá?",
    variables: 2,
    estado: "APPROVED",
  },
  {
    nombre: "visita_terreno",
    idioma: "es_CL",
    categoria: "UTILITY",
    cuerpo:
      "Hola {{1}}, te confirmo la visita a terreno en {{2}} para el {{3}}. Si te acomoda otro horario, respóndeme por acá y lo movemos.",
    variables: 3,
    estado: "APPROVED",
  },
  {
    nombre: "retomar_contacto",
    idioma: "es_CL",
    categoria: "MARKETING",
    cuerpo:
      "Hola {{1}}, hace un tiempo nos escribiste por tu proyecto de {{2}}. Si sigues interesado, cuéntame y retomamos donde quedamos.",
    variables: 2,
    estado: "APPROVED",
  },
];

/**
 * Las plantillas de la cuenta, con su estado real en Meta.
 *
 * Se consultan en vivo en vez de guardarlas acá: Meta puede pausar o rechazar
 * una plantilla en cualquier momento (si a la gente le molesta, baja su
 * calidad y la desactiva), y una lista escrita a mano diría que todo está bien
 * mientras los envíos fallan.
 */
/**
 * Caché de 10 minutos: con un chat abierto y la ventana cerrada, el panel pide
 * la conversación cada 20 segundos, y cada vez se le preguntaba a Meta por las
 * plantillas — 3 llamadas por minuto para una lista que cambia cada semanas.
 */
let cachePlantillas: { hasta: number; valor: { ok: true; plantillas: Plantilla[] } } | null = null;

export async function listarPlantillas(): Promise<
  { ok: true; plantillas: Plantilla[] } | { ok: false; error: string; detalle: string }
> {
  if (cachePlantillas && cachePlantillas.hasta > Date.now()) return cachePlantillas.valor;
  const r = await listarPlantillasEnVivo();
  if (r.ok) cachePlantillas = { hasta: Date.now() + 10 * 60_000, valor: r };
  return r;
}

async function listarPlantillasEnVivo(): Promise<
  { ok: true; plantillas: Plantilla[] } | { ok: false; error: string; detalle: string }
> {
  const { token, waba } = credenciales();
  if (!token) return { ok: false, error: "sin_configuracion", detalle: "Falta WA_ACCESS_TOKEN." };
  if (!waba) return { ok: false, error: "sin_waba", detalle: "Falta WA_WABA_ID." };

  try {
    const r = await fetch(
      `${GRAPH}/${waba}/message_templates?fields=name,language,category,status,components&limit=100`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
    );
    const j = (await r.json()) as Record<string, unknown>;
    if (!r.ok) {
      const err = (j.error ?? {}) as Record<string, unknown>;
      // Falta de permiso para LISTAR (no para enviar): se usan las aprobadas conocidas.
      if (Number(err.code) === 200 || /permission/i.test(String(err.message ?? ""))) {
        console.warn("WhatsApp: sin permiso para listar plantillas; uso las aprobadas conocidas.");
        return { ok: true, plantillas: PLANTILLAS_APROBADAS };
      }
      return { ok: false, error: "meta_rechazo", detalle: String(err.message ?? "no se pudo listar") };
    }

    const plantillas: Plantilla[] = ((j.data as unknown[]) ?? []).map((t) => {
      const x = t as Record<string, unknown>;
      const comps = (x.components as Record<string, unknown>[]) ?? [];
      const body = comps.find((c) => String(c.type).toUpperCase() === "BODY");
      const cuerpo = String(body?.text ?? "");
      // El número de variables sale del propio texto: son los {{n}} distintos.
      const variables = new Set(cuerpo.match(/\{\{\s*(\d+)\s*\}\}/g) ?? []).size;
      return {
        nombre: String(x.name ?? ""),
        idioma: String(x.language ?? ""),
        categoria: String(x.category ?? ""),
        cuerpo,
        variables,
        estado: String(x.status ?? ""),
      };
    });

    return { ok: true, plantillas };
  } catch (e) {
    return { ok: false, error: "sin_conexion", detalle: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Envía una plantilla aprobada. Es lo ÚNICO que Meta acepta cuando la ventana
 * de 24 horas ya se cerró.
 *
 * `valores` rellena {{1}}, {{2}}… en ese orden. Si faltan o sobran, Meta
 * rechaza el envío entero, así que se comprueba antes de gastar la llamada.
 */
export async function enviarPlantilla(
  telefono: string,
  nombre: string,
  idioma: string,
  valores: string[],
): Promise<Envio> {
  const { token, numeroId } = credenciales();
  if (!token || !numeroId) {
    return { ok: false, error: "sin_configuracion", detalle: "Falta WA_ACCESS_TOKEN o WA_PHONE_NUMBER_ID." };
  }
  if (!/^\d{8,15}$/.test(telefono)) {
    return { ok: false, error: "telefono_invalido", detalle: "El teléfono no está en formato internacional." };
  }
  if (!nombre) {
    return { ok: false, error: "sin_plantilla", detalle: "No se dijo qué plantilla enviar." };
  }

  const componentes = valores.length
    ? [{ type: "body", parameters: valores.map((v) => ({ type: "text", text: String(v).slice(0, 300) })) }]
    : [];

  try {
    const r = await fetch(`${GRAPH}/${numeroId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: telefono,
        type: "template",
        template: { name: nombre, language: { code: idioma || "es_CL" }, components: componentes },
      }),
    });
    const j = (await r.json()) as Record<string, unknown>;

    if (!r.ok) {
      const err = (j.error ?? {}) as Record<string, unknown>;
      return { ok: false, error: "meta_rechazo", detalle: String(err.message ?? "Meta rechazó el envío.") };
    }
    const mensajes = (j.messages as { id?: string }[]) ?? [];
    return { ok: true, id_mensaje: String(mensajes[0]?.id ?? "") };
  } catch (e) {
    return { ok: false, error: "sin_conexion", detalle: e instanceof Error ? e.message : String(e) };
  }
}

/** El texto de la plantilla con los huecos ya rellenos, para guardarlo y mostrarlo. */
export function plantillaRellena(cuerpo: string, valores: string[]): string {
  return cuerpo.replace(/\{\{\s*(\d+)\s*\}\}/g, (_, n) => valores[Number(n) - 1] ?? `{{${n}}}`);
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
/**
 * Marca un mensaje del cliente como leído: le aparecen los dos tics azules.
 * Para quien escribe a una empresa, ver que lo leyeron ya es una respuesta, y
 * baja la ansiedad de "¿me habrán visto?" mientras Daniel prepara la respuesta.
 * Nunca lanza: si Meta lo rechaza, no pasa nada visible.
 */
export async function marcarLeido(idMensajeMeta: string): Promise<boolean> {
  const { token, numeroId } = credenciales();
  if (!token || !numeroId || !idMensajeMeta) return false;
  try {
    const r = await fetch(`${GRAPH}/${numeroId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: idMensajeMeta }),
      signal: AbortSignal.timeout(8000),
    });
    return r.ok;
  } catch {
    return false;
  }
}

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
