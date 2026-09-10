/**
 * Fuente única de verdad del negocio DLS.
 *
 * Port de `dls-lead.js` (probado en producción en dlsremodelaciones.cl) y de la
 * lógica de precios de `dls-cotizador-embed.js`. Antes vivían en dos archivos
 * distintos: duplicar precios es el error más caro que se puede cometer acá.
 *
 * Los valores se pueden sobrescribir desde la tabla `config` de Supabase sin
 * tocar código — ver `cargarConfig()`.
 */

export type TipoProyecto =
  | "bano" | "cocina" | "quincho" | "estacionamiento" | "walking_closet" | "casa_completa";

export type Plazo = "inmediato" | "1-3_meses" | "3-6_meses" | "explorando";
export type Propiedad = "propia" | "por_comprar" | "arriendo";
export type Clase = "A" | "B" | "C" | "D";

export interface Lead {
  id?: string;
  canal: string;
  nombre: string;
  telefono: string;          // 56912345678, sin '+'
  telefono_crudo?: string;
  email: string;
  tipo_proyecto: TipoProyecto | "";
  comuna: string;
  superficie_m2: number;
  rango_presupuesto: string;
  financiamiento?: string;
  plazo: Plazo | "";
  propiedad: Propiedad | "";
  fotos?: unknown[];
  termino_cotizador?: boolean;
  respondio_followup?: boolean;
}

export interface Senal { senal: string; puntos: number; max: number; detalle: string }

export interface Calificacion {
  score: number;
  clasificacion: Clase;
  desglose: Senal[];
  apto_para_llamar: boolean;
  motivo: string;
  accion: string;
}

/* ── Configuración de negocio ───────────────────────────────────────────────
   Editable por Daniel. Si cambia en Supabase, `cargarConfig` la reemplaza. */

export interface ConfigNegocio {
  comunas_principales: string[];
  comunas_secundarias: string[];
  tipos: Record<TipoProyecto, {
    label: string;
    uf_m2: number;
    superficie: { min: number; max: number };
    rangos: string[];          // [bajo, en_rango, sobre] — el orden importa
  }>;
  pesos: Record<"presupuesto"|"plazo"|"comuna"|"propiedad"|"superficie"|"completitud"|"interaccion", number>;
  puntos: {
    presupuesto: Record<"sobre"|"en_rango"|"bajo"|"no_se", number>;
    plazo: Record<Plazo, number>;
    comuna: Record<"principal"|"secundaria"|"fuera_radio", number>;
    propiedad: Record<Propiedad, number>;
    superficie: { coherente: number; incoherente: number };
    interaccion: { fotos: number; cotizador: number; followup: number };
  };
  umbrales: { A: number; B: number; C: number };
  uf_clp_piso: number;
}

export const CONFIG_POR_DEFECTO: ConfigNegocio = {
  comunas_principales: ["las condes","vitacura","lo barnechea","providencia","nunoa","la reina"],
  comunas_secundarias: [
    "santiago","macul","penalolen","san miguel","la florida","huechuraba","recoleta",
    "independencia","quilicura","colina","chicureo","estacion central","maipu","pudahuel",
    "cerrillos","san joaquin","la cisterna","puente alto",
  ],
  tipos: {
    bano: { label: "Baño", uf_m2: 14, superficie: { min: 2, max: 30 },
      rangos: ["Menos de $5.000.000", "$5.000.000 - $7.000.000", "Más de $7.000.000"] },
    cocina: { label: "Cocina", uf_m2: 12, superficie: { min: 4, max: 60 },
      rangos: ["$15.000.000 - $25.000.000", "$25.000.000 - $30.000.000", "Más de $30.000.000"] },
    quincho: { label: "Quincho", uf_m2: 28, superficie: { min: 10, max: 150 },
      rangos: ["$25.000.000 - $35.000.000", "$35.000.000 - $45.000.000", "Más de $45.000.000"] },
    estacionamiento: { label: "Estacionamiento", uf_m2: 4, superficie: { min: 10, max: 100 },
      rangos: ["$10.000.000 - $13.000.000", "$13.000.000 - $16.000.000", "Más de $16.000.000"] },
    walking_closet: { label: "Walking Closet", uf_m2: 8, superficie: { min: 3, max: 25 },
      rangos: ["Menos de $6.000.000", "$6.000.000 - $10.000.000", "Más de $10.000.000"] },
    casa_completa: { label: "Departamento / Casa completa", uf_m2: 19, superficie: { min: 30, max: 600 },
      rangos: ["≈1.000 UF", "≈2.000 UF", "3.000 UF o más"] },
  },
  pesos: { presupuesto: 30, plazo: 20, comuna: 15, propiedad: 10, superficie: 10, completitud: 10, interaccion: 5 },
  puntos: {
    presupuesto: { sobre: 30, en_rango: 22, bajo: 8, no_se: 5 },
    plazo: { inmediato: 20, "1-3_meses": 15, "3-6_meses": 8, explorando: 3 },
    comuna: { principal: 15, secundaria: 9, fuera_radio: 0 },
    propiedad: { propia: 10, por_comprar: 6, arriendo: 2 },
    superficie: { coherente: 10, incoherente: 4 },
    interaccion: { fotos: 2, cotizador: 2, followup: 1 },
  },
  umbrales: { A: 75, B: 50, C: 30 },
  uf_clp_piso: 40885.63,
};

let CFG: ConfigNegocio = CONFIG_POR_DEFECTO;
export const config = () => CFG;
export function aplicarConfig(parcial: Partial<ConfigNegocio> | null | undefined) {
  if (parcial && typeof parcial === "object") CFG = { ...CFG, ...parcial };
  return CFG;
}

/* ── Normalizadores ─────────────────────────────────────────────────────── */

export const slug = (s: unknown): string =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Teléfono chileno → E.164 sin '+'. Devuelve "" si no es válido. */
export function normalizarTelefono(v: unknown): string {
  let d = String(v ?? "").replace(/\D/g, "").replace(/^0+/, "");
  if (d.startsWith("56")) d = d.slice(2);
  if (d.length === 9 && (d[0] === "9" || d[0] === "2")) return "56" + d;
  if (d.length === 8) return "569" + d;
  return "";
}
export const telefonoValido = (v: unknown) => normalizarTelefono(v) !== "";

export const emailValido = (v: unknown) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v ?? "").trim());

/** "18 m2" → 18. Ojo: hay que sacar la unidad antes o queda 182. */
export function normalizarM2(v: unknown): number {
  if (typeof v === "number") return v > 0 ? v : 0;
  const s = String(v ?? "")
    .replace(/m\s*(²|2|ts?2?)\b/gi, " ")
    .replace(/metros?\s*cuadrados?/gi, " ");
  const n = parseFloat(s.replace(/[^\d.,]/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function normalizarTipo(v: unknown): TipoProyecto | "" {
  const s = slug(v);
  if (!s) return "";
  const clave = s.replace(/\s+/g, "_") as TipoProyecto;
  if (clave in CFG.tipos) return clave;
  const alias: [TipoProyecto, RegExp][] = [
    ["bano", /\bbano\b|bath/],
    ["cocina", /cocina|kitchen/],
    ["quincho", /quincho|terraza|asador/],
    ["estacionamiento", /estacionamiento|garage|garaje/],
    ["walking_closet", /closet|vestidor|walking/],
    ["casa_completa", /casa|depto|departamento|apart|completa|completo/],
  ];
  for (const [k, re] of alias) if (re.test(s)) return k;
  return "";
}

export function normalizarPlazo(v: unknown): Plazo | "" {
  const s = slug(v);
  if (!s) return "";
  if (/inmediat|ya|urgente|ahora|este mes|lo antes/.test(s)) return "inmediato";
  if (/1 3|uno a tres|tres meses|3 meses/.test(s)) return "1-3_meses";
  if (/3 6|tres a seis|seis meses|6 meses/.test(s)) return "3-6_meses";
  if (/explor|mirando|averiguando|idea|sin apuro|no se/.test(s)) return "explorando";
  return "";
}

export function normalizarPropiedad(v: unknown): Propiedad | "" {
  const s = slug(v);
  if (!s) return "";
  if (/comprar|comprando/.test(s)) return "por_comprar";
  if (/arrien|arriendo|alquil|rento/.test(s)) return "arriendo";
  if (/propia|propio|mia|mio|dueno/.test(s)) return "propia";
  return "";
}

export function zonaComuna(comuna: unknown): "principal" | "secundaria" | "fuera_radio" | "sin_dato" {
  const s = slug(comuna);
  if (!s) return "sin_dato";
  if (CFG.comunas_principales.some((c) => slug(c) === s)) return "principal";
  if (CFG.comunas_secundarias.some((c) => slug(c) === s)) return "secundaria";
  return "fuera_radio";
}

export function tierPresupuesto(tipo: TipoProyecto | "", etiqueta: unknown): "sobre"|"en_rango"|"bajo"|"no_se" {
  const s = slug(etiqueta);
  if (!s || /no se|no lo se|por definir|sin definir|no tengo/.test(s)) return "no_se";
  const t = tipo ? CFG.tipos[tipo] : null;
  if (!t) return "no_se";
  const i = t.rangos.findIndex((r) => slug(r) === s);
  return i === 0 ? "bajo" : i === 1 ? "en_rango" : i === 2 ? "sobre" : "no_se";
}

/* ── Motor de calificación (Parte 5 de la especificación) ───────────────── */

export function calificar(lead: Lead): Calificacion {
  const { pesos, puntos, umbrales } = CFG;
  const d: Senal[] = [];
  let total = 0;
  const add = (senal: string, p: number, max: number, detalle: string) => {
    total += p;
    d.push({ senal, puntos: p, max, detalle });
  };

  const tier = tierPresupuesto(lead.tipo_proyecto, lead.rango_presupuesto);
  add("Presupuesto", puntos.presupuesto[tier], pesos.presupuesto, {
    sobre: "sobre el rango objetivo", en_rango: "en rango objetivo",
    bajo: "bajo el rango objetivo", no_se: "no declarado",
  }[tier]);

  add("Plazo", lead.plazo ? puntos.plazo[lead.plazo] : puntos.plazo.explorando, pesos.plazo,
    lead.plazo ? lead.plazo.replace(/_/g, " ") : "sin dato → se asume explorando");

  const z = zonaComuna(lead.comuna);
  add("Comuna", z === "sin_dato" ? 0 : puntos.comuna[z], pesos.comuna,
    z === "sin_dato" ? "sin dato" : z === "fuera_radio" ? "FUERA DE RADIO" : `zona ${z}`);

  add("Propiedad", lead.propiedad ? puntos.propiedad[lead.propiedad] : 0, pesos.propiedad,
    lead.propiedad ? lead.propiedad.replace(/_/g, " ") : "sin dato");

  const t = lead.tipo_proyecto ? CFG.tipos[lead.tipo_proyecto] : null;
  const coherente = !!(t && lead.superficie_m2 > 0
    && lead.superficie_m2 >= t.superficie.min && lead.superficie_m2 <= t.superficie.max);
  add("Superficie", coherente ? puntos.superficie.coherente : puntos.superficie.incoherente,
    pesos.superficie,
    lead.superficie_m2
      ? `${lead.superficie_m2} m² · ${coherente ? "coherente" : "fuera del rango típico"}`
      : "sin dato");

  const llenos = [lead.telefono, lead.email, lead.tipo_proyecto, lead.comuna].filter(Boolean).length;
  add("Completitud", Math.round((llenos / 4) * pesos.completitud * 10) / 10,
    pesos.completitud, `${llenos}/4 datos clave`);

  let pi = 0; const partes: string[] = [];
  if (lead.fotos?.length)         { pi += puntos.interaccion.fotos;     partes.push("fotos"); }
  if (lead.termino_cotizador)     { pi += puntos.interaccion.cotizador; partes.push("cotizador"); }
  if (lead.respondio_followup)    { pi += puntos.interaccion.followup;  partes.push("follow-up"); }
  add("Interacción", Math.min(pi, pesos.interaccion), pesos.interaccion,
    partes.length ? partes.join(" + ") : "sin señales");

  total = Math.round(total * 10) / 10;

  let clasificacion: Clase;
  let motivo = "";
  if (z === "fuera_radio") { clasificacion = "D"; motivo = `Fuera del radio de operación (${lead.comuna})`; }
  else if (total >= umbrales.A) clasificacion = "A";
  else if (total >= umbrales.B) clasificacion = "B";
  else if (total >= umbrales.C) clasificacion = "C";
  else clasificacion = "D";

  // Regla dura: nunca a "Llamar hoy" sin teléfono válido y tipo definido.
  const faltan: string[] = [];
  if (!lead.telefono) faltan.push("teléfono válido");
  if (!lead.tipo_proyecto) faltan.push("tipo de proyecto");
  const apto = clasificacion === "A" && faltan.length === 0;
  if (clasificacion === "A" && faltan.length) {
    motivo = `Score A pero falta ${faltan.join(" y ")} → no entra a Llamar hoy`;
  }

  return {
    score: total, clasificacion, desglose: d, apto_para_llamar: apto, motivo,
    accion: {
      A: apto ? "LLAMAR HOY" : "COMPLETAR DATOS",
      B: "NUTRIR (automático)",
      C: "RESPUESTA AUTOMÁTICA + seguimiento 30 días",
      D: "RESPUESTA CORTÉS + archivo",
    }[clasificacion],
  };
}

/* ── Precios (la misma lógica del cotizador web) ────────────────────────── */

export interface Rango { uf_m2: number; minUF: number; maxUF: number; minCLP: number; maxCLP: number }

/** Factores de terminación del cotizador. */
export const TERMINACIONES = { basico: 0.85, estandar: 1, premium: 1.25 } as const;
export type Terminacion = keyof typeof TERMINACIONES;

export function cotizar(
  tipo: TipoProyecto, m2: number, ufClp: number, terminacion: Terminacion = "estandar",
): Rango | null {
  const t = CFG.tipos[tipo];
  if (!t || !(m2 > 0)) return null;
  const uf = Math.max(ufClp, CFG.uf_clp_piso);
  const base = t.uf_m2 * m2 * TERMINACIONES[terminacion];
  return {
    uf_m2: t.uf_m2,
    minUF: +(base * 0.9).toFixed(1),
    maxUF: +(base * 1.1).toFixed(1),
    minCLP: Math.round(base * 0.9 * uf),
    maxCLP: Math.round(base * 1.1 * uf),
  };
}

export const fUF  = (n: number) =>
  n.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " UF";
export const fCLP = (n: number) => "$ " + n.toLocaleString("es-CL");

/* ── Enlaces reales: cero copiar-pegar (Parte 7) ────────────────────────── */

export const telHref = (l: Pick<Lead, "telefono">) => (l.telefono ? `tel:+${l.telefono}` : "");

export function mensajeWhatsapp(l: Lead): string {
  const nom = (l.nombre || "").split(" ")[0];
  const label = l.tipo_proyecto ? CFG.tipos[l.tipo_proyecto].label.toLowerCase() : "tu proyecto";
  const t = [`Hola${nom ? " " + nom : ""}, soy Daniel de D.L.S Remodelaciones.`];
  t.push(`Vi tu consulta por ${label}`
    + (l.superficie_m2 ? ` de ${l.superficie_m2} m²` : "")
    + (l.comuna ? ` en ${l.comuna}` : "") + ".");
  if (l.rango_presupuesto) {
    t.push(`Trabajamos ese tipo de proyecto en el rango que indicaste (${l.rango_presupuesto}).`);
  }
  t.push("¿Te acomoda que coordinemos una visita técnica sin costo esta semana?");
  return t.join("\n");
}

export const waHref = (l: Lead) =>
  l.telefono ? `https://wa.me/${l.telefono}?text=${encodeURIComponent(mensajeWhatsapp(l))}` : "";
