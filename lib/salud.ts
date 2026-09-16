import { supabaseAdmin } from "@/lib/supabase-admin";
import { diferenciasConfig } from "@/lib/paridad";
import { HOSTS_CRITICOS, scriptsLocales } from "@/lib/scripts-sitio";
import { revisarDatosGoogle } from "@/lib/datos-google";
import { resumirContactoPublicado, revisarContactoPublicado } from "@/lib/contacto-publicado";
import { atrasadas, leerLatidos } from "@/lib/latidos";
import { config } from "@/lib/negocio";
import { BUCKET as BUCKET_RESPALDOS, DIAS_SIN_RESPALDO, ultimoRespaldo } from "@/lib/respaldo";
import { CLAVE as CLAVE_ERRORES, UMBRAL_24H, resumen as resumenErrores, type ErrorSitio } from "@/lib/errores";
import { consultarWhois, leerVencimiento } from "@/lib/dominio";
import { CLAVE as CLAVE_DOMINIO, estadoDominio, type DominioVisto } from "@/lib/dominio-memoria";
import { DIAS_SILENCIO, diasSinLeads, type EstadoNombre } from "@/lib/novedades";
import { CLAVE as CLAVE_CORREOS, limite, proximoReinicio, vigente, type Uso } from "@/lib/correos";
import { revisarForma } from "@/lib/dm";

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

const GRAPH = "https://graph.facebook.com/v23.0";
/** Instagram Login no habla por graph.facebook.com (ver lib/dm.ts). */
const GRAPH_IG = "https://graph.instagram.com/v23.0";
const SITIO = "https://www.dlsremodelaciones.cl";
/** El único dominio de correo de la empresa. Cualquier otro proveedor es personal. */
const DOMINIO_OFICIAL = "dlsremodelaciones.cl";
const PANEL = "https://dls-control.vercel.app";
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
  // Instagram y Messenger: sin estas, sus webhooks devuelven 500 o rechazan a
  // Meta, y los DM dejan de entrar sin que nada más lo note.
  "IG_APP_SECRET",
  "IG_VERIFY_TOKEN",
  "FB_VERIFY_TOKEN",
  // Sin este no se puede responder un DM de Instagram desde el panel.
  "IG_ACCESS_TOKEN",
  "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
];

/**
 * Canales de Meta que entran por webhook propio. Messenger no lleva
 * FB_APP_SECRET a propósito: comparte la app de Meta con WhatsApp y el webhook
 * cae de vuelta en WA_APP_SECRET (ver app/api/facebook/webhook/route.ts).
 */
const WEBHOOKS_META = [
  { nombre: "Instagram", ruta: "/api/instagram/webhook" },
  { nombre: "Messenger", ruta: "/api/facebook/webhook" },
] as const;

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

export async function revisarSalud(): Promise<{ chequeos: Chequeo[]; nombreMeta: EstadoNombre | null }> {
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

    // Silencio: varios días sin ningún lead casi siempre es algo roto.
    const { data: ultimo } = await db.from("leads").select("creado").order("creado", { ascending: false }).limit(1);
    const dias = diasSinLeads((ultimo?.[0]?.creado as string | undefined) ?? null, new Date());
    if (dias !== null) {
      anotar(
        "Leads entrando",
        dias < DIAS_SILENCIO,
        dias === 0
          ? "Entró al menos uno en las últimas 24 horas."
          : dias < DIAS_SILENCIO
            ? `El último entró hace ${dias} ${dias === 1 ? "día" : "días"}.`
            : `No entra ningún lead hace ${dias} días. Prueba el cotizador y el chatbot del sitio: algo puede estar roto.`,
      );
    }

    // Tareas automáticas: cada una deja un latido (lib/latidos.ts).
    const retrasos = atrasadas(await leerLatidos(db), new Date());
    anotar(
      "Tareas automáticas",
      retrasos.length === 0,
      retrasos.length === 0 ? "Los recordatorios y el resumen semanal están corriendo." : retrasos.join(". ") + ".",
    );

    // Respaldo: si el cron del domingo dejó de correr, que se note antes de necesitarlo.
    const { data: archivos, error: eResp } = await db.storage.from(BUCKET_RESPALDOS).list("", { limit: 1000 });
    const ultimoResp = eResp ? null : ultimoRespaldo((archivos ?? []).map((a) => a.name));
    const diasResp = ultimoResp ? Math.floor((Date.now() - Date.parse(ultimoResp + "T00:00:00Z")) / 86_400_000) : null;
    anotar(
      "Respaldo semanal",
      diasResp !== null && diasResp <= DIAS_SIN_RESPALDO,
      diasResp === null
        ? "No hay ningún respaldo de los datos todavía."
        : diasResp <= DIAS_SIN_RESPALDO
          ? `Último respaldo: ${ultimoResp}.`
          : `El último respaldo es del ${ultimoResp} (hace ${diasResp} días): el respaldo semanal dejó de funcionar.`,
    );

    // Errores de JavaScript de los visitantes: si se repiten, algo del sitio está roto para alguien.
    const { data: filaErrores } = await db.from("config").select("valor").eq("clave", CLAVE_ERRORES).maybeSingle();
    const re = resumenErrores((filaErrores?.valor as ErrorSitio[] | undefined) ?? [], new Date());
    anotar(
      "Errores en el sitio",
      re.cantidad < UMBRAL_24H,
      re.cantidad === 0
        ? "Ningún visitante tuvo errores en las últimas 24 horas."
        : re.cantidad < UMBRAL_24H
          ? `${re.cantidad} error(es) aislado(s) en 24 horas.`
          : `${re.cantidad} errores de visitantes en 24 horas. El que más se repite (${re.veces} veces): ${re.masComun}. Puede que el cotizador o el chatbot no funcionen para algunos clientes.`,
    );

    // Cupo de EmailJS. Se avisa al 80 %: con el tope encima ya no hay margen
    // para cambiar de plan antes de que los correos dejen de salir.
    const { data: fila } = await db.from("config").select("valor").eq("clave", CLAVE_CORREOS).maybeSingle();
    const ahora = new Date();
    const uso = vigente((fila?.valor as Uso | undefined) ?? null, ahora);
    const tope = limite();
    anotar(
      "Cupo de correos",
      uso.cantidad < tope * 0.8,
      `${uso.cantidad} de ${tope} correos de EmailJS en este ciclo (se reinicia el ${proximoReinicio(ahora)}).` +
        (uso.cantidad >= tope * 0.8
          ? uso.cantidad >= tope
            ? " Llegó al tope: los correos a clientes NO están saliendo."
            : " Queda poco: al llegar al tope los correos dejan de salir."
          : ""),
    );
  }

  // 3. WhatsApp: token vivo y número correcto.
  const token = env("WA_ACCESS_TOKEN");
  let numeroMeta = "";
  let nombreMeta: EstadoNombre | null = null;
  if (token && env("WA_PHONE_NUMBER_ID")) {
    try {
      const r = await traer(
        `${GRAPH}/${env("WA_PHONE_NUMBER_ID")}?fields=display_phone_number,verified_name,name_status,new_name_status`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const j = (await r.json()) as {
        display_phone_number?: string;
        verified_name?: string;
        name_status?: string;
        new_name_status?: string;
        error?: { message?: string };
      };
      numeroMeta = soloDigitos(j.display_phone_number ?? "");
      if (r.ok) {
        nombreMeta = { nombre: j.verified_name ?? "", estado: j.name_status ?? "", nuevo: j.new_name_status ?? "" };
      }
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

  // 4b. Instagram y Messenger: el mismo apretón de manos que hace Meta cuando
  //     re-verifica un webhook. Es la única forma de saber desde acá que el DM
  //     de un cliente todavía tiene por dónde entrar: si la ruta se cayó, el
  //     verify token cambió o la variable desapareció, un DM se pierde y hoy no
  //     lo nota nadie hasta que el cliente reclama que nunca le respondieron.
  for (const { nombre, ruta } of WEBHOOKS_META) {
    const esperado = env(nombre === "Instagram" ? "IG_VERIFY_TOKEN" : "FB_VERIFY_TOKEN");
    if (!esperado) {
      anotar(`${nombre}: entrada de mensajes`, false, `Falta su clave en Vercel: los DM de ${nombre} no entran.`);
      continue;
    }
    const reto = `salud${Date.now()}`;
    try {
      const r = await traer(
        `${PANEL}${ruta}?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(esperado)}&hub.challenge=${reto}`,
      );
      const cuerpo = (await r.text()).trim();
      anotar(
        `${nombre}: entrada de mensajes`,
        r.ok && cuerpo === reto,
        r.ok && cuerpo === reto
          ? "El webhook responde a Meta."
          : `El webhook respondió ${r.status}: los mensajes de ${nombre} no están entrando al panel.`,
      );
    } catch (e) {
      anotar(
        `${nombre}: entrada de mensajes`,
        false,
        `No se pudo probar el webhook: ${e instanceof Error ? e.message : e}`,
      );
    }
  }

  // 4c. El identificador de acceso de Instagram, que es lo que permite RESPONDER
  //     un DM desde el panel. Los de Instagram Login caducan (unos 60 días) y el
  //     día que eso pase no avisa nadie: el webhook sigue recibiendo igual, y el
  //     fallo aparece recién cuando Daniel intenta contestarle a un cliente.
  const tokenIG = env("IG_ACCESS_TOKEN");
  if (tokenIG) {
    const forma = revisarForma(tokenIG);
    if (forma) {
      anotar("Instagram: responder DM", false, forma);
    } else {
      try {
        const r = await traer(`${GRAPH_IG}/me?fields=id,username`, {
          headers: { Authorization: `Bearer ${tokenIG}` },
        });
        const j = (await r.json()) as { username?: string; error?: { message?: string } };
        anotar(
          "Instagram: responder DM",
          r.ok,
          r.ok
            ? `Identificador vivo, cuenta @${j.username ?? "?"}.`
            : `Meta lo rechazó (${j.error?.message ?? r.status}). No se pueden responder los DM hasta generar otro en Casos de uso → Instagram.`,
        );
      } catch (e) {
        anotar("Instagram: responder DM", false, `No se pudo consultar a Meta: ${e instanceof Error ? e.message : e}`);
      }
    }
  }

  // 5. El sitio: arriba, con el mismo token que el panel y el número correcto.
  try {
    const marca = Date.now();
    const [home, lead, cotizador, reglas] = await Promise.all([
      traer(`${SITIO}/`),
      traer(`${SITIO}/dls-lead.js?salud=${marca}`),
      traer(`${SITIO}/dls-cotizador-embed.js?salud=${marca}`),
      traer(`${SITIO}/config/negocio.json?salud=${marca}`),
    ]);
    anotar("Sitio web", home.ok, home.ok ? "Carga." : `dlsremodelaciones.cl respondió ${home.status}.`);

    // Los scripts que pide la portada: si falta uno, el cotizador o el chatbot se apagan en silencio.
    if (home.ok) {
      const htmlHome = await home.text();
      const srcs = scriptsLocales(htmlHome, SITIO, HOSTS_CRITICOS);

      // Datos para Google: JSON válido, con preguntas frecuentes y el teléfono de la empresa.
      const g = revisarDatosGoogle(htmlHome);
      const telefonoMal = Boolean(numeroMeta && g.telefono && g.telefono !== numeroMeta);
      anotar(
        "Datos para Google",
        g.bloques > 0 && g.invalidos === 0 && g.tienePreguntas && Boolean(g.telefono) && !telefonoMal,
        g.bloques === 0
          ? "La portada perdió los datos para Google (teléfono, dirección, preguntas frecuentes)."
          : g.invalidos > 0
            ? `${g.invalidos} bloque(s) de datos para Google tienen un error de formato: Google los ignora.`
            : !g.telefono
              ? "Los datos para Google no traen el teléfono del negocio."
              : telefonoMal
                ? `Google muestra el teléfono +${g.telefono}, pero el WhatsApp de la empresa es +${numeroMeta}.`
                : !g.tienePreguntas
                  ? "Los datos para Google ya no traen las preguntas frecuentes."
                  : "Datos para Google válidos, con el teléfono de la empresa y las preguntas frecuentes.",
      );
      // Que solo se publiquen datos de la empresa. No rompe nada tener un correo
      // o un teléfono personal a la vista —el sistema sigue andando— y por eso
      // hay que vigilarlo: el cliente que escriba ahí no entra al panel y no
      // queda ni el rastro de que existió.
      //
      // Se revisa el sitio Y la página de ingreso del panel, que es pública y
      // fue justo donde apareció el problema el 14-sep-2026: un correo personal
      // de ejemplo en el campo, a la vista de cualquiera.
      const dondeMirar = { dominioOficial: DOMINIO_OFICIAL, telefonoOficial: numeroMeta };
      const paginas = [{ donde: "el sitio", contacto: revisarContactoPublicado(htmlHome, dondeMirar) }];
      const ingreso = await traer(`${PANEL}/login`);
      if (ingreso.ok) {
        paginas.push({
          donde: "la página de ingreso",
          contacto: revisarContactoPublicado(await ingreso.text(), dondeMirar),
        });
      }
      const vContacto = resumirContactoPublicado(paginas, DOMINIO_OFICIAL);
      anotar("Datos de contacto publicados", vContacto.ok, vContacto.detalle);

      const rotos = (
        await Promise.all(
          srcs.map(async (src) => {
            try {
              const r = await traer(src);
              return r.ok ? null : `${new URL(src).pathname} (${r.status})`;
            } catch {
              return `${new URL(src).pathname} (sin respuesta)`;
            }
          }),
        )
      ).filter((x): x is string => !!x);
      anotar(
        "Scripts del sitio",
        srcs.length > 0 && rotos.length === 0,
        srcs.length === 0
          ? "La portada no pide ningún script propio: el cotizador y el chatbot no están cargando."
          : rotos.length === 0
            ? `Cargan los ${srcs.length} scripts de la portada (incluida la librería de correos).`
            : `No cargan: ${rotos.join(", ")}. El cotizador, el chatbot o el correo de cotización pueden estar apagados.`,
      );
    }

    // El sitio y el panel tienen que calificar con las mismas reglas (lib/paridad.ts).
    if (reglas.ok) {
      try {
        const dif = diferenciasConfig((await reglas.json()) as Record<string, unknown>, config());
        anotar(
          "Reglas de puntaje",
          dif.length === 0,
          dif.length === 0
            ? "El sitio y el panel califican igual."
            : `El sitio y el panel califican distinto (${dif.length}): ${dif.slice(0, 3).join(" | ")}${dif.length > 3 ? " …" : ""}`,
        );
      } catch {
        anotar("Reglas de puntaje", false, "config/negocio.json del sitio no es un JSON válido.");
      }
    } else {
      anotar("Reglas de puntaje", false, `No se pudo leer config/negocio.json del sitio (${reglas.status}).`);
    }

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

  // 5b. Dominio: si vence, se apagan el sitio y el correo contacto@. Cuando NIC
  // no contesta se responde con la última consulta buena (lib/dominio-memoria.ts):
  // antes ese día quedaba en verde, así que el chequeo podía estar ciego para siempre.
  const whois = await consultarWhois();
  const vence = whois ? leerVencimiento(whois) : null;
  let vistoDominio: DominioVisto | null = null;
  if (db) {
    const { data } = await db.from("config").select("valor").eq("clave", CLAVE_DOMINIO).maybeSingle();
    const v = data?.valor as DominioVisto | undefined;
    if (v?.vence && v?.visto) vistoDominio = v;
  }
  const dominio = estadoDominio(vence, vistoDominio, new Date());
  anotar("Dominio", dominio.ok, dominio.detalle);
  if (db && dominio.guardar) {
    await db
      .from("config")
      .upsert({ clave: CLAVE_DOMINIO, valor: dominio.guardar, actualizado: new Date().toISOString() }, { onConflict: "clave" });
  }

  // 6. Avisos: si no hay ningún dispositivo suscrito, una falla no le llega a nadie.
  anotar(
    "Avisos al celular",
    suscritos > 0,
    suscritos > 0 ? `${suscritos} dispositivo(s) suscrito(s).` : "Ningún dispositivo tiene los avisos activados.",
  );

  return { chequeos, nombreMeta };
}
