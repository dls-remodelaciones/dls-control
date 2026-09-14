/**
 * Mensajes de WhatsApp que Meta no pudo entregar.
 *
 * Cuando Daniel responde desde el panel, Meta acepta el envío al instante — el
 * panel dice "enviado" — pero la entrega real se decide después y llega por el
 * webhook como un "status". Si falla (el número no tiene WhatsApp, pasaron las
 * 24 horas, el cliente bloqueó al negocio), nadie se enteraba: el cliente nunca
 * recibió la respuesta y Daniel creía que sí.
 */

export interface EstadoWA {
  id?: string;
  status?: string;
  recipient_id?: string;
  errors?: { code?: number; title?: string; message?: string; error_data?: { details?: string } }[];
}

/** Motivos frecuentes en palabras de Daniel. El resto se muestra como lo dice Meta. */
const MOTIVOS: Record<number, string> = {
  131047: "pasaron más de 24 horas desde su último mensaje; hay que usar una plantilla",
  131026: "el número no tiene WhatsApp o no puede recibir mensajes",
  131049: "Meta lo frenó para no saturar al cliente con mensajes de empresas",
  131050: "el cliente pidió no recibir mensajes de marketing",
  131031: "la cuenta de WhatsApp del negocio está restringida",
  131051: "tipo de mensaje no soportado",
  130472: "el número del cliente está en un experimento de Meta y no recibe este mensaje",
};

export function fallidos(estados: EstadoWA[]): { telefono: string; motivo: string; codigo: number | null }[] {
  return estados
    .filter((e) => e.status === "failed" && e.recipient_id)
    .map((e) => {
      const err = e.errors?.[0];
      const codigo = typeof err?.code === "number" ? err.code : null;
      const motivo =
        (codigo !== null && MOTIVOS[codigo]) || err?.error_data?.details || err?.message || err?.title || "Meta no dio el motivo";
      return { telefono: String(e.recipient_id), motivo, codigo };
    });
}
