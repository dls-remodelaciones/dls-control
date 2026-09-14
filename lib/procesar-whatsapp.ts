import type { SupabaseClient } from "@supabase/supabase-js";
import { registrarLead } from "@/lib/registrar-lead";
import { fallidos, type EstadoWA } from "@/lib/entregas";
import { textoDeMensaje, medioDe, type MensajeEntrante } from "@/lib/wa-mensajes";
import { normalizarTipo, normalizarM2, config, type TipoProyecto } from "@/lib/negocio";

/**
 * Lo que hace el webhook de WhatsApp con un POST de Meta, separado de la ruta
 * para poder probarlo con una base falsa (tests/procesar-whatsapp.test.ts).
 *
 * Dos cosas que cambiaron el 14-sep-2026:
 *
 * 1. **Sin duplicados.** Meta reintenta un mensaje si no recibe respuesta a
 *    tiempo, y descargar una foto puede tardar varios segundos: el mismo mensaje
 *    entraba dos veces, con dos avisos al celular. Ahora cada mensaje guarda su
 *    id de Meta en `mensajes.asunto` ("whatsapp:<id>") y un reintento se ignora.
 * 2. **Respuesta inmediata.** Los archivos ya no se descargan antes de responder:
 *    el mensaje se registra al tiro ("[foto] ...") y la descarga queda como tarea
 *    posterior, que completa el mensaje con el adjunto.
 */

export interface CambioWA {
  value?: {
    messages?: (MensajeEntrante & { from?: string; timestamp?: string })[];
    contacts?: { profile?: { name?: string }; wa_id?: string }[];
    statuses?: unknown[];
  };
}

export const asuntoDe = (idMeta: string) => `whatsapp:${idMeta}`;

/** Sin inventar: solo lo que la persona nombró ("mi cocina de 20 m2"). */
export function leerDelTexto(texto: string) {
  const tipo = normalizarTipo(texto);
  // Se exige la unidad: un número suelto en una frase no es una superficie.
  const m = texto.match(/(\d{1,4}(?:[.,]\d+)?)\s*(?:m2|m²|mts?2?|metros?\s*cuadrados?)/i);
  const m2 = m ? normalizarM2(m[0]) : 0;
  const t = tipo ? config().tipos[tipo as TipoProyecto] : null;
  const coherente = !!(t && m2 > 0 && m2 >= t.superficie.min && m2 <= t.superficie.max);
  return { tipo, m2: coherente ? m2 : 0 };
}

export interface ResultadoWA {
  procesados: number;
  duplicados: number;
  avisos: { titulo: string; cuerpo: string; url: string; tag: string }[];
  adjuntos: { medio: NonNullable<ReturnType<typeof medioDe>>; idMeta: string; legible: string }[];
  noEntregados: ReturnType<typeof fallidos>;
}

export async function procesarWhatsApp(cambios: CambioWA[], db: SupabaseClient | null): Promise<ResultadoWA> {
  const r: ResultadoWA = { procesados: 0, duplicados: 0, avisos: [], adjuntos: [], noEntregados: [] };

  for (const cambio of cambios) {
    const v = cambio.value ?? {};
    // Los acuses de entrega también llegan por acá. Un "failed" es una respuesta que no llegó.
    r.noEntregados.push(...fallidos((v.statuses ?? []) as EstadoWA[]));

    for (const msg of v.messages ?? []) {
      const de = String(msg.from ?? "");
      if (!de) continue;
      const idMeta = String(msg.id ?? "");

      if (db && idMeta) {
        const { data: ya } = await db.from("mensajes").select("id").eq("asunto", asuntoDe(idMeta)).limit(1);
        if (ya?.length) {
          r.duplicados++;
          continue;
        }
      }

      const perfil = v.contacts?.find((c) => c.wa_id === de)?.profile?.name ?? "";
      const legible = textoDeMensaje(msg);
      const { tipo, m2 } = leerDelTexto(msg.type === "text" ? legible : "");

      const alta = await registrarLead(
        {
          canal: "whatsapp",
          nombre: perfil,
          telefono: de,
          tipo_proyecto: tipo,
          superficie_m2: m2 || "",
          mensaje: legible,
          fuente_original: "whatsapp",
          id_externo: idMeta,
        },
        db,
      );
      if (!alta.ok) {
        console.error("WhatsApp: no se pudo registrar", alta.error, alta.detalle);
        continue;
      }
      r.procesados++;

      const medio = medioDe(msg);
      if (medio && idMeta) r.adjuntos.push({ medio, idMeta, legible });

      // Mismo tag por lead: tres mensajes seguidos no apilan tres avisos.
      r.avisos.push({
        titulo: `WhatsApp de ${perfil || `+${de}`}`,
        cuerpo: legible,
        url: `/?lead=${alta.id}`,
        tag: `wa-${alta.id}`,
      });
    }
  }
  return r;
}
