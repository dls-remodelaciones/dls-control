/**
 * Límites contra inundaciones en la entrada de leads.
 *
 * El token del webhook viaja en el JavaScript público del sitio, así que
 * cualquiera puede mandar envíos falsos en bucle. Sin límite, un script de diez
 * líneas llena la bandeja, el celular de avisos y el cupo de correos.
 *
 * Qué NO es: una defensa perfecta. La memoria vive en cada instancia del
 * servidor, así que un ataque repartido entre muchas instancias o muchas IP pasa
 * en parte. Contra lo común — alguien probando desde su computador o un bot
 * simple — alcanza. Si un día hace falta más, el siguiente paso es el firewall
 * de Vercel, no hacer esto más complicado.
 *
 * Por qué los topes son generosos: en Chile los celulares salen a internet por
 * IP compartidas del operador (CGNAT). Un tope bajo por IP bloquearía a clientes
 * reales que solo comparten operador. Y el cotizador manda varios envíos por
 * visita (uno por avance, más un rescate si la persona se va a mitad).
 */

export class Ventana {
  private golpes = new Map<string, number[]>();

  constructor(
    private readonly maximo: number,
    private readonly ms: number,
  ) {}

  /** Registra un intento y dice si entra dentro del límite. */
  permitir(clave: string, ahora = Date.now()): boolean {
    const desde = ahora - this.ms;
    const lista = (this.golpes.get(clave) ?? []).filter((t) => t > desde);
    const permitido = lista.length < this.maximo;
    if (permitido) lista.push(ahora);
    this.golpes.set(clave, lista);
    // Limpieza ocasional para que el mapa no crezca sin fin con IP que no vuelven.
    if (this.golpes.size > 5000) {
      for (const [k, v] of this.golpes) if (!v.some((t) => t > desde)) this.golpes.delete(k);
    }
    return permitido;
  }
}

const DIEZ_MIN = 10 * 60_000;

/** Envíos por IP con Origin del sitio. */
export const porIpDelSitio = new Ventana(60, DIEZ_MIN);
/** Envíos por IP SIN Origin (sendBeacon viejo, scripts): tope más bajo. */
export const porIpSinOrigen = new Ventana(10, DIEZ_MIN);
/** Avisos de "lead nuevo" al celular, en total. */
export const avisosDeLead = new Ventana(8, DIEZ_MIN);

/** IP del visitante según Vercel. */
export function ipDe(headers: Headers): string {
  return (
    headers.get("x-real-ip") ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "desconocida"
  );
}

/** Tamaño máximo de un envío. Un lead real pesa unos pocos KB. */
export const MAX_BYTES = 100_000;
