import type { SupabaseClient } from "@supabase/supabase-js";
import { registrarLead } from "@/lib/registrar-lead";
import { leerDelTexto } from "@/lib/procesar-whatsapp";

/**
 * Lo que hace el webhook de Instagram (Messenger Platform, app "DLS Control-IG")
 * con un POST de Meta, separado de la ruta para poder probarlo con una base
 * falsa (tests/procesar-instagram.test.ts). Mismo patrón que WhatsApp.
 *
 * Un DM de Instagram trae todavía menos que un WhatsApp: ni siquiera el
 * teléfono, solo un IGSID (el id de la conversación) y el texto. Por eso el
 * lead se guarda con `sesion_id: "ig:<IGSID>"` en vez de teléfono — es lo que
 * permite reconocer a la misma persona en el siguiente mensaje sin tener un
 * dato de contacto real — y queda SIN CONTACTO hasta que la persona deje un
 * teléfono o correo en el DM.
 */

export interface MensajeIG {
  mid?: string;
  text?: string;
  attachments?: { type?: string }[];
  is_echo?: boolean;
}

export interface EventoMessagingIG {
  sender?: { id?: string };
  message?: MensajeIG;
}

export interface EntradaIG {
  messaging?: EventoMessagingIG[];
}

export const asuntoDeIG = (idMeta: string) => `instagram:${idMeta}`;

function textoDeMensajeIG(m: MensajeIG): string {
  if (m.text) return m.text;
  const tipo = m.attachments?.[0]?.type;
  return tipo ? `[${tipo} recibido por Instagram]` : "[mensaje recibido por Instagram]";
}

export interface ResultadoIG {
  procesados: number;
  duplicados: number;
  avisos: { titulo: string; cuerpo: string; url: string; tag: string }[];
}

export async function procesarInstagram(entradas: EntradaIG[], db: SupabaseClient | null): Promise<ResultadoIG> {
  const r: ResultadoIG = { procesados: 0, duplicados: 0, avisos: [] };

  for (const entrada of entradas) {
    for (const evento of entrada.messaging ?? []) {
      const de = String(evento.sender?.id ?? "");
      const msg = evento.message;
      // Meta reenvía por el mismo webhook los mensajes que nosotros mandamos
      // (is_echo): sin este filtro, cada respuesta se registraría como un DM
      // entrante nuevo de nosotros mismos.
      if (!de || !msg || msg.is_echo) continue;

      const idMeta = String(msg.mid ?? "");
      if (db && idMeta) {
        const { data: ya } = await db.from("mensajes").select("id").eq("asunto", asuntoDeIG(idMeta)).limit(1);
        if (ya?.length) {
          r.duplicados++;
          continue;
        }
      }

      const legible = textoDeMensajeIG(msg);
      const { tipo, m2 } = leerDelTexto(msg.text ?? "");

      const alta = await registrarLead(
        {
          canal: "instagram",
          sesion_id: `ig:${de}`,
          tipo_proyecto: tipo,
          superficie_m2: m2 || "",
          mensaje: legible,
          fuente_original: "instagram",
          id_externo: idMeta,
        },
        db,
      );
      if (!alta.ok) {
        console.error("Instagram: no se pudo registrar", alta.error, alta.detalle);
        continue;
      }
      r.procesados++;

      r.avisos.push({
        titulo: `Instagram de ${alta.nombre !== "Sin nombre" ? alta.nombre : "un cliente"}`,
        cuerpo: legible,
        url: `/?lead=${alta.id}`,
        tag: `ig-${alta.id}`,
      });
    }
  }
  return r;
}
