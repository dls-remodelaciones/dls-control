import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { ORIGENES, cors } from "@/lib/cors";
import { Ventana, ipDe } from "@/lib/limite";
import { CLAVE, agregar, normalizar, type ErrorSitio } from "@/lib/errores";

/**
 * El sitio reporta acá los errores de JavaScript de sus visitantes (ver
 * `lib/errores.ts`). Pública, con el mismo token no secreto que la entrada de
 * leads, origen del sitio obligatorio y tope por IP: lo peor que puede hacer un
 * tercero es provocar un aviso falso.
 */

const porIp = new Ventana(10, 10 * 60_000);

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req.headers.get("origin")) });
}

export async function POST(req: NextRequest) {
  const origen = req.headers.get("origin");
  const headers = cors(origen);
  if (!origen || !ORIGENES.includes(origen)) {
    return NextResponse.json({ ok: false, error: "origen_no_permitido" }, { status: 403, headers });
  }
  if (!porIp.permitir(ipDe(req.headers))) {
    return NextResponse.json({ ok: false, error: "demasiados_envios" }, { status: 429, headers });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse((await req.text()).slice(0, 4000));
  } catch {
    return NextResponse.json({ ok: false, error: "json_invalido" }, { status: 400, headers });
  }
  const esperado = process.env.DLS_WEBHOOK_TOKEN;
  if (esperado && String(body.token ?? "") !== esperado) {
    return NextResponse.json({ ok: false, error: "token_invalido" }, { status: 401, headers });
  }

  const nuevo = normalizar(body, new Date());
  if (!nuevo) return NextResponse.json({ ok: true, ignorado: true }, { headers });

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, error: "sin_base_de_datos" }, { status: 500, headers });

  // Leer y escribir no es atómico; para detectar "se repite un error" alcanza.
  const { data } = await db.from("config").select("valor").eq("clave", CLAVE).maybeSingle();
  const lista = agregar((data?.valor as ErrorSitio[] | undefined) ?? [], nuevo);
  await db
    .from("config")
    .upsert({ clave: CLAVE, valor: lista, actualizado: new Date().toISOString() }, { onConflict: "clave" });
  console.warn("Error en el sitio:", nuevo.mensaje, nuevo.fuente, nuevo.linea);

  return NextResponse.json({ ok: true }, { headers });
}
