/**
 * Cuándo llegó, en palabras que no obligan a calcular.
 *
 * "hace 14 h" sirve para lo que urge, pero no para comparar: puestos uno al
 * lado del otro, "hace 14 h" y "hace 2 d" no dejan claro el orden de llegada de
 * un golpe, y era justo lo que se perdía en la bandeja. Una hora concreta sí:
 * "hoy 14:32" se ordena en la cabeza sin restar nada.
 *
 * `ahora` se puede inyectar para poder probar los bordes (medianoche, cambio de
 * año) sin depender del reloj de la máquina.
 */

const DIAS = 86_400_000;

export function cuandoLlego(iso: string | null | undefined, ahora: Date = new Date()): string {
  const t = Date.parse(String(iso ?? ""));
  if (!Number.isFinite(t)) return "";
  const f = new Date(t);

  const hora = f.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", hour12: false });

  // Se compara por día calendario, no por horas transcurridas: a las 00:30 un
  // mensaje de las 23:50 es "ayer", aunque hayan pasado 40 minutos.
  const diaDe = (d: Date) => Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / DIAS);
  const diferencia = diaDe(ahora) - diaDe(f);

  if (diferencia === 0) return `hoy ${hora}`;
  if (diferencia === 1) return `ayer ${hora}`;

  const fecha = f.toLocaleDateString("es-CL", { day: "numeric", month: "short" }).replace(".", "");
  // Del mismo año no hace falta repetirlo; de otro año, omitirlo engaña.
  return f.getFullYear() === ahora.getFullYear() ? `${fecha} ${hora}` : `${fecha} ${f.getFullYear()}`;
}
