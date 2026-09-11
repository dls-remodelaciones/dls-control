import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  calificar,
  normalizarTelefono,
  normalizarM2,
  normalizarTipo,
  normalizarPlazo,
  normalizarPropiedad,
  emailValido,
  tierPresupuesto,
  config,
  type Lead,
  type TipoProyecto,
} from "@/lib/negocio";

/**
 * Alta y enriquecimiento de un lead. **Una sola implementación** para todos los
 * canales: web, cotizador, chatbot, WhatsApp y lo que venga.
 *
 * Vivía dentro de `app/api/leads/webhook/route.ts`. Se sacó de ahí al conectar
 * WhatsApp: copiar estas reglas a un segundo archivo habría sido el cuarto
 * lugar con la misma lógica de dedupe y puntaje, y el día que cambie una,
 * cambiaría en un lado y no en el otro. La ruta HTTP ahora sólo valida origen
 * y token; las reglas de negocio están acá.
 */

/** Un proyecto pedido por esta persona. Una misma persona puede pedir varios. */
export interface Proyecto {
  tipo: string;
  comuna: string;
  m2: number;
  presupuesto: string;
  tier: string;
  fecha: string;
}

export interface EntradaLead {
  canal?: unknown;
  nombre?: unknown;
  telefono?: unknown;
  email?: unknown;
  tipo_proyecto?: unknown;
  comuna?: unknown;
  superficie_m2?: unknown;
  rango_presupuesto?: unknown;
  financiamiento?: unknown;
  plazo?: unknown;
  propiedad?: unknown;
  fotos?: unknown;
  fuente_original?: unknown;
  sesion_id?: unknown;
  cotizacion?: unknown;
  /** Texto tal cual lo escribió la persona. Hoy lo usa WhatsApp. */
  mensaje?: unknown;
  [k: string]: unknown;
}

export type Resultado =
  | { ok: false; error: string; detalle: string; status: number }
  | {
      ok: true;
      id: string;
      creado: boolean;
      actualizado: boolean;
      score: number;
      clasificacion: string;
      apto_para_llamar: boolean;
      accion: string;
      etiqueta: string;
      contactable: boolean;
    };

const txt = (v: unknown, max = 300) => String(v ?? "").trim().slice(0, max);

export async function registrarLead(body: EntradaLead): Promise<Resultado> {
  const db = supabaseAdmin();
  if (!db) {
    return { ok: false, error: "sin_base_de_datos", detalle: "Falta la clave de servicio.", status: 500 };
  }

  const telefono = normalizarTelefono(body.telefono);
  const email = emailValido(body.email) ? txt(body.email, 200).toLowerCase() : "";
  const sesionId = txt(body.sesion_id, 60);
  const hayContacto = Boolean(telefono || email);

  // Regla de Daniel (2026-09-11): **todo lead entra**, tenga o no forma de
  // contacto. Lo único que se rechaza es un envío sin nada que contar.
  const hayAlgoQueContar =
    Boolean(txt(body.nombre, 120)) ||
    Boolean(normalizarTipo(body.tipo_proyecto)) ||
    Boolean(txt(body.comuna, 80)) ||
    normalizarM2(body.superficie_m2) > 0 ||
    Boolean(txt(body.rango_presupuesto, 80)) ||
    Boolean(txt(body.mensaje, 200));

  if (!hayContacto && !hayAlgoQueContar) {
    return { ok: false, error: "sin_datos", detalle: "Ni contacto ni datos del proyecto.", status: 422 };
  }
  if (!hayContacto && !sesionId) {
    return { ok: false, error: "falta_sesion", detalle: "Un lead sin contacto necesita sesion_id.", status: 422 };
  }

  const lead: Lead = {
    canal: txt(body.canal, 40) || "web",
    nombre: txt(body.nombre, 120) || "Sin nombre",
    telefono,
    telefono_crudo: txt(body.telefono, 60),
    email,
    tipo_proyecto: normalizarTipo(body.tipo_proyecto),
    comuna: txt(body.comuna, 80),
    superficie_m2: normalizarM2(body.superficie_m2),
    rango_presupuesto: txt(body.rango_presupuesto, 80),
    financiamiento: txt(body.financiamiento, 40),
    plazo: normalizarPlazo(body.plazo),
    propiedad: normalizarPropiedad(body.propiedad),
    fotos: Array.isArray(body.fotos) ? body.fotos.slice(0, 20) : [],
    termino_cotizador: body.canal === "cotizador" || Boolean(body.cotizacion),
  };

  // Dedupe por teléfono, correo o id de visita.
  const filtros: string[] = [];
  if (telefono) filtros.push(`telefono.eq.${telefono}`);
  if (email) filtros.push(`email.eq.${email}`);
  if (sesionId) filtros.push(`sesion_id.eq.${sesionId}`);
  const { data: previos } = await db.from("leads").select("*").or(filtros.join(",")).limit(1);
  const previo = previos?.[0] ?? null;

  // Una persona puede querer varias cosas: se acumulan y manda el más grande.
  const proyectos: Proyecto[] = Array.isArray(previo?.proyectos) ? [...previo.proyectos] : [];
  if (lead.tipo_proyecto || lead.rango_presupuesto) {
    const nuevo: Proyecto = {
      tipo: lead.tipo_proyecto,
      comuna: lead.comuna,
      m2: lead.superficie_m2,
      presupuesto: lead.rango_presupuesto,
      tier: tierPresupuesto(lead.tipo_proyecto, lead.rango_presupuesto),
      fecha: new Date().toISOString(),
    };
    const igual = (a: Proyecto, b: Proyecto) =>
      a.tipo === b.tipo && a.comuna === b.comuna && a.m2 === b.m2 && a.presupuesto === b.presupuesto;
    if (!proyectos.some((p) => igual(p, nuevo))) proyectos.push(nuevo);
  }

  // El principal se elige por TAMAÑO REAL (UF/m² × m²), no por tramo: una casa
  // completa "en rango" vale más que un baño "sobre rango".
  const magnitud = (p: Proyecto) => {
    const t = p.tipo ? config().tipos[p.tipo as TipoProyecto] : null;
    return t && p.m2 > 0 ? t.uf_m2 * p.m2 : 0;
  };
  const principal = proyectos.length
    ? [...proyectos].sort((a, b) => magnitud(b) - magnitud(a) || Date.parse(b.fecha) - Date.parse(a.fecha))[0]
    : null;

  // Al fusionar gana el dato nuevo, pero un campo vacío nunca borra uno lleno.
  const fusion: Record<string, unknown> = previo ? { ...previo } : {};
  for (const [k, v] of Object.entries(lead)) {
    const vacio = v === "" || v === 0 || v == null || (Array.isArray(v) && v.length === 0);
    if (!vacio) fusion[k] = v;
  }
  if (previo?.fotos?.length && !lead.fotos?.length) fusion.fotos = previo.fotos;

  if (principal) {
    fusion.tipo_proyecto = principal.tipo;
    fusion.comuna = principal.comuna;
    fusion.superficie_m2 = principal.m2;
    fusion.rango_presupuesto = principal.presupuesto;
  }

  const cal = calificar({
    ...(fusion as unknown as Lead),
    termino_cotizador: Boolean(fusion.termino_cotizador) || Boolean(previo?.termino_cotizador),
    respondio_followup: Boolean(previo?.respondio_followup),
  });

  const registro = {
    canal: fusion.canal,
    nombre: fusion.nombre,
    telefono: fusion.telefono || null,
    telefono_crudo: fusion.telefono_crudo || null,
    email: fusion.email || null,
    tipo_proyecto: fusion.tipo_proyecto || null,
    comuna: fusion.comuna || null,
    superficie_m2: fusion.superficie_m2 || null,
    rango_presupuesto: fusion.rango_presupuesto || null,
    financiamiento: fusion.financiamiento || null,
    plazo: fusion.plazo || null,
    propiedad: fusion.propiedad || null,
    fotos: fusion.fotos ?? [],
    proyectos,
    score: cal.score,
    clasificacion: cal.clasificacion,
    desglose: cal.desglose,
    apto_para_llamar: cal.apto_para_llamar,
    fuente_original: txt(body.fuente_original, 200) || txt(body.canal, 40),
    sesion_id: sesionId || previo?.sesion_id || null,
    ultima_actividad: new Date().toISOString(),
  };

  // La etiqueta se decide por lo que se sabe DESPUÉS de fusionar, y nunca pisa
  // una que Daniel haya movido a mano (SEGUIMIENTO, VISITA AGENDADA...).
  const contactableAhora = Boolean(fusion.telefono || fusion.email);
  const etiquetaPrevia = txt(previo?.etiqueta, 40);
  const etiquetaAutomatica =
    etiquetaPrevia === "" || etiquetaPrevia === "NUEVO" || etiquetaPrevia === "SIN CONTACTO";
  const etiqueta = contactableAhora ? "NUEVO" : "SIN CONTACTO";

  let id = previo?.id as string | undefined;
  let creado = false;

  if (previo) {
    const { error } = await db
      .from("leads")
      .update(etiquetaAutomatica ? { ...registro, etiqueta } : registro)
      .eq("id", previo.id);
    if (error) return { ok: false, error: "db_update", detalle: error.message, status: 500 };
  } else {
    const { data, error } = await db
      .from("leads")
      .insert({ ...registro, estado: "contacto_inicial", etiqueta })
      .select("id")
      .single();
    if (error) return { ok: false, error: "db_insert", detalle: error.message, status: 500 };
    id = data.id as string;
    creado = true;
  }

  // Rastro de lo que llegó, para auditar y para el historial del lead.
  if (id) {
    const mensaje = txt(body.mensaje, 4000);
    await db.from("mensajes").insert({
      lead_id: id,
      direccion: "entrante",
      canal: lead.canal,
      // Si la persona escribió algo (WhatsApp), se guarda su texto tal cual.
      // Para los formularios se guarda el envío completo, que es lo auditable.
      asunto: mensaje ? "Mensaje de " + lead.canal : creado ? "Lead nuevo" : "Lead actualizado",
      cuerpo: mensaje || JSON.stringify(body).slice(0, 4000),
      enviado_por: "sistema",
    });
    await db.from("actividad").insert({
      lead_id: id,
      tipo: "score",
      antes: previo ? { score: previo.score, clasificacion: previo.clasificacion } : null,
      despues: { score: cal.score, clasificacion: cal.clasificacion },
      quien: "sistema",
    });
    if (body.cotizacion && typeof body.cotizacion === "object") {
      const c = body.cotizacion as Record<string, unknown>;
      await db.from("cotizaciones").insert({
        lead_id: id,
        tipo_proyecto: lead.tipo_proyecto || null,
        superficie_m2: lead.superficie_m2 || null,
        uf_m2: Number(c.uf_m2) || null,
        monto_min: Number(c.monto_min) || null,
        monto_max: Number(c.monto_max) || null,
        partidas: c.partidas ?? [],
      });
    }
  }

  return {
    ok: true,
    id: id as string,
    creado,
    actualizado: !creado,
    score: cal.score,
    clasificacion: cal.clasificacion,
    apto_para_llamar: cal.apto_para_llamar,
    accion: cal.accion,
    etiqueta: etiquetaAutomatica || creado ? etiqueta : etiquetaPrevia,
    contactable: contactableAhora,
  };
}
