import type { SupabaseClient } from "@supabase/supabase-js";
import { extension } from "@/lib/wa-mensajes";

/**
 * Fotos, audios y documentos que los clientes mandan por WhatsApp.
 *
 * Meta no entrega el archivo en el webhook: entrega un id, y la URL de descarga
 * que se obtiene con ese id VENCE a los pocos minutos. Si no se descarga al
 * momento, la foto de la cocina que mandó el cliente se pierde. Se guarda en un
 * almacenamiento PRIVADO de Supabase (bucket `adjuntos`); el panel la muestra con
 * enlaces firmados que duran una hora.
 *
 * El mensaje guarda la ruta al final de su texto como `adjunto:<ruta>` (la tabla
 * `mensajes` no tiene una columna para esto y no hacía falta una migración).
 */

export const BUCKET = "adjuntos";
const GRAPH = "https://graph.facebook.com/v21.0";
const MAX_BYTES = 20 * 1024 * 1024;

export const MARCA = /\nadjunto:(\S+)\s*$/;

/** Separa el texto visible de la ruta del adjunto. */
export function separarAdjunto(cuerpo: string | null): { texto: string; ruta: string | null } {
  const s = cuerpo ?? "";
  const m = s.match(MARCA);
  return m ? { texto: s.replace(MARCA, ""), ruta: m[1] } : { texto: s, ruta: null };
}

/**
 * Descarga el adjunto de un DM y lo deja anotado en su mensaje.
 *
 * Se llama DESPUÉS de responderle a Meta (`after()` en la ruta): si Meta no
 * recibe respuesta a tiempo reintenta el mensaje entero, y bajar una foto puede
 * tardar segundos. El mensaje ya quedó guardado con su texto legible; esto solo
 * le agrega el archivo.
 */
export async function guardarAdjuntoDM(
  db: SupabaseClient,
  a: { url: string; tipo: string; asunto: string; legible: string },
): Promise<void> {
  const ruta = await guardarAdjuntoDeUrl(db, a.url, a.tipo, a.asunto);
  if (!ruta) return;
  const { error } = await db
    .from("mensajes")
    .update({ cuerpo: `${a.legible}\nadjunto:${ruta}` })
    .eq("asunto", a.asunto);
  if (error) console.error("DM: se guardó el adjunto pero no se pudo anotar", error.message);
}

/**
 * Guarda un adjunto de Instagram o Messenger.
 *
 * A diferencia de WhatsApp, el webhook de la Messenger Platform **ya entrega la
 * URL del archivo** en el propio mensaje, sin pedirla aparte — pero esa URL
 * también vence a los pocos minutos. Si no se descarga ahora, la foto de la
 * cocina que mandó el cliente se pierde igual.
 *
 * Nunca lanza: devuelve null si no pudo, para no tumbar el webhook por una foto.
 */
export async function guardarAdjuntoDeUrl(
  db: SupabaseClient,
  url: string,
  tipo: string,
  idMensaje: string,
): Promise<string | null> {
  try {
    const archivo = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!archivo.ok) throw new Error(`descarga ${archivo.status}`);
    const bytes = await archivo.arrayBuffer();
    if (bytes.byteLength > MAX_BYTES) throw new Error(`muy grande (${bytes.byteLength} bytes)`);

    const mime = archivo.headers.get("content-type")?.split(";")[0] || "application/octet-stream";
    const { data: buckets } = await db.storage.listBuckets();
    if (!buckets?.some((b) => b.name === BUCKET)) {
      await db.storage.createBucket(BUCKET, { public: false });
    }
    const seguro = idMensaje.replace(/[^A-Za-z0-9_-]/g, "").slice(-60) || String(Date.now());
    const ruta = `meta/${new Date().toISOString().slice(0, 7)}/${seguro}.${extension(tipo, mime, "")}`;
    const { error } = await db.storage.from(BUCKET).upload(ruta, new Blob([bytes], { type: mime }), {
      contentType: mime,
      upsert: true,
    });
    if (error) throw new Error(error.message);
    return ruta;
  } catch (e) {
    console.error("DM: no se pudo guardar el adjunto", tipo, e instanceof Error ? e.message : e);
    return null;
  }
}

/** Descarga el medio desde Meta y lo guarda. Nunca lanza: devuelve null si no pudo. */
export async function guardarAdjunto(
  db: SupabaseClient,
  medio: { id: string; tipo: string; mime: string; nombre: string },
  idMensaje: string,
): Promise<string | null> {
  const token = (process.env.WA_ACCESS_TOKEN ?? "").trim();
  if (!token) return null;
  const plazo = () => AbortSignal.timeout(8000);
  try {
    const info = await fetch(`${GRAPH}/${medio.id}`, { headers: { Authorization: `Bearer ${token}` }, signal: plazo() });
    if (!info.ok) throw new Error(`info ${info.status}`);
    const j = (await info.json()) as { url?: string; mime_type?: string; file_size?: number };
    if (!j.url) throw new Error("sin url");
    if (j.file_size && j.file_size > MAX_BYTES) throw new Error(`muy grande (${j.file_size} bytes)`);

    const archivo = await fetch(j.url, { headers: { Authorization: `Bearer ${token}` }, signal: plazo() });
    if (!archivo.ok) throw new Error(`descarga ${archivo.status}`);
    const bytes = await archivo.arrayBuffer();
    if (bytes.byteLength > MAX_BYTES) throw new Error("muy grande");

    const { data: buckets } = await db.storage.listBuckets();
    if (!buckets?.some((b) => b.name === BUCKET)) {
      await db.storage.createBucket(BUCKET, { public: false });
    }
    const mime = j.mime_type || medio.mime || "application/octet-stream";
    const seguro = idMensaje.replace(/[^A-Za-z0-9_-]/g, "").slice(-60) || String(Date.now());
    const ruta = `whatsapp/${new Date().toISOString().slice(0, 7)}/${seguro}.${extension(medio.tipo, mime, medio.nombre)}`;
    const { error } = await db.storage.from(BUCKET).upload(ruta, new Blob([bytes], { type: mime }), {
      contentType: mime,
      upsert: true,
    });
    if (error) throw new Error(error.message);
    return ruta;
  } catch (e) {
    console.error("WhatsApp: no se pudo guardar el adjunto", medio.tipo, e instanceof Error ? e.message : e);
    return null;
  }
}
