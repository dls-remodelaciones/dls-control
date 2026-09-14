/**
 * Leads a un archivo que Excel abre directo (CSV).
 *
 * Detalles que importan con Excel en Chile: separador `;` (la coma es el
 * decimal), BOM al inicio para que las tildes no salgan rotas, y ningún valor
 * puede empezar con `=`, `+`, `-` o `@`: Excel los toma como fórmula, y un
 * cliente que escribe "=HYPERLINK(...)" como nombre podría colar una.
 */

type Fila = Record<string, unknown>;

const COLUMNAS: [string, (f: Fila) => unknown][] = [
  ["Fecha", (f) => String(f.creado ?? "").slice(0, 10)],
  ["Nombre", (f) => f.nombre],
  ["Teléfono", (f) => f.telefono],
  ["Correo", (f) => f.email],
  ["Tipo de proyecto", (f) => f.tipo_proyecto],
  ["Comuna", (f) => f.comuna],
  ["m²", (f) => f.superficie_m2],
  ["Presupuesto", (f) => f.rango_presupuesto],
  ["Plazo", (f) => f.plazo],
  ["Propiedad", (f) => f.propiedad],
  ["Clase", (f) => f.clasificacion],
  ["Puntaje", (f) => (typeof f.score === "number" ? String(f.score).replace(".", ",") : f.score)],
  ["Estado", (f) => f.estado],
  ["Etiqueta", (f) => f.etiqueta],
  ["Canal", (f) => f.canal],
  ["Fuente original", (f) => f.fuente_original],
  ["Nota interna", (f) => f.nota_interna],
  ["Próxima acción", (f) => f.proxima_accion],
  ["Fecha próxima acción", (f) => (f.fecha_proxima_accion ? new Date(String(f.fecha_proxima_accion)).toLocaleString("es-CL", { timeZone: "America/Santiago" }) : "")],
  ["Motivo no prosperó", (f) => f.motivo_no_prospero],
  ["Todos sus proyectos", (f) => proyectos(f.proyectos)],
  ["Última actividad", (f) => String(f.ultima_actividad ?? "").slice(0, 10)],
];

/** "Cocina 20 m² Ñuñoa · Baño 6 m² Ñuñoa": una persona puede pedir varias cosas. */
function proyectos(v: unknown): string {
  if (!Array.isArray(v)) return "";
  return (v as Record<string, unknown>[])
    .map((p) => [p.tipo, p.m2 ? `${p.m2} m²` : "", p.comuna].filter(Boolean).join(" "))
    .filter(Boolean)
    .join(" · ");
}

export function celda(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function aCsv(filas: Fila[]): string {
  const lineas = [COLUMNAS.map(([t]) => celda(t)).join(";")];
  for (const f of filas) lineas.push(COLUMNAS.map(([, g]) => celda(g(f))).join(";"));
  return "﻿" + lineas.join("\r\n") + "\r\n";
}
