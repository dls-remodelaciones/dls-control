import { VENTANA_HORAS } from "@/lib/whatsapp";

/**
 * ¿A quién se le está por cerrar la ventana de WhatsApp sin respuesta?
 *
 * Meta deja escribir texto libre durante 24 horas desde el último mensaje de la
 * persona. Pasado eso solo se pueden mandar plantillas aprobadas, que suenan a
 * sistema. Un cliente que escribió "quiero remodelar mi cocina" y recibe una
 * plantilla un día después es un cliente medio perdido.
 *
 * La regla: se avisa cuando al último mensaje sin respuesta le quedan entre
 * `AVISO_DESDE - 1` y `AVISO_DESDE` horas. Con el cron cada hora, esa franja de
 * una hora se toca exactamente una vez por mensaje, así que no hace falta
 * guardar en ninguna parte "ya avisé".
 */

export const AVISO_DESDE = 3;

export interface MensajeWA {
  lead_id: string | null;
  direccion: string;
  cuerpo: string | null;
  creado: string;
}

export interface PorVencer {
  lead_id: string;
  cuerpo: string;
  horas_restantes: number;
}

export function porVencer(mensajes: MensajeWA[], ahora = Date.now()): PorVencer[] {
  // Último mensaje de cada lead, sin importar el orden en que vengan.
  const ultimo = new Map<string, MensajeWA>();
  for (const m of mensajes) {
    if (!m.lead_id) continue;
    const previo = ultimo.get(m.lead_id);
    if (!previo || Date.parse(m.creado) > Date.parse(previo.creado)) ultimo.set(m.lead_id, m);
  }

  const salida: PorVencer[] = [];
  for (const [lead_id, m] of ultimo) {
    if (m.direccion !== "entrante") continue; // ya se le respondió
    const restantes = VENTANA_HORAS - (ahora - Date.parse(m.creado)) / 3_600_000;
    if (restantes > AVISO_DESDE - 1 && restantes <= AVISO_DESDE) {
      salida.push({ lead_id, cuerpo: m.cuerpo ?? "", horas_restantes: Math.round(restantes * 10) / 10 });
    }
  }
  return salida;
}
