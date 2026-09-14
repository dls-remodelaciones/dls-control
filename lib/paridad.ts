import type { ConfigNegocio } from "@/lib/negocio";

/**
 * ¿El sitio y el panel califican con las mismas reglas?
 *
 * El puntaje se calcula en dos lugares: en el navegador del cliente (con
 * `config/negocio.json` del sitio) y en el panel (con `lib/negocio.ts`). Si un
 * día se cambian los tramos o los pesos en uno y no en el otro, el chatbot le
 * muestra al cliente una cosa y el panel guarda otra, sin error en ninguna
 * parte. La revisión diaria compara las dos y lista cada diferencia.
 */

type Json = Record<string, unknown>;
const num = (v: unknown) => (typeof v === "number" ? v : Number(v));

export function diferenciasConfig(sitio: Json, panel: ConfigNegocio): string[] {
  const d: string[] = [];
  const comparar = (nombre: string, a: unknown, b: unknown) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) d.push(`${nombre}: sitio ${JSON.stringify(a)} ≠ panel ${JSON.stringify(b)}`);
  };

  const s = (sitio.scoring ?? {}) as Json;
  comparar("pesos", s.pesos, panel.pesos);
  comparar("umbrales", s.umbrales, panel.umbrales);
  for (const k of ["presupuesto", "plazo", "comuna", "propiedad", "superficie"] as const) {
    comparar(`puntos.${k}`, s[k], panel.puntos[k]);
  }
  const inter = (s.interaccion ?? {}) as Json;
  comparar(
    "puntos.interaccion",
    { fotos: num(inter.subio_fotos), cotizador: num(inter.termino_cotizador), followup: num(inter.respondio_followup) },
    panel.puntos.interaccion,
  );

  const cob = (sitio.cobertura ?? {}) as Json;
  const ordenar = (v: unknown) => (Array.isArray(v) ? [...v].map(String).sort() : v);
  comparar("comunas principales", ordenar(cob.comunas_principales), ordenar(panel.comunas_principales));
  comparar("comunas secundarias", ordenar(cob.comunas_secundarias), ordenar(panel.comunas_secundarias));

  const tipos = (sitio.tipos_proyecto ?? {}) as Record<string, Json>;
  const claves = new Set([...Object.keys(tipos), ...Object.keys(panel.tipos)]);
  for (const k of claves) {
    const ts = tipos[k];
    const tp = panel.tipos[k as keyof ConfigNegocio["tipos"]];
    if (!ts || !tp) {
      d.push(`tipo ${k}: existe solo en ${ts ? "el sitio" : "el panel"}`);
      continue;
    }
    comparar(`${k}.uf_m2`, num(ts.uf_m2), tp.uf_m2);
    const sup = (ts.superficie_coherente ?? {}) as Json;
    comparar(`${k}.superficie`, { min: num(sup.min), max: num(sup.max) }, tp.superficie);
    const rangos = Array.isArray(ts.rangos_presupuesto) ? (ts.rangos_presupuesto as Json[]).map((r) => String(r.label)) : [];
    comparar(`${k}.tramos`, rangos, tp.rangos);
  }
  return d;
}
