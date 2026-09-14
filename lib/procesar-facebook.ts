import type { SupabaseClient } from "@supabase/supabase-js";
import { registrarLead } from "@/lib/registrar-lead";
import { leerDelTexto } from "@/lib/procesar-whatsapp";

/**
 * Lo que hace el webhook de Messenger (página "DLS Expertos en Remodelaciones")
 * con un POST de Meta, separado de la ruta para poder probarlo con una base
 * falsa (tests/procesar-facebook.test.ts). Mismo patrón que Instagram: un DM
 * de Messenger tampoco trae teléfono, solo un PSID (el id de la conversación)
 * y el texto — el lead entra con `sesion_id: "fb:<PSID>"` y queda SIN CONTACTO
 * hasta que la persona deje un teléfono o correo en el chat.
 */

export interface MensajeFB {
  mid?: string;
  text?: string;
  attachments?: { type?: string }[];
  is_echo?: boolean;
}

export interface EventoMessagingFB {
  sender?: { id?: string };
  message?: MensajeFB;
}

export interface EntradaFB {
  messaging?: EventoMessagingFB[];
}

export const asuntoDeFB = (idMeta: string) => `facebook:${idMeta}`;

function textoDeMensajeFB(m: MensajeFB): string {
  if (m.text) return m.text;
  const tipo = m.attachments?.[0]?.type;
  return tipo ? `[${tipo} recibido por Messenger]` : "[mensaje recibido por Messenger]";
}

export interface ResultadoFB {
  procesados: number;
  duplicados: number;
  avisos: { titulo: string; cuerpo: string; url: string; tag: string }[];
}

export async function procesarFacebook(entradas: EntradaFB[], db: SupabaseClient | null): Promise<ResultadoFB> {
  const r: ResultadoFB = { procesados: 0, duplicados: 0, avisos: [] };

  for (const entrada of entradas) {
    for (const evento of entrada.messaging ?? []) {
      const de = String(evento.sender?.id ?? "");
      const msg = evento.message;
      // Igual que Instagram: Meta reenvía por el mismo webhook los mensajes
      // que nosotros mandamos (is_echo) — sin este filtro cada respuesta se
      // registraría como un DM entrante nuevo de nosotros mismos.
      if (!de || !msg || msg.is_echo) continue;

      const idMeta = String(msg.mid ?? "");
      if (db && idMeta) {
        const { data: ya } = await db.from("mensajes").select("id").eq("asunto", asuntoDeFB(idMeta)).limit(1);
        if (ya?.length) {
          r.duplicados++;
          continue;
        }
      }

      const legible = textoDeMensajeFB(msg);
      const { tipo, m2 } = leerDelTexto(msg.text ?? "");

      const alta = await registrarLead(
        {
          canal: "facebook",
          sesion_id: `fb:${de}`,
          tipo_proyecto: tipo,
          superficie_m2: m2 || "",
          mensaje: legible,
          fuente_original: "facebook",
          id_externo: idMeta,
        },
        db,
      );
      if (!alta.ok) {
        console.error("Facebook: no se pudo registrar", alta.error, alta.detalle);
        continue;
      }
      r.procesados++;

      r.avisos.push({
        titulo: `Messenger de ${alta.nombre !== "Sin nombre" ? alta.nombre : "un cliente"}`,
        cuerpo: legible,
        url: `/?lead=${alta.id}`,
        tag: `fb-${alta.id}`,
      });
    }
  }
  return r;
}
