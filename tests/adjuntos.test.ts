import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { separarAdjunto, guardarAdjunto, BUCKET } from "../lib/adjuntos";
import { dbFalsa } from "./db-falsa";

/**
 * La foto de la cocina que manda un cliente por WhatsApp es irrecuperable: Meta
 * entrega una URL que vence a los pocos minutos y no hay segunda oportunidad.
 * Por eso lo que más importa acá es que un fallo se registre y devuelva null en
 * vez de lanzar: si esto revienta, se cae el webhook entero y se pierde también
 * el mensaje, no solo la foto.
 */

const ENV = { ...process.env };
const fetchReal = globalThis.fetch;
const errorReal = console.error;

beforeEach(() => {
  process.env.WA_ACCESS_TOKEN = "token-de-prueba";
  console.error = () => {};
});

afterEach(() => {
  process.env = { ...ENV };
  globalThis.fetch = fetchReal;
  console.error = errorReal;
});

const medio = { id: "media-1", tipo: "image", mime: "image/jpeg", nombre: "cocina.jpg" };

/** Meta responde primero los datos del medio y después el archivo. */
function metaEntrega(info: unknown, bytes = 1024, okArchivo = true) {
  let llamada = 0;
  globalThis.fetch = (async () => {
    llamada++;
    if (llamada === 1) {
      return new Response(JSON.stringify(info), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response(okArchivo ? new Uint8Array(bytes) : null, { status: okArchivo ? 200 : 404 });
  }) as typeof fetch;
}

/* ── la marca del adjunto dentro del texto ──────────────────────────────── */

test("un mensaje sin adjunto queda igual y sin ruta", () => {
  assert.deepEqual(separarAdjunto("hola, quiero cotizar"), { texto: "hola, quiero cotizar", ruta: null });
  assert.deepEqual(separarAdjunto(null), { texto: "", ruta: null });
});

test("la ruta del adjunto se separa del texto visible", () => {
  const r = separarAdjunto("mira mi cocina\nadjunto:whatsapp/2026-09/abc.jpg");
  assert.equal(r.texto, "mira mi cocina");
  assert.equal(r.ruta, "whatsapp/2026-09/abc.jpg");
});

test("un adjunto sin texto deja el texto vacío", () => {
  assert.deepEqual(separarAdjunto("\nadjunto:whatsapp/2026-09/x.ogg"), { texto: "", ruta: "whatsapp/2026-09/x.ogg" });
});

test("la palabra 'adjunto:' en medio del mensaje no se confunde con la marca", () => {
  const r = separarAdjunto("te mando el adjunto: la foto de la cocina");
  assert.equal(r.ruta, null);
  assert.equal(r.texto, "te mando el adjunto: la foto de la cocina");
});

/* ── descarga y guardado ────────────────────────────────────────────────── */

test("una foto se descarga de Meta y queda en el bucket privado", async () => {
  const { db, guardados, buckets } = dbFalsa();
  metaEntrega({ url: "https://lookaside.fb/media", mime_type: "image/jpeg", file_size: 1024 });

  const ruta = await guardarAdjunto(db, medio, "wamid.ABC123");

  assert.ok(ruta, "debería devolver la ruta");
  assert.match(ruta!, /^whatsapp\/\d{4}-\d{2}\/wamidABC123\.jpg$/);
  assert.deepEqual(buckets, [BUCKET], "crea el bucket la primera vez");
  assert.equal(guardados.length, 1);
  assert.equal(guardados[0].bucket, BUCKET);
  assert.equal(guardados[0].contentType, "image/jpeg");
});

test("sin token de WhatsApp no se intenta descargar nada", async () => {
  delete process.env.WA_ACCESS_TOKEN;
  const { db, guardados } = dbFalsa();
  assert.equal(await guardarAdjunto(db, medio, "wamid.X"), null);
  assert.equal(guardados.length, 0);
});

test("si Meta no entrega la URL, se devuelve null sin lanzar", async () => {
  const { db, guardados } = dbFalsa();
  metaEntrega({ mime_type: "image/jpeg" });
  assert.equal(await guardarAdjunto(db, medio, "wamid.X"), null);
  assert.equal(guardados.length, 0);
});

test("un archivo demasiado grande se descarta antes de descargarlo", async () => {
  const { db, guardados } = dbFalsa();
  metaEntrega({ url: "https://lookaside.fb/media", file_size: 21 * 1024 * 1024 });
  assert.equal(await guardarAdjunto(db, medio, "wamid.X"), null);
  assert.equal(guardados.length, 0);
});

test("si la descarga del archivo falla, no se guarda nada", async () => {
  const { db, guardados } = dbFalsa();
  metaEntrega({ url: "https://lookaside.fb/media" }, 1024, false);
  assert.equal(await guardarAdjunto(db, medio, "wamid.X"), null);
  assert.equal(guardados.length, 0);
});

test("si se cae la red, devuelve null en vez de tumbar el webhook", async () => {
  const { db } = dbFalsa();
  globalThis.fetch = (async () => {
    throw new Error("sin señal");
  }) as typeof fetch;
  assert.equal(await guardarAdjunto(db, medio, "wamid.X"), null);
});

test("un id de mensaje con caracteres raros no arma una ruta peligrosa", async () => {
  const { db } = dbFalsa();
  metaEntrega({ url: "https://lookaside.fb/media", mime_type: "image/jpeg" });
  const ruta = await guardarAdjunto(db, medio, "../../etc/passwd");
  assert.ok(ruta);
  assert.ok(!ruta!.includes(".."), `la ruta no debe salirse del bucket: ${ruta}`);
  assert.match(ruta!, /^whatsapp\/\d{4}-\d{2}\/etcpasswd\./);
});

test("un audio se guarda con la extensión que le corresponde", async () => {
  const { db, guardados } = dbFalsa();
  metaEntrega({ url: "https://lookaside.fb/media", mime_type: "audio/ogg" });
  const ruta = await guardarAdjunto(db, { id: "m2", tipo: "audio", mime: "audio/ogg", nombre: "" }, "wamid.AUDIO");
  assert.ok(ruta);
  assert.equal(guardados[0].contentType, "audio/ogg");
});
