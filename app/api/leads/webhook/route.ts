import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  calificar,
  normalizarTelefono,
  normalizarM2,
  normalizarTipo,
  normalizarPlazo,
  normalizarPropiedad,
  emailValido,
  type Lead,
} from "@/lib/negocio";

/**
 * Entrada de leads en tiempo real. La usan el cotizador, el chatbot y el
 * formulario del sitio.
 *
 * Sobre la autenticación, con honestidad: el token viaja en el JavaScript
 * público del sitio, así que **cualquiera que mire el código fuente lo ve**.
 * No es un secreto, es un filtro de ruido. Lo que de verdad protege esto es:
 *   1. la validación de origen (solo dlsremodelaciones.cl y localhost),
 *   2. la validación de datos (sin nombre y sin forma de contacto, se rechaza),
 *   3. el dedupe, que impide inflar la base con el mismo lead repetido.
 * Si algún día esto recibe spam en serio, la respuesta es un captcha en el
 * formulario o rate limiting por IP, no un token más largo.
 */

const ORIGENES = [
  "https://dlsremodelaciones.cl",
  "https://www.dlsremodelaciones.cl",
  "http://localhost:3000",
  "http://localhost:8765",
];

function cors(origen: string | null) {
  const permitido = origen && ORIGENES.includes(origen) ? origen : ORIGENES[0];
  return {
    "Access-Control-Allow-Origin": permitido,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-DLS-Token",
    "Access-Control-Max-Age": "86400",
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req.headers.get("origin")) });
}

export async function POST(req: NextRequest) {
  const origen = req.headers.get("origin");
  const headers = cors(origen);

  // 1. Origen conocido. Un POST desde otra web no entra.
  if (origen && !ORIGENES.includes(origen)) {
    return NextResponse.json({ ok: false, error: "origen_no_permitido" }, { status: 403, headers });
  }

  // 2. Token compartido — filtro de ruido, no seguridad.
  const esperado = process.env.DLS_WEBHOOK_TOKEN;
  if (esperado && req.headers.get("x-dls-token") !== esperado) {
    return NextResponse.json({ ok: false, error: "token_invalido" }, { status: 401, headers });
  }

  const db = supabaseAdmin();
  if (!db) {
    return NextResponse.json({ ok: false, error: "sin_base_de_datos" }, { status: 500, headers });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "json_invalido" }, { status: 400, headers });
  }

  const txt = (v: unknown, max = 300) => String(v ?? "").trim().slice(0, max);

  const telefono = normalizarTelefono(body.telefono);
  const email = emailValido(body.email) ? txt(body.email, 200).toLowerCase() : "";

  // 3. Sin forma de contactarlo, no es un lead.
  if (!telefono && !email) {
    return NextResponse.json(
      { ok: false, error: "sin_contacto", detalle: "Se necesita teléfono o correo válido." },
      { status: 422, headers },
    );
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

  // 4. Dedupe por teléfono o correo (§4.1): si ya existe, se enriquece y se
  //    recalcula el score — no se crea un lead nuevo.
  const filtros: string[] = [];
  if (telefono) filtros.push(`telefono.eq.${telefono}`);
  if (email) filtros.push(`email.eq.${email}`);
  const { data: previos } = await db
    .from("leads")
    .select("*")
    .or(filtros.join(","))
    .limit(1);
  const previo = previos?.[0] ?? null;

  // Al fusionar gana el dato nuevo, pero un campo vacío nunca borra uno lleno.
  const fusion: Record<string, unknown> = previo ? { ...previo } : {};
  for (const [k, v] of Object.entries(lead)) {
    const vacio = v === "" || v === 0 || v == null || (Array.isArray(v) && v.length === 0);
    if (!vacio) fusion[k] = v;
  }
  if (previo?.fotos?.length && !lead.fotos?.length) fusion.fotos = previo.fotos;

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
    score: cal.score,
    clasificacion: cal.clasificacion,
    desglose: cal.desglose,
    apto_para_llamar: cal.apto_para_llamar,
    fuente_original: txt(body.fuente_original, 200) || txt(body.canal, 40),
    ultima_actividad: new Date().toISOString(),
  };

  let id = previo?.id as string | undefined;
  let creado = false;

  if (previo) {
    const { error } = await db.from("leads").update(registro).eq("id", previo.id);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers });
    }
  } else {
    const { data, error } = await db
      .from("leads")
      .insert({ ...registro, estado: "contacto_inicial", etiqueta: "NUEVO" })
      .select("id")
      .single();
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers });
    }
    id = data.id as string;
    creado = true;
  }

  // 5. Rastro de lo que llegó, para poder auditar y para el historial del lead.
  if (id) {
    await db.from("mensajes").insert({
      lead_id: id,
      direccion: "entrante",
      canal: lead.canal,
      asunto: creado ? "Lead nuevo" : "Lead actualizado",
      cuerpo: JSON.stringify(body).slice(0, 4000),
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

  return NextResponse.json(
    {
      ok: true,
      id,
      creado,
      actualizado: !creado,
      score: cal.score,
      clasificacion: cal.clasificacion,
      apto_para_llamar: cal.apto_para_llamar,
      accion: cal.accion,
    },
    { headers },
  );
}
