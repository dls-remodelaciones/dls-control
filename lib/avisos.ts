import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Avisos al celular de Daniel (Web Push).
 *
 * El hueco que tapa: los leads y los WhatsApp entraban a DLS Control, pero si el
 * panel no estaba abierto nadie se enteraba. Un WhatsApp tiene 24 horas para
 * responderse con texto libre y esas horas corren igual; un lead web se enfría
 * en minutos.
 *
 * Gratis y sin servicios nuevos: el propio navegador del teléfono recibe el
 * aviso. Las claves VAPID viven en variables de entorno.
 *
 * Regla que manda: **un aviso que falla nunca rompe lo que lo disparó.** Si el
 * push no sale, el lead igual queda registrado; se anota en el log y se sigue.
 */

export interface Aviso {
  titulo: string;
  cuerpo: string;
  /** Adónde lleva el toque. */
  url?: string;
  /** Mismo tag = reemplaza al aviso anterior en vez de apilarse. */
  tag?: string;
}

let configurado: boolean | null = null;

function preparar(): boolean {
  if (configurado !== null) return configurado;
  const publica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
  const privada = (process.env.VAPID_PRIVATE_KEY ?? "").trim();
  const sujeto = process.env.VAPID_SUBJECT ?? "mailto:contacto@dlsremodelaciones.cl";
  if (!publica || !privada) {
    console.warn("Avisos: faltan las claves VAPID, no se envía nada");
    configurado = false;
    return false;
  }
  webpush.setVapidDetails(sujeto, publica, privada);
  configurado = true;
  return true;
}

export function avisosConfigurados(): boolean {
  return preparar();
}

/** Cómo sale un aviso. Se puede reemplazar en las pruebas para no salir a la red. */
export type Enviador = (
  destino: { endpoint: string; keys: { p256dh: string; auth: string } },
  carga: string,
) => Promise<unknown>;

const porWebPush: Enviador = (destino, carga) =>
  webpush.sendNotification(
    destino,
    carga,
    // urgency high: con el celular en reposo, el sistema entrega de
    // inmediato en vez de juntar el aviso para más tarde.
    { TTL: 60 * 60 * 24, urgency: "high" },
  );

/**
 * Manda el aviso a todos los dispositivos suscritos. Devuelve cuántos lo recibieron.
 *
 * `db` y `enviar` se pasan en las pruebas (mismo patrón que `registrarLead`);
 * en producción salen de las variables de entorno.
 */
export async function avisar(
  aviso: Aviso,
  db = supabaseAdmin(),
  enviar: Enviador = porWebPush,
): Promise<{ enviados: number; fallidos: number; error?: string }> {
  try {
    if (enviar === porWebPush && !preparar()) return { enviados: 0, fallidos: 0, error: "sin_claves_vapid" };
    if (!db) return { enviados: 0, fallidos: 0, error: "sin_base_de_datos" };

    const { data: subs, error } = await db.from("push_subs").select("id, endpoint, p256dh, auth");
    if (error) return { enviados: 0, fallidos: 0, error: error.message };

    const carga = JSON.stringify({
      titulo: aviso.titulo.slice(0, 80),
      cuerpo: aviso.cuerpo.slice(0, 180),
      url: aviso.url ?? "/",
      tag: aviso.tag,
    });

    let enviados = 0;
    let fallidos = 0;
    const muertos: string[] = [];

    await Promise.all(
      (subs ?? []).map(async (s) => {
        try {
          await enviar({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, carga);
          enviados++;
        } catch (e) {
          fallidos++;
          const codigo = (e as { statusCode?: number }).statusCode;
          // 404 y 410: ese dispositivo desinstaló el panel o revocó el permiso.
          // Se borra para no reintentar para siempre contra una dirección muerta.
          if (codigo === 404 || codigo === 410) muertos.push(s.id as string);
          else console.error("Avisos: fallo al enviar", codigo, (e as Error).message);
        }
      }),
    );

    if (muertos.length) await db.from("push_subs").delete().in("id", muertos);
    return { enviados, fallidos };
  } catch (e) {
    console.error("Avisos: error inesperado", e);
    return { enviados: 0, fallidos: 0, error: e instanceof Error ? e.message : String(e) };
  }
}
