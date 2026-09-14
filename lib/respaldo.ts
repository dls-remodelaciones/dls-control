import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Respaldo semanal de los datos del panel.
 *
 * El plan gratis de Supabase no guarda copias que se puedan descargar. Un
 * borrado por error, una migración mal hecha o un script que pise datos, y los
 * clientes se pierden sin vuelta. Cada domingo se copia todo a un archivo JSON
 * en un almacenamiento PRIVADO de Supabase (bucket `respaldos`), fuera de las
 * tablas: si una tabla se estropea, el archivo sigue ahí.
 *
 * Límite honesto: vive en el mismo proyecto de Supabase. Protege de errores y
 * borrados, no de perder la cuenta entera. Nunca se borran respaldos viejos.
 */

export const BUCKET = "respaldos";
export const TABLAS = ["leads", "mensajes", "actividad", "cotizaciones", "visitas", "config"] as const;
/** Días sin respaldo a partir de los cuales la revisión diaria avisa. */
export const DIAS_SIN_RESPALDO = 8;

export const nombreArchivo = (ahora: Date) => `datos-${ahora.toISOString().slice(0, 10)}.json`;

/** Fecha (AAAA-MM-DD) del respaldo más reciente según los nombres de archivo. */
export function ultimoRespaldo(nombres: string[]): string | null {
  const fechas = nombres
    .map((n) => n.match(/^datos-(\d{4}-\d{2}-\d{2})\.json$/)?.[1])
    .filter((f): f is string => Boolean(f))
    .sort();
  return fechas.at(-1) ?? null;
}

export async function respaldar(db: SupabaseClient, ahora = new Date()) {
  const { data: buckets } = await db.storage.listBuckets();
  if (!buckets?.some((b) => b.name === BUCKET)) {
    const { error } = await db.storage.createBucket(BUCKET, { public: false });
    if (error && !/already exists/i.test(error.message)) throw new Error("No se pudo crear el bucket: " + error.message);
  }

  const contenido: Record<string, unknown> = { creado: ahora.toISOString() };
  const filas: Record<string, number> = {};
  for (const t of TABLAS) {
    const todas: unknown[] = [];
    for (let desde = 0; ; desde += 1000) {
      const { data, error } = await db.from(t).select("*").range(desde, desde + 999);
      if (error) throw new Error(`No se pudo leer ${t}: ${error.message}`);
      todas.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    contenido[t] = todas;
    filas[t] = todas.length;
  }

  const archivo = nombreArchivo(ahora);
  const cuerpo = JSON.stringify(contenido);
  const { error } = await db.storage
    .from(BUCKET)
    .upload(archivo, new Blob([cuerpo], { type: "application/json" }), { upsert: true, contentType: "application/json" });
  if (error) throw new Error("No se pudo subir el respaldo: " + error.message);

  return { archivo, bytes: cuerpo.length, filas };
}
