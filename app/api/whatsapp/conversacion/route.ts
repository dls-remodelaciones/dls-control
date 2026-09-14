import { NextRequest, NextResponse, after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { usuarioDeLaPeticion } from "@/lib/sesion";
import { BUCKET as BUCKET_ADJUNTOS, separarAdjunto } from "@/lib/adjuntos";
import {
  enviarTexto,
  enviarPlantilla,
  listarPlantillas,
  marcarLeido,
  plantillaRellena,
  ventanaAbierta,
  whatsappConfigurado,
} from "@/lib/whatsapp";

/**
 * La conversación de WhatsApp de un lead, desde el panel.
 *
 *   GET  ?lead_id=…  → los últimos mensajes y si se puede escribir ahora.
 *   POST {lead_id, texto} → envía desde el número del negocio y lo registra.
 *
 * Por qué el envío pasa por acá y no por el navegador: el token de Meta no
 * puede salir del servidor. Si estuviera en el bundle, cualquiera que abriera
 * el código fuente podría mandar WhatsApps a nombre de DLS.
 *
 * Todo lo que sale queda guardado en `mensajes` como `saliente`. El historial
 * de una conversación no puede depender de que alguien se acuerde de anotarlo.
 */

const LIMITE_MENSAJES = 30;

type Mensaje = {
  id: string;
  direccion: string;
  canal: string | null;
  cuerpo: string | null;
  enviado_por: string | null;
  creado: string;
  asunto?: string | null;
};

/** El último mensaje que ESCRIBIÓ la persona. Es lo que abre la ventana. */
function ultimoEntrante(mensajes: Mensaje[]): string | null {
  const entrantes = mensajes.filter((m) => m.direccion === "entrante" && m.canal === "whatsapp");
  if (!entrantes.length) return null;
  return entrantes.reduce((a, b) => (Date.parse(a.creado) > Date.parse(b.creado) ? a : b)).creado;
}

/**
 * Enlaces firmados reutilizados mientras les quede vida. Sin esto, cada vez que
 * el chat se refrescaba (cada 20 s) cada foto recibía una URL nueva y el
 * celular la volvía a descargar entera.
 */
const enlaces = new Map<string, { url: string; hasta: number }>();
async function enlaceFirmado(db: NonNullable<ReturnType<typeof supabaseAdmin>>, ruta: string) {
  const guardado = enlaces.get(ruta);
  if (guardado && guardado.hasta > Date.now()) return { signedUrl: guardado.url };
  const { data } = await db.storage.from(BUCKET_ADJUNTOS).createSignedUrl(ruta, 3600);
  if (data?.signedUrl) {
    // Se reusa por 50 minutos: la firma dura 60, así nunca se entrega una a punto de vencer.
    enlaces.set(ruta, { url: data.signedUrl, hasta: Date.now() + 50 * 60_000 });
    if (enlaces.size > 2000) enlaces.clear();
  }
  return data;
}

/** Mensajes de clientes ya marcados como leídos en esta instancia (no repetir la llamada a Meta). */
const marcados = new Set<string>();

/**
 * Fotos, audios y documentos que mandó el cliente (ver lib/adjuntos.ts): se
 * quita la marca del texto y se agrega un enlace firmado que dura una hora.
 */
async function conAdjuntos(db: NonNullable<ReturnType<typeof supabaseAdmin>>, mensajes: Mensaje[]) {
  return Promise.all(
    mensajes.map(async (m) => {
      const { texto, ruta } = separarAdjunto(m.cuerpo);
      if (!ruta) return { ...m, adjunto: null };
      const data = await enlaceFirmado(db, ruta);
      const ext = ruta.split(".").pop()?.toLowerCase() ?? "";
      const tipo = ["jpg", "jpeg", "png", "webp"].includes(ext)
        ? "imagen"
        : ["ogg", "mp3", "m4a", "aac", "amr"].includes(ext)
          ? "audio"
          : ["mp4", "3gp", "mov"].includes(ext)
            ? "video"
            : "archivo";
      return { ...m, cuerpo: texto, adjunto: data?.signedUrl ? { url: data.signedUrl, tipo } : null };
    }),
  );
}

function fallaDeCarga(error: string | undefined) {
  return error === "mensajes_no_disponibles"
    ? NextResponse.json(
        { ok: false, error, detalle: "No se pudo leer la conversación. Aprieta Actualizar en unos segundos." },
        { status: 503 },
      )
    : NextResponse.json({ ok: false, error }, { status: 404 });
}

async function cargar(leadId: string) {
  const db = supabaseAdmin();
  if (!db) return { error: "sin_base_de_datos" as const };

  const { data: lead, error: e1 } = await db
    .from("leads")
    .select("id, nombre, telefono")
    .eq("id", leadId)
    .single();
  if (e1 || !lead) return { error: "lead_no_existe" as const };

  const { data: mensajes, error: e2 } = await db
    .from("mensajes")
    .select("id, direccion, canal, cuerpo, enviado_por, creado, asunto")
    .eq("lead_id", leadId)
    .eq("canal", "whatsapp")
    .order("creado", { ascending: false })
    .limit(LIMITE_MENSAJES);

  // Un error acá NO puede verse como "cero mensajes": la pantalla diría "todavía
  // no te ha escrito" y ofrecería plantillas a alguien que espera respuesta con la
  // ventana abierta. Pasó el 13-sep-2026 en una carga; al actualizar aparecieron 6.
  if (e2) {
    console.error("Conversación: no se pudieron leer los mensajes", e2.message);
    return { error: "mensajes_no_disponibles" as const };
  }

  return { db, lead, mensajes: (mensajes ?? []) as Mensaje[] };
}

export async function GET(req: NextRequest) {
  const quien = await usuarioDeLaPeticion(req);
  if (!quien.ok) return NextResponse.json({ ok: false, error: quien.error }, { status: quien.status });

  const leadId = req.nextUrl.searchParams.get("lead_id")?.trim() ?? "";
  if (!leadId) return NextResponse.json({ ok: false, error: "falta_lead_id" }, { status: 400 });

  const r = await cargar(leadId);
  if ("error" in r) return fallaDeCarga(r.error);

  const ultimo = ultimoEntrante(r.mensajes);

  // Tics azules: al abrir el chat (?leido=1) se marca como leído el último mensaje del cliente.
  if (req.nextUrl.searchParams.get("leido") === "1") {
    const idMeta = r.mensajes
      .filter((m) => m.direccion === "entrante" && m.asunto?.startsWith("whatsapp:"))
      .sort((a, b) => Date.parse(b.creado) - Date.parse(a.creado))[0]
      ?.asunto?.slice("whatsapp:".length);
    if (idMeta && !marcados.has(idMeta)) {
      marcados.add(idMeta);
      after(() => marcarLeido(idMeta).then(() => undefined));
    }
  }
  const ventana = ventanaAbierta(ultimo);

  // Con la ventana cerrada, lo único que Meta acepta son plantillas aprobadas.
  // Se consultan solo en ese caso: si se puede escribir libremente, preguntarle
  // a Meta por las plantillas es una llamada que a nadie le sirve.
  let plantillas: unknown = undefined;
  if (!ventana.abierta && whatsappConfigurado() && r.lead.telefono) {
    const p = await listarPlantillas();
    plantillas = p.ok
      ? p.plantillas.filter((x) => x.estado === "APPROVED")
      : { error: p.detalle };
  }

  return NextResponse.json({
    ok: true,
    lead: { id: r.lead.id, nombre: r.lead.nombre, telefono: r.lead.telefono },
    puede_escribir: whatsappConfigurado() && Boolean(r.lead.telefono) && ventana.abierta,
    ventana: { ...ventana, ultimo_mensaje_del_cliente: ultimo },
    configurado: whatsappConfigurado(),
    ...(plantillas ? { plantillas } : {}),
    // En orden de lectura: el más antiguo primero, como una conversación.
    mensajes: await conAdjuntos(r.db, [...r.mensajes].reverse()),
  });
}

export async function POST(req: NextRequest) {
  const quien = await usuarioDeLaPeticion(req);
  if (!quien.ok) return NextResponse.json({ ok: false, error: quien.error }, { status: quien.status });

  let body: { lead_id?: unknown; texto?: unknown; plantilla?: unknown; valores?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "json_invalido" }, { status: 400 });
  }

  const leadId = String(body.lead_id ?? "").trim();
  const texto = String(body.texto ?? "").trim();
  const plantilla = String(body.plantilla ?? "").trim();
  const valores = Array.isArray(body.valores) ? body.valores.map((v) => String(v ?? "").trim()) : [];
  if (!leadId) return NextResponse.json({ ok: false, error: "falta_lead_id" }, { status: 400 });
  if (!texto && !plantilla) {
    return NextResponse.json({ ok: false, error: "mensaje_vacio" }, { status: 400 });
  }

  const r = await cargar(leadId);
  if ("error" in r) return fallaDeCarga(r.error);
  if (!r.lead.telefono) {
    return NextResponse.json(
      { ok: false, error: "sin_telefono", detalle: "Este lead no dejó teléfono." },
      { status: 422 },
    );
  }

  // Se comprueba la ventana ANTES de llamar a Meta. Se podría dejar que Meta lo
  // rechace, pero entonces el mensaje se pierde sin explicación clara y el
  // intento igual cuenta contra los límites de la cuenta.
  const ventana = ventanaAbierta(ultimoEntrante(r.mensajes));
  if (!ventana.abierta && !plantilla) {
    return NextResponse.json(
      {
        ok: false,
        error: "ventana_cerrada",
        detalle:
          "Pasaron más de 24 horas desde su último mensaje (o nunca escribió). WhatsApp solo permite plantillas aprobadas en ese caso.",
      },
      { status: 409 },
    );
  }

  let envio;
  let guardado = texto;
  let asunto = "Respuesta por WhatsApp";

  if (plantilla) {
    // Se pide la plantilla a Meta en vez de confiar en lo que mandó el
    // navegador: así se valida que siga aprobada y que los valores calcen con
    // los huecos que de verdad tiene. Meta rechaza el envío entero si sobran o
    // faltan, y ese rechazo llega sin decir cuál era el problema.
    const lista = await listarPlantillas();
    if (!lista.ok) {
      return NextResponse.json({ ok: false, error: lista.error, detalle: lista.detalle }, { status: 502 });
    }
    const p = lista.plantillas.find((x) => x.nombre === plantilla && x.estado === "APPROVED");
    if (!p) {
      return NextResponse.json(
        { ok: false, error: "plantilla_no_disponible", detalle: "Esa plantilla no existe o Meta aún no la aprueba." },
        { status: 409 },
      );
    }
    if (valores.length !== p.variables || valores.some((v) => !v)) {
      return NextResponse.json(
        {
          ok: false,
          error: "faltan_datos",
          detalle: `La plantilla "${p.nombre}" necesita ${p.variables} dato(s) y ninguno puede ir vacío.`,
        },
        { status: 422 },
      );
    }
    envio = await enviarPlantilla(r.lead.telefono, p.nombre, p.idioma, valores);
    guardado = plantillaRellena(p.cuerpo, valores);
    asunto = `Plantilla "${p.nombre}"`;
  } else {
    envio = await enviarTexto(r.lead.telefono, texto);
  }

  if (!envio.ok) {
    return NextResponse.json(
      { ok: false, error: envio.error, detalle: envio.detalle },
      { status: envio.error === "ventana_cerrada" ? 409 : 502 },
    );
  }

  // Queda registrado con el correo de quien lo mandó: si algún día hay más de
  // una persona respondiendo, se sabe quién dijo qué. De la plantilla se guarda
  // el texto YA RELLENO, que es lo que la persona recibió — guardar el nombre
  // de la plantilla obligaría a reconstruirlo después para saber qué se dijo.
  const fila = {
    lead_id: leadId,
    direccion: "saliente",
    canal: "whatsapp",
    asunto,
    cuerpo: guardado,
    enviado_por: quien.email || "panel",
  };
  // El mensaje YA salió: si la base falla al anotarlo, se reintenta una vez. Sin
  // registro, el panel seguiría mostrando al cliente como "sin responder" y el
  // aviso de ventana por vencer insistiría con alguien que ya tuvo respuesta.
  let { error: eRegistro } = await r.db.from("mensajes").insert(fila);
  if (eRegistro) {
    await new Promise((listo) => setTimeout(listo, 800));
    ({ error: eRegistro } = await r.db.from("mensajes").insert(fila));
  }
  if (eRegistro) console.error("Conversación: mensaje enviado pero no registrado", eRegistro.message);
  await r.db.from("leads").update({ ultima_actividad: new Date().toISOString() }).eq("id", leadId);

  return NextResponse.json({
    ok: true,
    id_mensaje: envio.id_mensaje,
    ...(eRegistro
      ? { advertencia: "El mensaje salió, pero no quedó anotado en el historial. Si el cliente sigue apareciendo sin responder, usa Marcar atendido." }
      : {}),
  });
}
