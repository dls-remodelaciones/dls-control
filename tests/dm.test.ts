import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { enviarDM, leerSesion, envioConfigurado, revisarForma } from "../lib/dm";

/**
 * Responder un DM desde el panel. Lo que más importa acá es que los errores de
 * Meta lleguen traducidos: si un envío falla, quien está mirando el panel tiene
 * que entender si el cliente se quedó sin respuesta por la ventana de 24 horas
 * o porque Meta todavía no aprueba la aplicación.
 */

const ENV = { ...process.env };
const fetchReal = globalThis.fetch;

function metaResponde(status: number, cuerpo: unknown) {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(cuerpo), { status, headers: { "Content-Type": "application/json" } })) as typeof fetch;
}

// Con forma de identificador real: si no, la revisión de forma los rechaza
// antes de llegar a Meta, que es justamente lo que se quiere en producción.
const IG = "IG" + "Q".repeat(180);
const FB = "EAA" + "Z".repeat(180);

beforeEach(() => {
  process.env.IG_ACCESS_TOKEN = IG;
  process.env.FB_PAGE_ACCESS_TOKEN = FB;
});

afterEach(() => {
  process.env = { ...ENV };
  globalThis.fetch = fetchReal;
});

/* ── de dónde sale el destinatario ──────────────────────────────────────── */

test("el sesion_id dice el canal y con quién es la conversación", () => {
  assert.deepEqual(leerSesion("ig:17841400000"), { canal: "instagram", id: "17841400000" });
  assert.deepEqual(leerSesion("fb:29871234"), { canal: "facebook", id: "29871234" });
});

test("un lead que no viene de un DM no tiene a quién escribirle", () => {
  for (const v of [null, undefined, "", "wa:56912345678", "sesion-web-123", "ig:", ":123", "instagram"]) {
    assert.equal(leerSesion(v), null, String(v));
  }
});

test("un identificador con dos puntos adentro no se parte a la mitad", () => {
  assert.deepEqual(leerSesion("ig:abc:def"), { canal: "instagram", id: "abc:def" });
});

test("se sabe si falta el identificador de acceso de cada canal", () => {
  assert.equal(envioConfigurado("instagram"), true);
  delete process.env.IG_ACCESS_TOKEN;
  assert.equal(envioConfigurado("instagram"), false);
  assert.equal(envioConfigurado("facebook"), true, "el de Messenger es independiente");
});

/* ── envío ──────────────────────────────────────────────────────────────── */

test("un DM aceptado devuelve el id con que Meta lo identifica", async () => {
  metaResponde(200, { message_id: "mid.XYZ789" });
  const r = await enviarDM("ig:17841400000", "Hola Ana, te llamo en un rato");
  assert.equal(r.ok, true);
  assert.equal(r.ok === true && r.id_mensaje, "mid.XYZ789");
});

test("el envío usa el identificador de acceso del canal que corresponde", async () => {
  let visto = "";
  globalThis.fetch = (async (_u: string, init: RequestInit) => {
    visto = String((init.headers as Record<string, string>).Authorization);
    return new Response(JSON.stringify({ message_id: "m1" }), { status: 200 });
  }) as unknown as typeof fetch;

  await enviarDM("ig:1", "hola");
  assert.equal(visto, `Bearer ${IG}`, "Instagram usa su propio identificador");
  await enviarDM("fb:1", "hola");
  assert.equal(visto, `Bearer ${FB}`, "Messenger usa el de la página");
});

test("cada canal habla con su propio host de Meta", async () => {
  // Probado en producción el 2026-09-14: un identificador de Instagram Login
  // contra graph.facebook.com devuelve "Cannot parse access token", que parece
  // un token mal copiado y en realidad es el host equivocado.
  let url = "";
  globalThis.fetch = (async (u: string) => {
    url = String(u);
    return new Response(JSON.stringify({ message_id: "m1" }), { status: 200 });
  }) as unknown as typeof fetch;

  await enviarDM("ig:1", "hola");
  assert.match(url, /^https:\/\/graph\.instagram\.com\//, "Instagram Login va por graph.instagram.com");
  await enviarDM("fb:1", "hola");
  assert.match(url, /^https:\/\/graph\.facebook\.com\//, "el token de página va por graph.facebook.com");
});

test("sin identificador de acceso se dice cuál falta, no un error genérico", async () => {
  delete process.env.IG_ACCESS_TOKEN;
  const r = await enviarDM("ig:1", "hola");
  assert.equal(r.ok === false && r.error, "sin_configuracion");
  assert.match(r.ok === false ? r.detalle : "", /IG_ACCESS_TOKEN/);
});

test("un identificador cortado al copiarlo se detecta antes de llamar a Meta", async () => {
  // Meta responde "Cannot parse access token", que parece un error del código.
  // Vale más decir la verdad: el valor guardado quedó a medias.
  process.env.IG_ACCESS_TOKEN = "IGQVJabc123";
  let llamo = false;
  globalThis.fetch = (async () => {
    llamo = true;
    return new Response("{}", { status: 200 });
  }) as typeof fetch;

  const r = await enviarDM("ig:1", "hola");
  assert.equal(r.ok === false && r.error, "identificador_mal_guardado");
  assert.match(r.ok === false ? r.detalle : "", /cortado/);
  assert.match(r.ok === false ? r.detalle : "", /IG_ACCESS_TOKEN/);
  assert.equal(llamo, false, "no se gasta una llamada a Meta");
});

test("si se copió otra cosa en vez del identificador, se dice", async () => {
  process.env.IG_ACCESS_TOKEN = "https://www.instagram.com/direct/inbox/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const r = await enviarDM("ig:1", "hola");
  assert.equal(r.ok === false && r.error, "identificador_mal_guardado");
  assert.match(r.ok === false ? r.detalle : "", /IG|EAA/);
});

test("la revisión de forma acepta los identificadores de verdad", () => {
  assert.equal(revisarForma(IG), null);
  assert.equal(revisarForma(FB), null);
});

test("a un lead sin conversación no se le intenta escribir", async () => {
  const r = await enviarDM("sesion-web-9", "hola");
  assert.equal(r.ok === false && r.error, "sesion_invalida");
});

test("un mensaje en blanco no se manda", async () => {
  const r = await enviarDM("ig:1", "   \n ");
  assert.equal(r.ok === false && r.error, "mensaje_vacio");
});

/* ── errores de Meta, traducidos ────────────────────────────────────────── */

test("fuera de la ventana de 24 horas se explica en palabras", async () => {
  metaResponde(400, { error: { code: 10, message: "This message is sent outside of allowed window" } });
  const r = await enviarDM("ig:1", "hola");
  assert.equal(r.ok === false && r.error, "ventana_cerrada");
  assert.match(r.ok === false ? r.detalle : "", /24 horas/);
});

test("el rechazo por permisos de Messenger menciona la revisión de Meta", async () => {
  metaResponde(400, { error: { code: 200, message: "Permissions error" } });
  const r = await enviarDM("fb:1", "hola");
  assert.equal(r.ok === false && r.error, "sin_permiso");
  assert.match(r.ok === false ? r.detalle : "", /revisión de la aplicación/);
});

test("el mismo rechazo en Instagram no habla de revisión, porque no la necesita", async () => {
  metaResponde(400, { error: { code: 200, message: "Permissions error" } });
  const r = await enviarDM("ig:1", "hola");
  assert.equal(r.ok === false && r.error, "sin_permiso");
  assert.ok(!/revisión/.test(r.ok === false ? r.detalle : ""), "Instagram no depende del App Review");
});

test("cualquier otro rechazo conserva el motivo de Meta", async () => {
  metaResponde(400, { error: { code: 551, message: "This person isn't available right now" } });
  const r = await enviarDM("ig:1", "hola");
  assert.equal(r.ok === false && r.error, "meta_rechazo");
  assert.equal(r.ok === false && r.detalle, "This person isn't available right now");
});

test("si se cae la red el panel recibe un error, no una excepción", async () => {
  globalThis.fetch = (async () => {
    throw new Error("sin señal");
  }) as typeof fetch;
  const r = await enviarDM("ig:1", "hola");
  assert.equal(r.ok === false && r.error, "sin_conexion");
});

test("un texto larguísimo se recorta en vez de que Meta lo rechace entero", async () => {
  let enviado = "";
  globalThis.fetch = (async (_u: string, init: RequestInit) => {
    enviado = (JSON.parse(String(init.body)) as { message: { text: string } }).message.text;
    return new Response(JSON.stringify({ message_id: "m1" }), { status: 200 });
  }) as unknown as typeof fetch;
  await enviarDM("ig:1", "x".repeat(3000));
  assert.equal(enviado.length, 1000);
});
