/**
 * Comunas escritas siempre igual.
 *
 * Los clientes escriben "las condes", "LAS CONDES", "Ñuñoa", "nunoa". El puntaje
 * ya las entendía (compara sin tildes), pero en el panel, el Excel, la búsqueda y
 * el resumen semanal aparecían como comunas distintas. Al guardar se lleva al
 * nombre oficial si es de la Región Metropolitana, y si no, a mayúscula inicial.
 */

/** Las 52 comunas de la Región Metropolitana, con su nombre oficial. */
export const COMUNAS_RM = [
  "Alhué", "Buin", "Calera de Tango", "Cerrillos", "Cerro Navia", "Colina", "Conchalí", "Curacaví",
  "El Bosque", "El Monte", "Estación Central", "Huechuraba", "Independencia", "Isla de Maipo",
  "La Cisterna", "La Florida", "La Granja", "La Pintana", "La Reina", "Lampa", "Las Condes",
  "Lo Barnechea", "Lo Espejo", "Lo Prado", "Macul", "Maipú", "María Pinto", "Melipilla", "Ñuñoa",
  "Padre Hurtado", "Paine", "Pedro Aguirre Cerda", "Peñaflor", "Peñalolén", "Pirque", "Providencia",
  "Pudahuel", "Puente Alto", "Quilicura", "Quinta Normal", "Recoleta", "Renca", "San Bernardo",
  "San Joaquín", "San José de Maipo", "San Miguel", "San Pedro", "San Ramón", "Santiago", "Talagante",
  "Tiltil", "Vitacura",
];

const plano = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const PORNOMBRE = new Map(COMUNAS_RM.map((c) => [plano(c), c]));
// Formas frecuentes que no calzan letra por letra.
const ALIAS: Record<string, string> = {
  "santiago centro": "Santiago",
  stgo: "Santiago",
  "stgo centro": "Santiago",
  "til til": "Tiltil",
  "p a c": "Pedro Aguirre Cerda",
  pac: "Pedro Aguirre Cerda",
  "est central": "Estación Central",
};

const MENORES = new Set(["de", "del", "la", "las", "los", "el", "y"]);

export function normalizarComuna(v: unknown): string {
  const crudo = String(v ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (!crudo) return "";
  const p = plano(crudo);
  const oficial = PORNOMBRE.get(p) ?? ALIAS[p];
  if (oficial) return oficial;
  // Fuera de la lista (otra región o algo que no reconocemos): solo mayúscula inicial.
  return crudo
    .toLocaleLowerCase("es-CL")
    .split(" ")
    .map((w, i) => (i > 0 && MENORES.has(w) ? w : w.charAt(0).toLocaleUpperCase("es-CL") + w.slice(1)))
    .join(" ");
}
