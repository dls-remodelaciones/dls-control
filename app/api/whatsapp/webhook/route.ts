import { NextRequest, NextResponse, after } from "next/server";
import { registrarLead } from "@/lib/registrar-lead";
import { firmaValida } from "@/lib/firma-meta";
import { avisar } from "@/lib/avisos";
import { fallidos, type EstadoWA } from "@/lib/entregas";
import { textoDeMensaje, medioDe, type MensajeEntrante } from "@/lib/wa-mensajes";
import { guardarAdjunto, separarAdjunto } from "@/lib/adjuntos";
import { supabaseAdmin } from "@/lib/supabase-admin";
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

/* ── Firma de Meta: vive en lib/firma-meta.ts, con sus pruebas. ─────────── */

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

/** Aviso al celular y rastro en la ficha cuando Meta no pudo entregar un mensaje. */
async function avisarNoEntregado(telefono: string, motivo: string, codigo: number | null) {
  const db = supabaseAdmin();
  const { data: lead } = db
    ? await db.from("leads").select("id, nombre").eq("telefono", telefono).limit(1).maybeSingle()
    : { data: null };
  const quien = (lead?.nombre as string | undefined) || `+${telefono}`;
  if (db && lead?.id) {
    await db.from("actividad").insert({
      lead_id: lead.id,
      tipo: "whatsapp_no_entregado",
      despues: { motivo, codigo },
      quien: "sistema",
    });
  }
  await avisar({
    titulo: `No se entregó tu WhatsApp a ${quien}`,
    cuerpo: `Motivo: ${motivo}.`,
    url: lead?.id ? `/?lead=${lead.id}` : "/",
    tag: `wa-fallido-${telefono}`,
  });
}

export async function POST(req: NextRequest) {
  const crudo = await req.text();

  if (!firmaValida(crudo, req.headers.get("x-hub-signature-256"), process.env.WA_APP_SECRET)) {
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
        messages?: (MensajeEntrante & { from?: string; timestamp?: string })[];
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

      // Los acuses de entrega también llegan por acá. No son leads, pero un
      // "failed" significa que una respuesta de Daniel nunca llegó: se avisa.
      for (const f of fallidos((v.statuses ?? []) as EstadoWA[])) {
        after(() => avisarNoEntregado(f.telefono, f.motivo, f.codigo));
      }
      if (!v.messages?.length) continue;

      for (const msg of v.messages) {
        const de = String(msg.from ?? "");
        if (!de) continue;

        const perfil = v.contacts?.find((c) => c.wa_id === de)?.profile?.name ?? "";
        // Todo mensaje es un lead: la persona escribió. Lo que no es texto se
        // traduce (ubicación con mapa, contacto, botón) y los archivos se guardan
        // antes de que venza la URL de Meta (lib/adjuntos.ts).
        const legible = textoDeMensaje(msg);
        const medio = medioDe(msg);
        const dbAdjuntos = medio ? supabaseAdmin() : null;
        const ruta = medio && dbAdjuntos ? await guardarAdjunto(dbAdjuntos, medio, String(msg.id ?? "")) : null;
        const contenido = ruta ? `${legible}\nadjunto:${ruta}` : legible;
        const { tipo, m2 } = leerDelTexto(msg.type === "text" ? legible : "");

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
          // Cada WhatsApp avisa: es una obligación con plazo (24 horas de ventana).
          // Mismo tag por lead, así tres mensajes seguidos no apilan tres avisos.
          const quien = perfil || `+${de}`;
          const leadId = r.id;
          after(() =>
            avisar({
              titulo: `WhatsApp de ${quien}`,
              cuerpo: separarAdjunto(contenido).texto,
              url: `/?lead=${leadId}`,
              tag: `wa-${leadId}`,
            }).then(() => undefined),
          );
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
