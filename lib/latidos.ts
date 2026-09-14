import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Latidos de las tareas automáticas.
 *
 * Los crons de Vercel pueden dejar de correr sin avisar (un cambio de plan, un
 * `vercel.json` mal editado, la función que empieza a fallar antes de hacer
 * nada). Si el recordatorio de cada hora deja de correr, dejan de llegar los
 * avisos de ventana de WhatsApp y nadie lo nota — el silencio parece calma.
 * Cada tarea deja su "latido" en `config`; la revisión diaria mira que sean
 * recientes. La revisión diaria no puede vigilarse a sí misma: si ella se cae,
 * lo que se nota es que dejan de llegar sus avisos de falla.
 */

export const TAREAS: Record<string, { nombre: string; maxHoras: number }> = {
  recordatorio: { nombre: "Recordatorios de cada hora", maxHoras: 3 },
  resumen: { nombre: "Resumen semanal", maxHoras: 8 * 24 },
};

const clave = (tarea: string) => `latido_${tarea}`;

export async function registrarLatido(db: SupabaseClient, tarea: string, ahora = new Date()) {
  await db
    .from("config")
    .upsert({ clave: clave(tarea), valor: { ultima: ahora.toISOString() }, actualizado: ahora.toISOString() }, { onConflict: "clave" });
}

/** Tareas atrasadas. Una tarea sin latido todavía no cuenta: puede no haber corrido nunca. */
export function atrasadas(latidos: Record<string, string | undefined>, ahora: Date): string[] {
  const salida: string[] = [];
  for (const [tarea, { nombre, maxHoras }] of Object.entries(TAREAS)) {
    const ultima = latidos[tarea];
    if (!ultima) continue;
    const horas = (ahora.getTime() - Date.parse(ultima)) / 3_600_000;
    if (horas > maxHoras) {
      salida.push(`${nombre}: no corre hace ${horas < 48 ? `${Math.floor(horas)} h` : `${Math.floor(horas / 24)} días`}`);
    }
  }
  return salida;
}

export async function leerLatidos(db: SupabaseClient): Promise<Record<string, string | undefined>> {
  const { data } = await db
    .from("config")
    .select("clave, valor")
    .in("clave", Object.keys(TAREAS).map(clave));
  const salida: Record<string, string | undefined> = {};
  for (const f of data ?? []) {
    salida[String(f.clave).replace(/^latido_/, "")] = (f.valor as { ultima?: string })?.ultima;
  }
  return salida;
}
