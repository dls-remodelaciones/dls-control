import { NextRequest, NextResponse, after } from "next/server";
import { registrarLead, type EntradaLead } from "@/lib/registrar-lead";
import { avisar } from "@/lib/avisos";
import { config, type TipoProyecto } from "@/lib/negocio";
import { Ventana, avisosDeLead, ipDe, MAX_BYTES, porIpDelSitio, porIpSinOrigen } from "@/lib/limite";
import { ORIGENES, cors } from "@/lib/cors";

/** Un solo aviso de "muchos leads seguidos" cada 10 minutos. */
const alertaDeInundacion = new Ventana(1, 10 * 60_000);

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
 *   2. el dedupe, que impide inflar la base con el mismo lead repetido,
 *   3. desde el 13-sep-2026, topes de envíos por IP y de avisos (`lib/limite.ts`).
 * Si algún día esto recibe spam en serio, lo siguiente es el firewall de Vercel,
 * no un token más largo.
 */


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

  // 1b. Tope de envíos por IP (ver lib/limite.ts). Sin Origin — un script, no un
  //     navegador en el sitio — el tope es más bajo.
  const ip = ipDe(req.headers);
  const dentro = origen ? porIpDelSitio.permitir(ip) : porIpSinOrigen.permitir(ip);
  if (!dentro) {
    console.warn("Leads: tope de envíos alcanzado", { ip, conOrigen: Boolean(origen) });
    return NextResponse.json(
      { ok: false, error: "demasiados_envios", detalle: "Espera unos minutos." },
      { status: 429, headers: { ...headers, "Retry-After": "600" } },
    );
  }

  // El cuerpo se lee como texto y se parsea a mano: así el cliente puede mandarlo
  // como `text/plain` y evitar el preflight de CORS (ver nota del token abajo).
  const crudo = await req.text();
  if (crudo.length > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "envio_muy_grande" }, { status: 413, headers });
  }
  let body: EntradaLead;
  try {
    body = JSON.parse(crudo);
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

  // Un reintento si la base falla (Supabase a veces corta con "Gateway Timeout").
  // Es seguro: si el primer intento alcanzó a guardar, el dedupe lo encuentra.
  let r = await registrarLead(body);
  if (!r.ok && r.status >= 500) {
    console.warn("Leads: la base falló, reintentando", r.error, r.detalle);
    await new Promise((listo) => setTimeout(listo, 800));
    r = await registrarLead(body);
  }
  if (!r.ok) {
    return NextResponse.json(
      { ok: false, error: r.error, detalle: r.detalle },
      { status: r.status, headers },
    );
  }
  // Aviso al celular solo cuando el lead PASA a ser contactable: el chatbot y el
  // cotizador mandan parciales en cada paso, y avisar por cada uno seria ruido.
  // Va en after(): la respuesta al sitio sale primero y un aviso que falle no
  // puede frenar ni romper el registro del lead.
  if (r.recien_contactable) {
    const tipo = config().tipos[r.tipo_proyecto as TipoProyecto]?.label ?? "";
    const { id, clasificacion, score, nombre, comuna } = r;
    // Tope de avisos: si entran muchos leads seguidos (lo normal es uno cada
    // tanto), el lead igual se guarda — nada se pierde — pero el celular no
    // suena veinte veces. Un solo aviso dice que algo raro está pasando.
    if (avisosDeLead.permitir("total")) {
      after(() =>
        avisar({
          titulo: `Lead nuevo · ${clasificacion} ${score}`,
          cuerpo: [nombre, tipo, comuna].filter(Boolean).join(" · ") || "Sin detalle",
          url: "/",
          tag: `lead-${id}`,
        }).then(() => undefined),
      );
    } else if (alertaDeInundacion.permitir("total")) {
      after(() =>
        avisar({
          titulo: "Están entrando muchos leads seguidos",
          cuerpo: "Pausé los avisos por 10 minutos. Los leads se siguen guardando; revisa si son reales.",
          url: "/",
          tag: "inundacion",
        }).then(() => undefined),
      );
    }
  }
  return NextResponse.json(r, { headers });
}
