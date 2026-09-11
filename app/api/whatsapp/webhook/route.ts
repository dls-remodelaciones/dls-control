import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { registrarLead } from "@/lib/registrar-lead";
import { normalizarTipo, normalizarM2, config, type TipoProyecto } from "@/lib/negocio";

/**
 * Entrada de WhatsApp (Cloud API de Meta).
 *
 * Un mensaje de WhatsApp trae poco: un número, un nombre de perfil y un texto.
 * No trae comuna, ni m², ni presupuesto. Así que **este canal no califica, captura**:
 * el lead entra con su teléfono — o sea, llamable desde el primer segundo — y
 * se le saca al texto lo que se pueda (tipo de proyecto y metros, si los menciona).
 * Lo demás lo completa Daniel llamando, o el propio cliente si pasa por el chatbot.
 *
 * Las reglas de dedupe y puntaje no están acá: son las mismas de la web, en
 * `lib/registrar-lead.ts`. Si alguien escribe por WhatsApp y además cotizó en el
 * sitio con el mismo número, cae en la MISMA ficha.
 *
 * Meta llama a esta ruta de dos formas:
 *   GET  — una sola vez, para verificar que la URL es nuestra (hub.challenge).
 *   POST — cada mensaje entrante.
 */

/* ── GET: el apretón de manos de Meta ─────────────────────────────────────
   Meta manda hub.verify_token y espera que le devolvamos hub.challenge tal
   cual, en texto plano. Si el token no calza, 403. */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const modo = p.get("hub.mode");
  const token = p.get("hub.verify_token");
  const reto = p.get("hub.challenge");

  const esperado = process.env.WA_VERIFY_TOKEN;
  if (!esperado) {
    return new NextResponse("falta WA_VERIFY_TOKEN en el servidor", { status: 500 });
  }
  if (modo === "subscribe" && token === esperado && reto) {
    return new NextResponse(reto, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

/* ── Firma de Meta ─────────────────────────────────────────────────────────
   Meta firma cada POST con el secreto de la app. Verificarlo es lo que impide
   que cualquiera invente mensajes contra esta URL — el verify_token sólo
   protege el alta, no los envíos. Si no hay secreto configurado se deja pasar
   y se avisa en el log: prefiero recibir leads sin firmar a perderlos, pero
   esto no debería quedarse así. */
function firmaValida(crudo: string, firma: string | null): boolean {
  const secreto = process.env.WA_APP_SECRET;
  if (!secreto) {
    console.warn("WhatsApp: sin WA_APP_SECRET, no se verifica la firma de Meta");
    return true;
  }
  if (!firma?.startsWith("sha256=")) return false;
  const esperada = "sha256=" + crypto.createHmac("sha256", secreto).update(crudo).digest("hex");
  const a = Buffer.from(firma);
  const b = Buffer.from(esperada);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* ── Lo que se puede leer de un texto libre ────────────────────────────────
   Sin inventar: sólo se extrae lo que la persona nombró explícitamente. Si
   escribe "quiero remodelar mi cocina de 20 m2", eso son 2 datos reales. Si
   escribe "hola", no se extrae nada y el lead entra igual, con su teléfono. */
function leerDelTexto(texto: string) {
  const tipo = normalizarTipo(texto);

  // "20 m2", "20m²", "20 metros cuadrados". Se exige la unidad: un número
  // suelto en una frase no es una superficie.
  const m = texto.match(/(\d{1,4}(?:[.,]\d+)?)\s*(?:m2|m²|mts?2?|metros?\s*cuadrados?)/i);
  const m2 = m ? normalizarM2(m[0]) : 0;

  const t = tipo ? config().tipos[tipo as TipoProyecto] : null;
  const coherente = !!(t && m2 > 0 && m2 >= t.superficie.min && m2 <= t.superficie.max);

  return { tipo, m2: coherente ? m2 : 0 };
}

export async function POST(req: NextRequest) {
  const crudo = await req.text();

  if (!firmaValida(crudo, req.headers.get("x-hub-signature-256"))) {
    return new NextResponse("firma_invalida", { status: 401 });
  }

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = JSON.parse(crudo);
  } catch {
    return NextResponse.json({ ok: false, error: "json_invalido" }, { status: 400 });
  }

  if (cuerpo.object !== "whatsapp_business_account") {
    // No es nuestro: 200 igual, o Meta reintenta en bucle.
    return NextResponse.json({ ok: true, ignorado: "objeto_no_esperado" });
  }

  type Entrada = {
    changes?: {
      value?: {
        messages?: { from?: string; type?: string; text?: { body?: string }; timestamp?: string }[];
        contacts?: { profile?: { name?: string }; wa_id?: string }[];
        statuses?: unknown[];
      };
    }[];
  };
  const entradas = (cuerpo.entry as Entrada[]) ?? [];
  const procesados: { id: string; score: number; clasificacion: string }[] = [];

  for (const entrada of entradas) {
    for (const cambio of entrada.changes ?? []) {
      const v = cambio.value ?? {};

      // Los acuses de entrega también llegan por acá. No son leads.
      if (!v.messages?.length) continue;

      for (const msg of v.messages) {
        const de = String(msg.from ?? "");
        if (!de) continue;

        const perfil = v.contacts?.find((c) => c.wa_id === de)?.profile?.name ?? "";
        const texto = msg.type === "text" ? String(msg.text?.body ?? "") : "";

        // Un mensaje que no es texto (audio, imagen, ubicación) igual es un
        // lead: la persona escribió. Se registra diciendo qué mandó.
        const contenido = texto || `[${msg.type ?? "mensaje"} recibido por WhatsApp]`;
        const { tipo, m2 } = leerDelTexto(texto);

        const r = await registrarLead({
          canal: "whatsapp",
          nombre: perfil,
          telefono: de,
          tipo_proyecto: tipo,
          superficie_m2: m2 || "",
          mensaje: contenido,
          fuente_original: "whatsapp",
        });

        if (r.ok) {
          procesados.push({ id: r.id, score: r.score, clasificacion: r.clasificacion });
        } else {
          console.error("WhatsApp: no se pudo registrar", r.error, r.detalle);
        }
      }
    }
  }

  // Siempre 200: si Meta recibe un error, reintenta el mismo mensaje durante
  // horas. Lo que falle queda en el log, no en una cola de reintentos.
  return NextResponse.json({ ok: true, procesados: procesados.length });
}
