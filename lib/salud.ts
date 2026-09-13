import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Revisión de salud de todo el circuito de leads.
 *
 * Existe porque casi todo lo que puede romperse acá se rompe **en silencio**:
 * un token de Meta revocado, la cuenta de WhatsApp que se desuscribe de la app,
 * un token del sitio que ya no calza con el del panel. En ninguno de esos casos
 * aparece un error en pantalla: simplemente dejan de entrar leads, y uno se
 * entera días después por un cliente que nunca recibió respuesta.
 *
 * Cada chequeo responde una pregunta concreta y, si falla, dice qué hacer en
 * palabras de Daniel. Ninguno escribe datos ni devuelve valores secretos.
 */

export interface Chequeo {
  nombre: string;
  ok: boolean;
  detalle: string;
}

const GRAPH = "https://graph.facebook.com/v21.0";
const SITIO = "https://www.dlsremodelaciones.cl";
const PLAZO_MS = 10_000;

const CLAVES = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DLS_WEBHOOK_TOKEN",
  "WA_ACCESS_TOKEN",
  "WA_PHONE_NUMBER_ID",
  "WA_WABA_ID",
  "WA_APP_SECRET",
  "WA_VERIFY_TOKEN",
  "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
];

const env = (k: string) => (process.env[k] ?? "").trim();
const soloDigitos = (s: string) => s.replace(/\D/g, "");

async function traer(url: string, init?: RequestInit) {
  return fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(PLAZO_MS) });
}

/** Lo que el sitio publicado tiene escrito en sus archivos: token y número de WhatsApp. */
export function leerSitio(lead: string, cotizador: string) {
  return {
    tokenLead: lead.match(/token:\s*'([^']+)'/)?.[1] ?? "",
    tokenCotizador: cotizador.match(/PANEL_TOKEN\s*=\s*'([^']+)'/)?.[1] ?? "",
    urlPanelCotizador: cotizador.match(/PANEL_URL\s*=\s*'([^']+)'/)?.[1] ?? "",
    numeroCotizador: soloDigitos(cotizador.match(/WA_NUM\s*=\s*'?([\d+ ]+)'?/)?.[1] ?? ""),
  };
}

export async function revisarSalud(): Promise<Chequeo[]> {
  const chequeos: Chequeo[] = [];
  const anotar = (nombre: string, ok: boolean, detalle: string) => chequeos.push({ nombre, ok, detalle });

  // 1. Variables de entorno. Sin ellas nada de lo demás puede funcionar.
  const faltan = CLAVES.filter((k) => !env(k));
  anotar(
    "Claves del servidor",
    faltan.length === 0,
    faltan.length ? `Faltan en Vercel: ${faltan.join(", ")}.` : "Están todas.",
  );

  // 2. Base de datos: si no responde, ningún lead se guarda.
  const db = supabaseAdmin();
  let suscritos = 0;
  if (!db) {
    anotar("Base de datos", false, "El panel no tiene cómo conectarse a Supabase.");
  } else {
    const { error } = await db.from("leads").select("id").limit(1);
    anotar("Base de datos", !error, error ? `Supabase respondió con error: ${error.message}` : "Responde.");
    const subs = await db.from("push_subs").select("id", { count: "exact", head: true });
    suscritos = subs.count ?? 0;
  }

  // 3. WhatsApp: token vivo y número correcto.
  const token = env("WA_ACCESS_TOKEN");
  let numeroMeta = "";
  if (token && env("WA_PHONE_NUMBER_ID")) {
    try {
      const r = await traer(`${GRAPH}/${env("WA_PHONE_NUMBER_ID")}?fields=display_phone_number`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = (await r.json()) as { display_phone_number?: string; error?: { message?: string } };
      numeroMeta = soloDigitos(j.display_phone_number ?? "");
      anotar(
        "WhatsApp: token",
        r.ok,
        r.ok
          ? `Vivo, número ${j.display_phone_number}.`
          : `Meta lo rechazó (${j.error?.message ?? r.status}). Los mensajes no están saliendo.`,
      );
    } catch (e) {
      anotar("WhatsApp: token", false, `No se pudo consultar a Meta: ${e instanceof Error ? e.message : e}`);
    }
  }

  // 4. WhatsApp: la cuenta suscrita a la app. Si se cae, Meta deja de entregar
  //    mensajes entrantes sin avisar en ninguna parte.
  if (token && env("WA_WABA_ID")) {
    try {
      const r = await traer(`${GRAPH}/${env("WA_WABA_ID")}/subscribed_apps`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = (await r.json()) as { data?: unknown[]; error?: { message?: string } };
      const n = j.data?.length ?? 0;
      anotar(
        "WhatsApp: entrada de mensajes",
        r.ok && n > 0,
        !r.ok
          ? `No se pudo consultar (${j.error?.message ?? r.status}).`
          : n > 0
            ? "La cuenta sigue suscrita a la app."
            : "La cuenta de WhatsApp ya no está suscrita a la app: los mensajes entrantes no llegan al panel.",
      );
    } catch (e) {
      anotar("WhatsApp: entrada de mensajes", false, `No se pudo consultar a Meta: ${e instanceof Error ? e.message : e}`);
    }
  }

  // 5. El sitio: arriba, con el mismo token que el panel y el número correcto.
  try {
    const marca = Date.now();
    const [home, lead, cotizador] = await Promise.all([
      traer(`${SITIO}/`),
      traer(`${SITIO}/dls-lead.js?salud=${marca}`),
      traer(`${SITIO}/dls-cotizador-embed.js?salud=${marca}`),
    ]);
    anotar("Sitio web", home.ok, home.ok ? "Carga." : `dlsremodelaciones.cl respondió ${home.status}.`);

    if (lead.ok && cotizador.ok) {
      const s = leerSitio(await lead.text(), await cotizador.text());
      const esperado = env("DLS_WEBHOOK_TOKEN");
      const calzan = !!esperado && s.tokenLead === esperado && s.tokenCotizador === esperado;
      anotar(
        "Sitio → panel",
        calzan && s.urlPanelCotizador.includes("/api/leads/webhook"),
        calzan
          ? "El sitio manda los leads al panel con el token correcto."
          : "El token del sitio no calza con el del panel: los leads del sitio se están rechazando.",
      );
      if (numeroMeta) {
        anotar(
          "Sitio → WhatsApp",
          s.numeroCotizador === numeroMeta,
          s.numeroCotizador === numeroMeta
            ? "El botón de WhatsApp del cotizador apunta al número de la empresa."
            : `El cotizador manda a ${s.numeroCotizador || "ningún número"}, pero el WhatsApp de la empresa es ${numeroMeta}.`,
        );
      }
    } else {
      anotar("Sitio → panel", false, "No se pudieron leer los archivos del sitio.");
    }
  } catch (e) {
    anotar("Sitio web", false, `No se pudo abrir dlsremodelaciones.cl: ${e instanceof Error ? e.message : e}`);
  }

  // 6. Avisos: si no hay ningún dispositivo suscrito, una falla no le llega a nadie.
  anotar(
    "Avisos al celular",
    suscritos > 0,
    suscritos > 0 ? `${suscritos} dispositivo(s) suscrito(s).` : "Ningún dispositivo tiene los avisos activados.",
  );

  return chequeos;
}
