import { ventanaAbierta, VENTANA_HORAS } from "@/lib/ventana";

/**
 * Cuánto apura contestarle a alguien que escribió y sigue esperando.
 *
 * El panel mostraba "hace 3 h" y nada más. Ese dato no dice lo único que de
 * verdad importa: que Meta cierra la conversación a las 24 horas y después ya
 * no se puede responder con texto libre por ninguno de los tres canales
 * (WhatsApp, Instagram, Messenger). Un lead que lleva 22 horas esperando no es
 * "un poco más viejo" que uno de 3 horas: es uno que se pierde en dos horas.
 *
 * Los cortes son de oficio, no matemáticos:
 *  - `cerrada`  la ventana ya venció. Solo queda llamar o mandar plantilla.
 *  - `ultimas`  quedan 4 horas o menos. Esto es lo que hay que hacer AHORA.
 *  - `hoy`      quedan menos de 12 horas: cae dentro de la jornada.
 *  - `abierta`  recién escribió, hay tiempo.
 */

export type Nivel = "cerrada" | "ultimas" | "hoy" | "abierta";

export interface Urgencia {
  nivel: Nivel;
  horas_restantes: number;
  /** Lo que se muestra en la tarjeta, ya redactado. */
  texto: string;
  /** Si merece el color de alarma del panel. */
  alarma: boolean;
}

const UMBRAL_ULTIMAS = 4;
const UMBRAL_HOY = 12;

export function urgenciaDeEspera(esperaDesde: string | null | undefined): Urgencia {
  const { abierta, horas_restantes } = ventanaAbierta(esperaDesde);

  if (!abierta) {
    return {
      nivel: "cerrada",
      horas_restantes: 0,
      texto: `Pasaron ${VENTANA_HORAS} h · solo por llamada`,
      alarma: true,
    };
  }
  if (horas_restantes <= UMBRAL_ULTIMAS) {
    return {
      nivel: "ultimas",
      horas_restantes,
      texto: `Quedan ${enPalabras(horas_restantes)} para responder`,
      alarma: true,
    };
  }
  if (horas_restantes < UMBRAL_HOY) {
    return {
      nivel: "hoy",
      horas_restantes,
      texto: `Quedan ${enPalabras(horas_restantes)}`,
      alarma: false,
    };
  }
  return { nivel: "abierta", horas_restantes, texto: "Puedes responder", alarma: false };
}

/**
 * "40 min" en vez de "0,7 h".
 *
 * Bajo una hora, las horas con decimal no se leen: cuando quedan cuarenta
 * minutos para que se cierre la ventana hay que entenderlo sin traducir.
 */
function enPalabras(horas: number): string {
  if (horas < 1) return `${Math.max(1, Math.round(horas * 60))} min`;
  const redondo = Math.round(horas * 10) / 10;
  return `${Number.isInteger(redondo) ? redondo : redondo.toFixed(1).replace(".", ",")} h`;
}
