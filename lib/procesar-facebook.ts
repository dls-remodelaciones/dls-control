import type { SupabaseClient } from "@supabase/supabase-js";
import {
  asuntoDe,
  procesarMessenger,
  type Canal,
  type EntradaMessenger,
  type Resultado,
} from "@/lib/procesar-messenger";

/**
 * Messenger de la página "DLS Expertos en Remodelaciones" (id 1282934911570871),
 * en la misma app de Meta que WhatsApp. La lógica vive en
 * lib/procesar-messenger.ts, compartida con Instagram.
 */

const FACEBOOK: Canal = { nombre: "facebook", visible: "Messenger", prefijo: "fb", asunto: "facebook" };

export type EntradaFB = EntradaMessenger;
export type ResultadoFB = Resultado;

export const asuntoDeFB = (idMeta: string) => asuntoDe(FACEBOOK, idMeta);

export function procesarFacebook(entradas: EntradaFB[], db: SupabaseClient | null): Promise<ResultadoFB> {
  return procesarMessenger(FACEBOOK, entradas, db);
}
