/**
 * Diagnóstico de fichas dañadas por las fallas corregidas el 13-sep-2026.
 *
 * Tres fallas del registro de leads borraban o pisaban datos: el nombre se
 * reemplazaba por "Sin nombre", la fuente original se pisaba con la del último
 * envío, y los puntos por completar el cotizador se perdían al recalcular. Se
 * corrigieron hacia adelante; las fichas que ya estaban dañadas siguen igual.
 *
 * Esto NO cambia nada. Compara cada ficha con su historial (cada envío guarda
 * el formulario completo en `mensajes`) y propone qué recuperar, para que
 * Daniel lo apruebe antes de tocar un solo dato.
 */

export interface LeadDiag {
  id: string;
  nombre: string | null;
  fuente_original: string | null;
  desglose: { senal?: string; detalle?: string }[] | null;
}

export interface MensajeDiag {
  lead_id: string;
  canal: string | null;
  cuerpo: string | null;
  creado: string;
}

export interface Propuesta {
  lead_id: string;
  nombre_actual: string;
  cambios: { campo: string; ahora: string; propuesto: string; por_que: string }[];
}

function leerEnvio(cuerpo: string | null): Record<string, unknown> | null {
  if (!cuerpo || !cuerpo.trim().startsWith("{")) return null;
  try {
    const j = JSON.parse(cuerpo);
    return j && typeof j === "object" ? (j as Record<string, unknown>) : null;
  } catch {
    return null; // cuerpos de más de 4.000 caracteres quedaron cortados
  }
}

export function diagnosticar(leads: LeadDiag[], mensajes: MensajeDiag[], conCotizacion: Set<string>): Propuesta[] {
  const porLead = new Map<string, MensajeDiag[]>();
  for (const m of mensajes) {
    if (!porLead.has(m.lead_id)) porLead.set(m.lead_id, []);
    porLead.get(m.lead_id)!.push(m);
  }

  const salida: Propuesta[] = [];
  for (const l of leads) {
    const historial = (porLead.get(l.id) ?? []).sort((a, b) => Date.parse(a.creado) - Date.parse(b.creado));
    const envios = historial.map((m) => ({ m, j: leerEnvio(m.cuerpo) })).filter((x) => x.j);
    const cambios: Propuesta["cambios"] = [];

    // 1. Nombre borrado: la ficha dice "Sin nombre" pero algún envío traía uno.
    const nombreActual = (l.nombre ?? "").trim();
    if (!nombreActual || nombreActual === "Sin nombre") {
      const conNombre = [...envios].reverse().find((x) => String(x.j!.nombre ?? "").trim());
      if (conNombre) {
        cambios.push({
          campo: "nombre",
          ahora: nombreActual || "(vacío)",
          propuesto: String(conNombre.j!.nombre).trim().slice(0, 120),
          por_que: `Lo escribió en un envío del ${conNombre.m.creado.slice(0, 10)}.`,
        });
      }
    }

    // 2. Fuente original pisada: la del primer envío que la trae.
    const primera = envios.find((x) => String(x.j!.fuente_original ?? "").trim());
    const fuentePrimera = primera ? String(primera.j!.fuente_original).trim().slice(0, 200) : "";
    if (fuentePrimera && fuentePrimera !== (l.fuente_original ?? "")) {
      cambios.push({
        campo: "fuente_original",
        ahora: l.fuente_original ?? "(vacía)",
        propuesto: fuentePrimera,
        por_que: `Es la del primer envío (${primera!.m.creado.slice(0, 10)}).`,
      });
    }

    // 3. Puntos del cotizador perdidos: terminó el cotizador pero el desglose no lo cuenta.
    const detalle = String((l.desglose ?? []).find((s) => s?.senal === "Interacción")?.detalle ?? "");
    const terminoCotizador =
      conCotizacion.has(l.id) || envios.some((x) => x.m.canal === "cotizador" && x.j!.cotizacion);
    if (terminoCotizador && !detalle.includes("cotizador")) {
      cambios.push({
        campo: "puntaje",
        ahora: "sin puntos de cotizador",
        propuesto: "recalcular sumando el cotizador (+2)",
        por_que: "Tiene una cotización completa registrada.",
      });
    }

    if (cambios.length) salida.push({ lead_id: l.id, nombre_actual: nombreActual || "Sin nombre", cambios });
  }
  return salida;
}
