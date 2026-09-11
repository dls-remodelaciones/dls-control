import { NextRequest, NextResponse } from "next/server";
import { registrarLead, type EntradaLead } from "@/lib/registrar-lead";

/**
 * Entrada de leads en tiempo real. La usan el cotizador, el chatbot y el
 * formulario del sitio.
 *
 * Esta ruta es sólo la PUERTA: valida de dónde viene y con qué token. Las
 * reglas de negocio — dedupe, multi-proyecto, puntaje, etiquetas — viven en
 * `lib/registrar-lead.ts`, compartidas con el webhook de WhatsApp. Se separaron
 * al conectar WhatsApp: tenerlas dos veces habría garantizado que algún día
 * cambien en un lado y no en el otro.
 *
 * Sobre la autenticación, con honestidad: el token viaja en el JavaScript
 * público del sitio, así que **cualquiera que mire el código fuente lo ve**.
 * No es un secreto, es un filtro de ruido. Lo que de verdad protege esto es:
 *   1. la validación de origen (solo dlsremodelaciones.cl y localhost),
 *   2. el dedupe, que impide inflar la base con el mismo lead repetido.
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

  // El cuerpo se lee como texto y se parsea a mano: así el cliente puede mandarlo
  // como `text/plain` y evitar el preflight de CORS (ver nota del token abajo).
  let body: EntradaLead;
  try {
    body = JSON.parse(await req.text());
  } catch {
    return NextResponse.json({ ok: false, error: "json_invalido" }, { status: 400, headers });
  }

  // 2. Token compartido — filtro de ruido, no seguridad.
  //    Se acepta en el cuerpo ADEMAS de en la cabecera: una cabecera propia
  //    obliga al navegador a hacer un preflight OPTIONS, y si ese preflight
  //    falla (red restrictiva, extension, pestaña vieja) el lead se pierde en
  //    silencio. Mandarlo en el cuerpo con text/plain lo convierte en una
  //    peticion simple, sin preflight. Da igual para la seguridad: el token
  //    viaja en el JS publico de todas formas.
  const esperado = process.env.DLS_WEBHOOK_TOKEN;
  const recibido = req.headers.get("x-dls-token") || String(body.token ?? "");
  if (esperado && recibido !== esperado) {
    return NextResponse.json({ ok: false, error: "token_invalido" }, { status: 401, headers });
  }
  delete body.token;

  const r = await registrarLead(body);
  if (!r.ok) {
    return NextResponse.json(
      { ok: false, error: r.error, detalle: r.detalle },
      { status: r.status, headers },
    );
  }
  return NextResponse.json(r, { headers });
}
