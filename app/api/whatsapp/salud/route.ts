import { NextRequest, NextResponse } from "next/server";
import { usuarioDeLaPeticion } from "@/lib/sesion";

/**
 * Chequeo de salud de WhatsApp.
 *
 * Responde una sola pregunta: **¿el token que tenemos sirve, y para qué número?**
 * Le pregunta a Meta por el número configurado en `WA_PHONE_NUMBER_ID` usando
 * `WA_ACCESS_TOKEN`. Si Meta contesta con el nombre y el número, el token está vivo.
 *
 * Por qué existe: los tokens de Meta se pueden revocar, caducar o quedar sin
 * permisos, y cuando eso pasa **no avisa nadie** — simplemente los mensajes dejan
 * de salir. Sin esta ruta habría que enterarse por un cliente que no recibió
 * respuesta. Con ella, se sabe en diez segundos.
 *
 * Qué NO hace: no envía mensajes, no escribe nada, y **nunca devuelve el token**.
 * Solo dice si funciona.
 *
 * Acceso: exige una sesión válida del panel (el mismo magic link de Daniel). Sin
 * sesión no responde. Se eligió así en vez de un token en la URL porque un token
 * en la URL queda en el historial del navegador y en los logs.
 */

const GRAPH = "https://graph.facebook.com/v21.0";

export async function GET(req: NextRequest) {
  // 1. Sesión del panel. El navegador manda el JWT de Supabase en Authorization.
  const quien = await usuarioDeLaPeticion(req);
  if (!quien.ok) {
    return NextResponse.json({ ok: false, error: quien.error }, { status: quien.status });
  }

  // 2. Lo que debería estar configurado. Se reporta qué falta, sin revelar valores.
  const token = process.env.WA_ACCESS_TOKEN ?? "";
  const numeroId = process.env.WA_PHONE_NUMBER_ID ?? "";
  const configuracion = {
    WA_ACCESS_TOKEN: Boolean(token),
    WA_PHONE_NUMBER_ID: Boolean(numeroId),
    WA_VERIFY_TOKEN: Boolean(process.env.WA_VERIFY_TOKEN),
    WA_APP_SECRET: Boolean(process.env.WA_APP_SECRET),
  };

  if (!token || !numeroId) {
    return NextResponse.json(
      {
        ok: false,
        error: "falta_configuracion",
        detalle: "Sin WA_ACCESS_TOKEN o WA_PHONE_NUMBER_ID no se puede preguntar nada.",
        configuracion,
      },
      { status: 500 },
    );
  }

  // 3. La pregunta a Meta. Si el token está muerto, esto responde 190 u 200.
  try {
    const url = `${GRAPH}/${numeroId}?fields=verified_name,display_phone_number,quality_rating,platform_type`;
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const cuerpo = (await r.json()) as Record<string, unknown>;

    if (!r.ok) {
      const err = (cuerpo.error ?? {}) as Record<string, unknown>;
      return NextResponse.json(
        {
          ok: false,
          error: "meta_rechazo",
          // El mensaje de Meta es la parte útil: dice si caducó, si lo revocaron
          // o si le faltan permisos. No contiene el token.
          meta: {
            mensaje: String(err.message ?? "sin mensaje"),
            tipo: String(err.type ?? ""),
            codigo: Number(err.code ?? 0),
          },
          configuracion,
        },
        { status: 502 },
      );
    }

    // Opcional: `?waba=<id>` lista todos los números de esa cuenta con su
    // identificador. Sirve para responder "¿cuál es el ID del número real?"
    // sin tener que buscarlo a mano en los paneles de Meta.
    let numeros: unknown = undefined;
    const waba = req.nextUrl.searchParams.get("waba")?.trim() ?? "";
    if (/^\d{5,25}$/.test(waba)) {
      const rn = await fetch(
        `${GRAPH}/${waba}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating`,
        { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
      );
      const jn = (await rn.json()) as Record<string, unknown>;
      numeros = rn.ok
        ? (jn.data as unknown[])?.map((n) => {
            const x = n as Record<string, unknown>;
            return {
              id: String(x.id ?? ""),
              telefono: String(x.display_phone_number ?? ""),
              nombre: String(x.verified_name ?? ""),
              calidad: String(x.quality_rating ?? ""),
              es_el_configurado: String(x.id ?? "") === numeroId,
            };
          })
        : { error: String((jn.error as Record<string, unknown>)?.message ?? "no se pudo listar") };
    }

    // Opcional: `?subs=1&waba=<id>` dice qué aplicaciones están suscritas a esa
    // cuenta. Es el eslabón que más silenciosamente falla: el webhook puede
    // estar perfectamente configurado en la app, pero si la cuenta de WhatsApp
    // no está suscrita A la app, Meta no entrega ni un solo mensaje y no avisa
    // en ninguna parte.
    let suscripciones: unknown = undefined;
    if (req.nextUrl.searchParams.get("subs") === "1" && /^\d{5,25}$/.test(waba)) {
      const rs = await fetch(`${GRAPH}/${waba}/subscribed_apps`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const js = (await rs.json()) as Record<string, unknown>;
      suscripciones = rs.ok
        ? (js.data as unknown[])?.map((a) => {
            const x = (a as Record<string, unknown>).whatsapp_business_api_data as
              | Record<string, unknown>
              | undefined;
            return { id: String(x?.id ?? ""), nombre: String(x?.name ?? "") };
          })
        : { error: String((js.error as Record<string, unknown>)?.message ?? "no se pudo consultar") };
    }

    return NextResponse.json({
      ok: true,
      token_vivo: true,
      ...(suscripciones ? { apps_suscritas: suscripciones } : {}),
      numero: {
        nombre: String(cuerpo.verified_name ?? ""),
        telefono: String(cuerpo.display_phone_number ?? ""),
        calidad: String(cuerpo.quality_rating ?? ""),
        plataforma: String(cuerpo.platform_type ?? ""),
      },
      ...(numeros ? { numeros_de_la_cuenta: numeros } : {}),
      configuracion,
      revisado: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: "no_se_pudo_contactar_a_meta",
        detalle: e instanceof Error ? e.message : String(e),
        configuracion,
      },
      { status: 502 },
    );
  }
}
