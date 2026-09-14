import net from "net";

/**
 * Vencimiento del dominio dlsremodelaciones.cl en NIC Chile.
 *
 * Si el dominio vence, el sitio, el correo contacto@ y todo lo que depende de
 * él se apaga de un día para otro — y NIC avisa a un correo que puede no estar
 * mirando nadie. Se consulta el whois oficial (puerto 43) una vez al día.
 */

export const DOMINIO = "dlsremodelaciones.cl";
/** Con cuántos días de anticipación se avisa. */
export const DIAS_AVISO = 45;

/** Lee "Expiration date: 2028-09-03 20:47:23 CLST" del texto del whois de NIC Chile. */
export function leerVencimiento(whois: string): string | null {
  return whois.match(/Expiration date:\s*(\d{4}-\d{2}-\d{2})/i)?.[1] ?? null;
}

export function diasHasta(fecha: string, ahora: Date): number {
  return Math.floor((Date.parse(fecha + "T00:00:00Z") - ahora.getTime()) / 86_400_000);
}

/** Consulta whois.nic.cl. Nunca lanza: devuelve null si no pudo. */
export function consultarWhois(dominio = DOMINIO, plazoMs = 8000): Promise<string | null> {
  return new Promise((listo) => {
    let texto = "";
    let terminado = false;
    const fin = (v: string | null) => {
      if (terminado) return;
      terminado = true;
      socket.destroy();
      listo(v);
    };
    const socket = net.connect(43, "whois.nic.cl", () => socket.write(dominio + "\r\n"));
    socket.setTimeout(plazoMs, () => fin(texto || null));
    socket.on("data", (c) => (texto += c.toString("utf8")));
    socket.on("end", () => fin(texto));
    socket.on("error", () => fin(null));
  });
}
