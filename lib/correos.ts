/**
 * Cuántos correos lleva el sitio en el ciclo de EmailJS.
 *
 * El plan gratis de EmailJS permite 200 envíos por ciclo, y al llegar al tope
 * los correos dejan de salir **sin aviso**: el cliente no recibe su cotización
 * y nadie se entera. EmailJS no deja consultar el uso sin una clave privada, así
 * que el sitio le cuenta al panel cada envío que intenta (EmailJS cobra el
 * intento, salga bien o no) y la revisión diaria avisa antes del tope.
 *
 * El conteo vive en la tabla `config`, clave `emailjs_uso`.
 */

export const CLAVE = "emailjs_uso";

export const limite = () => Number(process.env.EMAILJS_LIMITE) || 200;
/** Día del mes en que EmailJS reinicia el cupo ("Resets on Oct 9"). */
export const diaReinicio = () => Number(process.env.EMAILJS_DIA_REINICIO) || 9;

/** Fecha (AAAA-MM-DD) en que empezó el ciclo vigente. */
export function inicioDeCiclo(ahora: Date, dia = diaReinicio()): string {
  let a = ahora.getUTCFullYear();
  let m = ahora.getUTCMonth();
  if (ahora.getUTCDate() < dia) {
    m -= 1;
    if (m < 0) {
      m = 11;
      a -= 1;
    }
  }
  return `${a}-${String(m + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** Fecha (AAAA-MM-DD) del próximo reinicio. */
export function proximoReinicio(ahora: Date, dia = diaReinicio()): string {
  const [a, m] = inicioDeCiclo(ahora, dia).split("-").map(Number);
  const siguiente = new Date(Date.UTC(a, m, dia)); // m ya es el mes siguiente en base 0
  return siguiente.toISOString().slice(0, 10);
}

export interface Uso {
  ciclo: string;
  cantidad: number;
}

/** Suma `n` al uso guardado, reiniciando si cambió el ciclo. Función pura. */
export function sumar(previo: Uso | null, n: number, ahora: Date): Uso {
  const ciclo = inicioDeCiclo(ahora);
  const base = previo && previo.ciclo === ciclo ? previo.cantidad : 0;
  return { ciclo, cantidad: base + n };
}

/** Uso vigente: si lo guardado es de un ciclo anterior, cuenta como cero. */
export function vigente(guardado: Uso | null, ahora: Date): Uso {
  const ciclo = inicioDeCiclo(ahora);
  return guardado && guardado.ciclo === ciclo ? guardado : { ciclo, cantidad: 0 };
}
