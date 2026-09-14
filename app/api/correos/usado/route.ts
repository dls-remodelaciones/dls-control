import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { ORIGENES, cors } from "@/lib/cors";
import { Ventana, ipDe } from "@/lib/limite";
import { CLAVE, sumar, type Uso } from "@/lib/correos";

/**
 * El sitio avisa acá cada vez que intenta mandar correos por EmailJS, para
 * llevar la cuenta del cupo mensual (ver `lib/correos.ts`).
 *
 * Es pública como la entrada de leads y con el mismo token (que no es secreto).
 * Lo peor que puede hacer un tercero es inflar el conteo y provocar un aviso
 * falso de cupo — por eso cada envío suma como máximo 3 y hay tope por IP.
 */

const porIp = new Ventana(20, 10 * 60_000);

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

  let body: { n?: unknown; token?: unknown };
  try {
    body = JSON.parse((await req.text()).slice(0, 2000));
  } catch {
    return NextResponse.json({ ok: false, error: "json_invalido" }, { status: 400, headers });
  }
  const esperado = process.env.DLS_WEBHOOK_TOKEN;
  if (esperado && String(body.token ?? "") !== esperado) {
    return NextResponse.json({ ok: false, error: "token_invalido" }, { status: 401, headers });
  }
  const n = Math.min(3, Math.max(1, Math.floor(Number(body.n) || 1)));

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, error: "sin_base_de_datos" }, { status: 500, headers });

  // Leer y escribir no es atómico: dos envíos en el mismo instante pueden
  // contar uno de menos. Para avisar "vas cerca del tope" alcanza de sobra.
  const { data } = await db.from("config").select("valor").eq("clave", CLAVE).maybeSingle();
  const uso = sumar((data?.valor as Uso | undefined) ?? null, n, new Date());
  const { error } = await db
    .from("config")
    .upsert({ clave: CLAVE, valor: uso, actualizado: new Date().toISOString() }, { onConflict: "clave" });
  if (error) return NextResponse.json({ ok: false, error: "db", detalle: error.message }, { status: 500, headers });

  return NextResponse.json({ ok: true }, { headers });
}
