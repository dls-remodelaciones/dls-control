import { test } from "node:test";
import assert from "node:assert/strict";
import { procesarWhatsApp, leerDelTexto, type CambioWA } from "../lib/procesar-whatsapp";
import { dbFalsa } from "./db-falsa";

console.error = () => {};

const cambio = (msg: Record<string, unknown>, nombre = "Ana Pérez"): CambioWA => ({
  value: {
    contacts: [{ wa_id: "56912345678", profile: { name: nombre } }],
    messages: [{ from: "56912345678", ...msg }],
  },
});

test("un texto crea el lead, guarda el mensaje con su id de Meta y pide aviso", async () => {
  const { db, tablas } = dbFalsa();
  const r = await procesarWhatsApp([cambio({ id: "wamid.A1", type: "text", text: { body: "quiero remodelar mi cocina de 20 m2" } })], db);
  assert.equal(r.procesados, 1);
  assert.equal(tablas.leads.length, 1);
  assert.equal(tablas.leads[0].tipo_proyecto, "cocina");
  assert.equal(tablas.leads[0].superficie_m2, 20);
  assert.equal(tablas.mensajes[0].asunto, "whatsapp:wamid.A1");
  assert.equal(r.avisos.length, 1);
  assert.match(r.avisos[0].url, /^\/\?lead=/);
});

test("un reintento de Meta con el mismo id no duplica ni vuelve a avisar", async () => {
  const { db, tablas } = dbFalsa();
  const m = cambio({ id: "wamid.B2", type: "text", text: { body: "hola" } });
  await procesarWhatsApp([m], db);
  const r2 = await procesarWhatsApp([m], db);
  assert.equal(r2.duplicados, 1);
  assert.equal(r2.avisos.length, 0);
  assert.equal(tablas.mensajes.length, 1);
});

test("una foto se registra al tiro y la descarga queda para después", async () => {
  const { db, tablas } = dbFalsa();
  const r = await procesarWhatsApp([cambio({ id: "wamid.C3", type: "image", image: { id: "media-1", caption: "así está hoy" } })], db);
  assert.equal(tablas.mensajes[0].cuerpo, "[foto] así está hoy");
  assert.equal(r.adjuntos.length, 1);
  assert.equal(r.adjuntos[0].medio.id, "media-1");
});

test("los acuses fallidos se devuelven para avisar, sin crear leads", async () => {
  const { db, tablas } = dbFalsa();
  const r = await procesarWhatsApp(
    [{ value: { statuses: [{ status: "failed", recipient_id: "56999999999", errors: [{ code: 131047 }] }] } }],
    db,
  );
  assert.equal(r.noEntregados.length, 1);
  assert.equal(tablas.leads.length, 0);
});

test("leer del texto: solo con unidad y dentro del rango típico", () => {
  assert.deepEqual(leerDelTexto("baño de 6 m2"), { tipo: "bano", m2: 6 });
  assert.deepEqual(leerDelTexto("tengo 3 hijos y un baño"), { tipo: "bano", m2: 0 });
  assert.deepEqual(leerDelTexto("cocina de 900 metros cuadrados"), { tipo: "cocina", m2: 0 });
});
