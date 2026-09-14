import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { usuarioDeLaPeticion } from "@/lib/sesion";
import { normalizarComuna } from "@/lib/comunas";
import { camposCambiados, datoInvalido } from "@/lib/edicion";
import {
  calificar,
  normalizarTelefono,
  normalizarM2,
  normalizarTipo,
  normalizarPlazo,
  normalizarPropiedad,
  emailValido,
  interaccionPrevia,
  type Lead,
} from "@/lib/negocio";

/**
 * Edición manual de un lead desde la ficha.
 *
 * Por qué hacía falta: casi todo lo que de verdad se sabe de un cliente se
 * averigua **llamando**, y hasta ahora eso no tenía dónde ir. El lead quedaba
 * con los datos incompletos del formulario y su puntaje reflejaba esa
 * incompletitud para siempre, aunque Daniel supiera la comuna, el presupuesto
 * y la fecha desde la primera conversación.
 *
 * El puntaje se recalcula acá y no en el navegador: es el mismo motor que usan
 * el webhook y WhatsApp, así que un lead editado a mano y uno que entró solo
 * terminan comparándose con la misma vara.
 */

const ESTADOS = [
  "contacto_inicial",
  "cotizador_web",
  "visita_terreno",
  "presupuesto_enviado",
  "cerrado",
  "no_prospero",
] as const;

const txt = (v: unknown, max = 300) => String(v ?? "").trim().slice(0, max);

export async function POST(req: NextRequest) {
  const quien = await usuarioDeLaPeticion(req);
  if (!quien.ok) return NextResponse.json({ ok: false, error: quien.error }, { status: quien.status });

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, error: "sin_base_de_datos" }, { status: 500 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "json_invalido" }, { status: 400 });
  }

  const id = txt(body.id, 60);
  if (!id) return NextResponse.json({ ok: false, error: "falta_id" }, { status: 400 });

  const { data: previo, error: e1 } = await db.from("leads").select("*").eq("id", id).single();
  if (e1 || !previo) return NextResponse.json({ ok: false, error: "lead_no_existe" }, { status: 404 });

  // Solo se tocan los campos que vinieron. Un campo ausente no es un campo
  // vacío: si la ficha manda solo el estado, el resto queda como estaba.
  const tiene = (k: string) => Object.prototype.hasOwnProperty.call(body, k);
  const fusion: Record<string, unknown> = { ...previo };

  // Un teléfono o correo escrito mal NO se guarda como vacío: antes un dígito de
  // menos borraba en silencio el teléfono con que se llamaba al cliente. Vacío a
  // propósito sí se acepta (se borra); mal escrito se rechaza y se dice cuál.
  const invalido = datoInvalido(body, tiene);
  if (invalido) return NextResponse.json({ ok: false, error: invalido.error, detalle: invalido.detalle }, { status: 422 });

  if (tiene("nombre")) fusion.nombre = txt(body.nombre, 120) || "Sin nombre";
  if (tiene("telefono")) {
    fusion.telefono = normalizarTelefono(body.telefono) || null;
    fusion.telefono_crudo = txt(body.telefono, 60) || null;
  }
  if (tiene("email")) fusion.email = emailValido(body.email) ? txt(body.email, 200).toLowerCase() : null;
  if (tiene("tipo_proyecto")) fusion.tipo_proyecto = normalizarTipo(body.tipo_proyecto) || null;
  if (tiene("comuna")) fusion.comuna = normalizarComuna(body.comuna) || null;
  if (tiene("superficie_m2")) fusion.superficie_m2 = normalizarM2(body.superficie_m2) || null;
  if (tiene("rango_presupuesto")) fusion.rango_presupuesto = txt(body.rango_presupuesto, 80) || null;
  if (tiene("plazo")) fusion.plazo = normalizarPlazo(body.plazo) || null;
  if (tiene("propiedad")) fusion.propiedad = normalizarPropiedad(body.propiedad) || null;
  if (tiene("financiamiento")) fusion.financiamiento = txt(body.financiamiento, 40) || null;
  if (tiene("nota_interna")) fusion.nota_interna = txt(body.nota_interna, 2000) || null;
  if (tiene("proxima_accion")) fusion.proxima_accion = txt(body.proxima_accion, 200) || null;
  if (tiene("fecha_proxima_accion")) {
    const t = Date.parse(txt(body.fecha_proxima_accion, 40));
    fusion.fecha_proxima_accion = Number.isFinite(t) ? new Date(t).toISOString() : null;
  }
  if (tiene("motivo_no_prospero")) fusion.motivo_no_prospero = txt(body.motivo_no_prospero, 300) || null;
  if (tiene("etiqueta")) fusion.etiqueta = txt(body.etiqueta, 40) || null;

  if (tiene("estado")) {
    const e = txt(body.estado, 40);
    if (!ESTADOS.includes(e as (typeof ESTADOS)[number])) {
      return NextResponse.json({ ok: false, error: "estado_invalido" }, { status: 422 });
    }
    fusion.estado = e;
  }

  const cal = calificar({
    ...(fusion as unknown as Lead),
    superficie_m2: Number(fusion.superficie_m2) || 0,
    fotos: Array.isArray(fusion.fotos) ? fusion.fotos : [],
    // Del desglose guardado: la tabla no tiene columnas para estas señales, y
    // leerlas de ahí hacía que editar la ficha le quitara puntos al lead.
    ...interaccionPrevia(previo),
  });

  const { error: e2 } = await db
    .from("leads")
    .update({
      nombre: fusion.nombre,
      telefono: fusion.telefono,
      telefono_crudo: fusion.telefono_crudo,
      email: fusion.email,
      tipo_proyecto: fusion.tipo_proyecto,
      comuna: fusion.comuna,
      superficie_m2: fusion.superficie_m2,
      rango_presupuesto: fusion.rango_presupuesto,
      plazo: fusion.plazo,
      propiedad: fusion.propiedad,
      financiamiento: fusion.financiamiento,
      nota_interna: fusion.nota_interna,
      proxima_accion: fusion.proxima_accion,
      fecha_proxima_accion: fusion.fecha_proxima_accion ?? null,
      motivo_no_prospero: fusion.motivo_no_prospero,
      etiqueta: fusion.etiqueta,
      estado: fusion.estado,
      score: cal.score,
      clasificacion: cal.clasificacion,
      desglose: cal.desglose,
      apto_para_llamar: cal.apto_para_llamar,
      ultima_actividad: new Date().toISOString(),
    })
    .eq("id", id);
  if (e2) return NextResponse.json({ ok: false, error: "db_update", detalle: e2.message }, { status: 500 });

  // Queda el rastro de quién lo editó y qué cambió de puntaje. Sin esto, un
  // lead que sube de C a A parece haberlo hecho solo.
  // También qué datos cambiaron: "comuna: Ñuñoa → Providencia" dice más que "ficha editada".
  const cambios = camposCambiados(previo, fusion);
  await db.from("actividad").insert({
    lead_id: id,
    tipo: "edicion",
    antes: { score: previo.score, clasificacion: previo.clasificacion, estado: previo.estado, ...cambios.antes },
    despues: { score: cal.score, clasificacion: cal.clasificacion, estado: fusion.estado, ...cambios.despues },
    quien: quien.email || "panel",
  });

  return NextResponse.json({
    ok: true,
    score: cal.score,
    clasificacion: cal.clasificacion,
    apto_para_llamar: cal.apto_para_llamar,
    desglose: cal.desglose,
  });
}
