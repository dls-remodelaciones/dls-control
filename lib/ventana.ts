/**
 * La ventana de 24 horas de Meta, que rige igual en WhatsApp, Instagram y
 * Messenger: solo se puede escribir texto libre dentro de las 24 horas
 * siguientes al último mensaje de la persona.
 *
 * Vive aparte de `lib/whatsapp.ts` para que también la pueda usar la pantalla:
 * saber si la ventana está abierta ANTES de escribir evita redactar una
 * respuesta completa para que recién al enviarla aparezca que ya no se puede.
 * La regla es una sola y se calcula en un solo lugar.
 */

export const VENTANA_HORAS = 24;

/**
 * ¿Se puede escribir texto libre a esta persona ahora?
 *
 * `ultimoEntrante` es la fecha del último mensaje que ELLA mandó. Si no hay
 * ninguno, la ventana nunca se abrió: Meta rechazaría el envío.
 */
export function ventanaAbierta(ultimoEntrante: string | null | undefined): {
  abierta: boolean;
  horas_restantes: number;
} {
  if (!ultimoEntrante) return { abierta: false, horas_restantes: 0 };
  const t = Date.parse(ultimoEntrante);
  if (!Number.isFinite(t)) return { abierta: false, horas_restantes: 0 };
  const transcurridas = (Date.now() - t) / 3_600_000;
  const restantes = VENTANA_HORAS - transcurridas;
  return {
    abierta: restantes > 0,
    horas_restantes: restantes > 0 ? Math.round(restantes * 10) / 10 : 0,
  };
}
