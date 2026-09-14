import { test } from "node:test";
import assert from "node:assert/strict";
import { procesarInstagram, type EntradaIG } from "../lib/procesar-instagram";
import { dbFalsa } from "./db-falsa";

console.error = () => {};

const entrada = (msg: Record<string, unknown>, senderId = "179087654321"): EntradaIG => ({
  messaging: [{ sender: { id: senderId }, message: { mid: "ig-mid-1", ...msg } }],
});

test("un DM de texto crea el lead SIN CONTACTO, guarda el mensaje con su id de Meta y pide aviso", async () => {
  const { db, tablas } = dbFalsa();
  const r = await procesarInstagram([entrada({ mid: "ig-mid.A1", text: "quiero remodelar mi cocina de 20 m2" })], db);
  assert.equal(r.procesados, 1);
  assert.equal(tablas.leads.length, 1);
  assert.equal(tablas.leads[0].canal, "instagram");
  assert.equal(tablas.leads[0].tipo_proyecto, "cocina");
  assert.equal(tablas.leads[0].superficie_m2, 20);
  assert.equal(tablas.leads[0].etiqueta, "SIN CONTACTO");
  assert.equal(tablas.leads[0].sesion_id, "ig:179087654321");
  assert.equal(tablas.mensajes[0].asunto, "instagram:ig-mid.A1");
  assert.equal(r.avisos.length, 1);
  assert.match(r.avisos[0].url, /^\/\?lead=/);
});

test("un reintento de Meta con el mismo id no duplica ni vuelve a avisar", async () => {
  const { db, tablas } = dbFalsa();
  const m = entrada({ mid: "ig-mid.B2", text: "hola" });
  await procesarInstagram([m], db);
  const r2 = await procesarInstagram([m], db);
  assert.equal(r2.duplicados, 1);
  assert.equal(r2.avisos.length, 0);
  assert.equal(tablas.mensajes.length, 1);
});

test("el eco de un mensaje que nosotros mandamos no se registra como DM entrante", async () => {
  const { db, tablas } = dbFalsa();
  const r = await procesarInstagram([entrada({ mid: "ig-mid.C3", text: "Gracias por escribirnos", is_echo: true })], db);
  assert.equal(r.procesados, 0);
  assert.equal(tablas.leads.length, 0);
});

test("un mismo IGSID en dos DM seguidos actualiza el mismo lead en vez de duplicarlo", async () => {
  const { db, tablas } = dbFalsa();
  await procesarInstagram([entrada({ mid: "ig-mid.D1", text: "hola" })], db);
  await procesarInstagram([entrada({ mid: "ig-mid.D2", text: "quiero un baño de 6 m2" })], db);
  assert.equal(tablas.leads.length, 1);
  assert.equal(tablas.leads[0].tipo_proyecto, "bano");
  assert.equal(tablas.mensajes.length, 2);
});

test("si escribe su teléfono en el DM, el lead deja de estar SIN CONTACTO", async () => {
  const { db, tablas } = dbFalsa();
  await procesarInstagram(
    [entrada({ mid: "ig-mid.T1", text: "hola, quiero cotizar una cocina de 20 m2, llámame al 9 8765 4321" })],
    db,
  );
  assert.equal(tablas.leads.length, 1);
  assert.equal(tablas.leads[0].telefono, "56987654321");
  assert.notEqual(tablas.leads[0].etiqueta, "SIN CONTACTO");
});

test("un DM se junta con la ficha que ya existía de esa persona, por el teléfono", async () => {
  // El caso real: alguien ya registrado por el sitio escribe después por
  // Instagram. Sin leer el teléfono del texto quedaban dos fichas separadas.
  const { db, tablas } = dbFalsa([
    { id: "lead-viejo", nombre: "Ana Pérez", telefono: "56987654321", canal: "web", clasificacion: "B", score: 50 },
  ]);
  await procesarInstagram([entrada({ mid: "ig-mid.T2", text: "soy Ana, mi fono es +56 9 8765 4321" })], db);
  assert.equal(tablas.leads.length, 1, "no se crea una ficha nueva");
  assert.equal(tablas.leads[0].nombre, "Ana Pérez", "no se pierde el nombre que ya se sabía");
});

test("las cifras del proyecto no se confunden con un teléfono", async () => {
  const { db, tablas } = dbFalsa();
  await procesarInstagram(
    [entrada({ mid: "ig-mid.T3", text: "quiero un quincho de 30 m2, tengo 2.000 UF de presupuesto" })],
    db,
  );
  assert.equal(tablas.leads[0].telefono, null);
  assert.equal(tablas.leads[0].etiqueta, "SIN CONTACTO");
});

test("un adjunto sin texto se guarda como mensaje legible sin inventar tipo de proyecto", async () => {
  const { db, tablas } = dbFalsa();
  const r = await procesarInstagram([entrada({ mid: "ig-mid.E1", attachments: [{ type: "image" }] })], db);
  assert.equal(r.procesados, 1);
  assert.equal(tablas.mensajes[0].cuerpo, "[image recibido por Instagram]");
  assert.equal(tablas.leads[0].tipo_proyecto, null);
});
