import { DIAS_AVISO, DOMINIO, diasHasta } from "@/lib/dominio";

/**
 * Lo último que se supo del dominio, para que el chequeo no quede ciego.
 *
 * NIC Chile no siempre contesta el whois (pasó el 16-sep-2026). Hasta hoy, ese
 * día el chequeo decía "se reintenta mañana" y quedaba en verde. Si NIC dejara
 * de responder para siempre —o si el puerto 43 se cerrara desde Vercel— el aviso
 * de vencimiento no llegaría nunca y nadie lo notaría: el dominio se apagaría
 * con el sitio y el correo contacto@ adentro.
 *
 * Por eso la última consulta buena se guarda en `config.dominio_visto` y, cuando
 * NIC no responde, se responde con esa memoria: se sigue avisando si la fecha
 * guardada está cerca, y se avisa aparte si ya llevamos demasiados días sin
 * poder confirmar nada.
 */

export const CLAVE = "dominio_visto";

/** Días sin poder consultar NIC antes de tratarlo como un problema. */
export const DIAS_SIN_VER = 7;

export interface DominioVisto {
  /** Fecha de vencimiento leída del whois (AAAA-MM-DD). */
  vence: string;
  /** Cuándo se pudo leer por última vez (ISO). */
  visto: string;
}

export interface EstadoDominio {
  ok: boolean;
  detalle: string;
  /** Lo que hay que guardar en config, o null si no hay nada nuevo que guardar. */
  guardar: DominioVisto | null;
}

/**
 * El chequeo "Dominio" a partir de la respuesta de hoy y de lo guardado.
 *
 * `vence` es lo leído hoy (null si NIC no contestó) y `previo` lo que quedó
 * guardado la última vez que sí contestó.
 */
export function estadoDominio(vence: string | null, previo: DominioVisto | null, ahora: Date): EstadoDominio {
  if (vence) {
    const dias = diasHasta(vence, ahora);
    return {
      ok: dias > DIAS_AVISO,
      detalle:
        dias > DIAS_AVISO
          ? `${DOMINIO} vence el ${vence} (en ${dias} días).`
          : dias >= 0
            ? `${DOMINIO} vence el ${vence}: quedan ${dias} días. Renuévalo en nic.cl o se apagan el sitio y el correo.`
            : `${DOMINIO} VENCIÓ el ${vence}. Renuévalo en nic.cl de inmediato.`,
      guardar: { vence, visto: ahora.toISOString() },
    };
  }

  if (!previo) {
    return {
      ok: false,
      detalle: `Nunca se ha podido consultar el vencimiento de ${DOMINIO} en NIC Chile. Revísalo a mano en nic.cl.`,
      guardar: null,
    };
  }

  const diasSinVer = Math.floor((ahora.getTime() - Date.parse(previo.visto)) / 86_400_000);
  const dias = diasHasta(previo.vence, ahora);
  // Aunque NIC no conteste, la fecha guardada sigue corriendo: si está cerca, se avisa igual.
  if (dias <= DIAS_AVISO) {
    return {
      ok: false,
      detalle:
        dias >= 0
          ? `${DOMINIO} vence el ${previo.vence}: quedan ${dias} días (dato guardado; NIC no responde hoy). Renuévalo en nic.cl.`
          : `${DOMINIO} VENCIÓ el ${previo.vence} según el último dato guardado. Revísalo en nic.cl de inmediato.`,
      guardar: null,
    };
  }

  return {
    ok: diasSinVer < DIAS_SIN_VER,
    detalle:
      diasSinVer < DIAS_SIN_VER
        ? `NIC Chile no respondió hoy. Según la última consulta (hace ${diasSinVer} día(s)), ${DOMINIO} vence el ${previo.vence}.`
        : `Llevamos ${diasSinVer} días sin poder consultar a NIC Chile. El último dato dice que ${DOMINIO} vence el ${previo.vence}; confírmalo a mano en nic.cl.`,
    guardar: null,
  };
}
