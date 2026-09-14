import type { SupabaseClient } from "@supabase/supabase-js";
import {
  asuntoDe,
  procesarMessenger,
  type Canal,
  type EntradaMessenger,
  type Resultado,
} from "@/lib/procesar-messenger";

/**
 * Instagram (app de Meta separada, "DLS Control-IG", id 2053433005356915).
 * La lógica vive en lib/procesar-messenger.ts: Instagram y Messenger comparten
 * la misma Messenger Platform y el mismo payload.
 */

const INSTAGRAM: Canal = { nombre: "instagram", visible: "Instagram", prefijo: "ig", asunto: "instagram" };

export type EntradaIG = EntradaMessenger;
export type ResultadoIG = Resultado;

export const asuntoDeIG = (idMeta: string) => asuntoDe(INSTAGRAM, idMeta);

export function procesarInstagram(entradas: EntradaIG[], db: SupabaseClient | null): Promise<ResultadoIG> {
  return procesarMessenger(INSTAGRAM, entradas, db);
}
