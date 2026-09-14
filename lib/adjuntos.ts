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
