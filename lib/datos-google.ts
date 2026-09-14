/**
 * Los datos para Google de la portada (`<script type="application/ld+json">`).
 *
 * Son los que Google usa para mostrar el negocio con su teléfono, dirección y
 * preguntas frecuentes. Si alguien edita index.html y rompe una coma, el JSON
 * deja de valer y Google los ignora sin avisar a nadie; si el teléfono queda
 * viejo, los clientes llaman a un número que ya no es. La revisión diaria
 * (`lib/salud.ts`) los lee con esta función.
 */
export interface RevisionDatosGoogle {
  bloques: number;
  invalidos: number;
  /** Solo dígitos, sin "+" (ej. "56956381974"); vacío si ningún bloque trae teléfono. */
  telefono: string;
  tienePreguntas: boolean;
}

export function revisarDatosGoogle(html: string): RevisionDatosGoogle {
  const r: RevisionDatosGoogle = { bloques: 0, invalidos: 0, telefono: "", tienePreguntas: false };
  const patron = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(patron)) {
    r.bloques++;
    let dato: unknown;
    try {
      dato = JSON.parse(m[1]);
    } catch {
      r.invalidos++;
      continue;
    }
    const lista = Array.isArray(dato) ? dato : [dato];
    for (const d of lista as Record<string, unknown>[]) {
      if (!d || typeof d !== "object") continue;
      if (!r.telefono && typeof d.telephone === "string") r.telefono = d.telephone.replace(/\D/g, "");
      if (d["@type"] === "FAQPage") r.tienePreguntas = true;
    }
  }
  return r;
}
