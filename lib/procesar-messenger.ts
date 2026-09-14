import type { SupabaseClient } from "@supabase/supabase-js";
import { registrarLead } from "@/lib/registrar-lead";
import { leerDelTexto } from "@/lib/procesar-whatsapp";
import { telefonoEnTexto, correoEnTexto } from "@/lib/contacto-en-texto";

/**
 * Lo común entre Instagram y Messenger, que usan la misma Messenger Platform de
 * Meta: el payload es idéntico salvo el `object` del sobre y si el remitente es
 * un IGSID o un PSID.
 *
 * Vive aparte porque los dos archivos eran la misma copia de 80 líneas, y al
 * agregar Messenger quedó claro que un tercer canal traería una tercera copia:
 * arreglar un error de dedupe obligaba a acordarse de arreglarlo en todas.
 *
 * Un DM no trae teléfono ni correo, solo el id de la conversación. Por eso el
 * lead entra con `sesion_id: "<prefijo>:<id>"` — es lo que permite reconocer a
 * la misma persona en el siguiente mensaje — y queda SIN CONTACTO hasta que
 * deje un teléfono o un correo escrito en el DM.
 */

export interface MensajeMeta {
  mid?: string;
  text?: string;
  attachments?: { type?: string }[];
  is_echo?: boolean;
}

export interface EventoMessaging {
  sender?: { id?: string };
  message?: MensajeMeta;
}

export interface EntradaMessenger {
  messaging?: EventoMessaging[];
}

export interface Resultado {
  procesados: number;
  duplicados: number;
  avisos: { titulo: string; cuerpo: string; url: string; tag: string }[];
}

/** Lo único que cambia de un canal al otro. */
export interface Canal {
  /** Valor de la columna `canal` y de `fuente_original`. */
  nombre: "instagram" | "facebook";
  /** Cómo se llama el canal para una persona: "Instagram", "Messenger". */
  visible: string;
  /** Prefijo del `sesion_id` y del tag del aviso: "ig", "fb". */
  prefijo: string;
  /** Prefijo del `asunto` con que se guarda el mensaje: "instagram", "facebook". */
  asunto: string;
}

export const asuntoDe = (canal: Canal, idMeta: string) => `${canal.asunto}:${idMeta}`;

function textoLegible(canal: Canal, m: MensajeMeta): string {
  if (m.text) return m.text;
  const tipo = m.attachments?.[0]?.type;
  return tipo ? `[${tipo} recibido por ${canal.visible}]` : `[mensaje recibido por ${canal.visible}]`;
}

export async function procesarMessenger(
  canal: Canal,
  entradas: EntradaMessenger[],
  db: SupabaseClient | null,
): Promise<Resultado> {
  const r: Resultado = { procesados: 0, duplicados: 0, avisos: [] };

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
        const { data: ya } = await db.from("mensajes").select("id").eq("asunto", asuntoDe(canal, idMeta)).limit(1);
        if (ya?.length) {
          r.duplicados++;
          continue;
        }
      }

      const legible = textoLegible(canal, msg);
      const texto = msg.text ?? "";
      const { tipo, m2 } = leerDelTexto(texto);
      // Muy seguido la persona escribe su teléfono o su correo en el propio
      // mensaje. Sin esto el lead quedaba SIN CONTACTO con el dato a la vista, y
      // además no se juntaba con la ficha que ya existiera de esa misma persona.
      const telefono = telefonoEnTexto(texto);
      const email = correoEnTexto(texto);

      const alta = await registrarLead(
        {
          canal: canal.nombre,
          sesion_id: `${canal.prefijo}:${de}`,
          telefono,
          email,
          tipo_proyecto: tipo,
          superficie_m2: m2 || "",
          mensaje: legible,
          fuente_original: canal.nombre,
          id_externo: idMeta,
        },
        db,
      );
      if (!alta.ok) {
        console.error(`${canal.visible}: no se pudo registrar`, alta.error, alta.detalle);
        continue;
      }
      r.procesados++;

      r.avisos.push({
        titulo: `${canal.visible} de ${alta.nombre !== "Sin nombre" ? alta.nombre : "un cliente"}`,
        cuerpo: legible,
        url: `/?lead=${alta.id}`,
        tag: `${canal.prefijo}-${alta.id}`,
      });
    }
  }
  return r;
}
