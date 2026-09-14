import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { enviarTexto, enviarPlantilla, marcarLeido, ventanaAbierta } from "../lib/whatsapp";

/**
 * El envío por WhatsApp es lo único que responde a un cliente: el número del
 * negocio está conectado a la API y no vive en ningún teléfono. Estas pruebas
 * cubren lo que decide si un mensaje sale o no, sin tocar a Meta.
 *
 * Lo que más importa acá es la traducción del error 131047: Meta contesta con
 * un texto en inglés sobre las 24 horas que no le dice nada a quien mira el
 * panel, y el código lo convierte en "ventana_cerrada".
 */

const ENV = { ...process.env };
const fetchReal = globalThis.fetch;

/** Responde lo que Meta respondería, sin salir a la red. */
function metaResponde(status: number, cuerpo: unknown) {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(cuerpo), {
      status,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;
}

beforeEach(() => {
  process.env.WA_ACCESS_TOKEN = "token-de-prueba";
  process.env.WA_PHONE_NUMBER_ID = "123456";
});

afterEach(() => {
  process.env = { ...ENV };
  globalThis.fetch = fetchReal;
});

/* ── la ventana de 24 horas ─────────────────────────────────────────────── */

test("sin ningún mensaje del cliente la ventana nunca se abrió", () => {
  assert.deepEqual(ventanaAbierta(null), { abierta: false, horas_restantes: 0 });
  assert.deepEqual(ventanaAbierta(undefined), { abierta: false, horas_restantes: 0 });
});

test("una fecha ilegible se trata como ventana cerrada, no como abierta", () => {
  assert.deepEqual(ventanaAbierta("no es una fecha"), { abierta: false, horas_restantes: 0 });
});

test("un mensaje de hace una hora deja 23 horas para responder", () => {
  const haceUnaHora = new Date(Date.now() - 3_600_000).toISOString();
  const r = ventanaAbierta(haceUnaHora);
  assert.equal(r.abierta, true);
  assert.ok(r.horas_restantes > 22.9 && r.horas_restantes <= 23, `horas: ${r.horas_restantes}`);
});

test("pasadas las 24 horas la ventana está cerrada", () => {
  const haceVeinticinco = new Date(Date.now() - 25 * 3_600_000).toISOString();
  assert.deepEqual(ventanaAbierta(haceVeinticinco), { abierta: false, horas_restantes: 0 });
});

/* ── envío de texto libre ───────────────────────────────────────────────── */

test("sin credenciales no se intenta el envío", async () => {
  delete process.env.WA_ACCESS_TOKEN;
  const r = await enviarTexto("56956381974", "hola");
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.error, "sin_configuracion");
});

test("un teléfono que no es internacional se rechaza antes de gastar la llamada", async () => {
  for (const malo of ["+56 9 5638 1974", "123", "56956381974x", ""]) {
    const r = await enviarTexto(malo, "hola");
    assert.equal(r.ok, false, malo);
    assert.equal(r.ok === false && r.error, "telefono_invalido", malo);
  }
});

test("un mensaje en blanco no se manda", async () => {
  const r = await enviarTexto("56956381974", "   \n  ");
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.error, "mensaje_vacio");
});

test("el 131047 de Meta se traduce a ventana cerrada, en palabras entendibles", async () => {
  metaResponde(400, {
    error: { code: 131047, message: "Message failed to send because more than 24 hours have passed" },
  });
  const r = await enviarTexto("56956381974", "hola");
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.error, "ventana_cerrada");
  assert.match(r.ok === false ? r.detalle : "", /24 horas/);
});

test("el 131051 también es ventana cerrada", async () => {
  metaResponde(400, { error: { code: 131051, message: "Unsupported message type" } });
  const r = await enviarTexto("56956381974", "hola");
  assert.equal(r.ok === false && r.error, "ventana_cerrada");
});

test("cualquier otro rechazo de Meta conserva el motivo original", async () => {
  metaResponde(400, { error: { code: 100, message: "Invalid parameter" } });
  const r = await enviarTexto("56956381974", "hola");
  assert.equal(r.ok === false && r.error, "meta_rechazo");
  assert.equal(r.ok === false && r.detalle, "Invalid parameter");
});

test("un envío aceptado devuelve el id con que Meta lo identifica", async () => {
  metaResponde(200, { messages: [{ id: "wamid.ABC123" }] });
  const r = await enviarTexto("56956381974", "hola");
  assert.equal(r.ok, true);
  assert.equal(r.ok === true && r.id_mensaje, "wamid.ABC123");
});

test("si la red falla el envío no revienta, devuelve sin_conexion", async () => {
  globalThis.fetch = (async () => {
    throw new Error("socket colgado");
  }) as typeof fetch;
  const r = await enviarTexto("56956381974", "hola");
  assert.equal(r.ok === false && r.error, "sin_conexion");
});

/* ── plantillas ─────────────────────────────────────────────────────────── */

test("no se envía una plantilla sin decir cuál", async () => {
  const r = await enviarPlantilla("56956381974", "", "es_CL", []);
  assert.equal(r.ok === false && r.error, "sin_plantilla");
});

test("una plantilla aceptada devuelve el id del mensaje", async () => {
  metaResponde(200, { messages: [{ id: "wamid.PLANT1" }] });
  const r = await enviarPlantilla("56956381974", "cotizacion_lista", "es_CL", ["Ana", "cocina"]);
  assert.equal(r.ok === true && r.id_mensaje, "wamid.PLANT1");
});

/* ── tics azules ────────────────────────────────────────────────────────── */

test("marcar leído sin id de mensaje no llama a Meta", async () => {
  let llamo = false;
  globalThis.fetch = (async () => {
    llamo = true;
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  assert.equal(await marcarLeido(""), false);
  assert.equal(llamo, false);
});

test("si Meta rechaza los tics azules no se rompe nada", async () => {
  globalThis.fetch = (async () => {
    throw new Error("timeout");
  }) as typeof fetch;
  assert.equal(await marcarLeido("wamid.X"), false);
});
