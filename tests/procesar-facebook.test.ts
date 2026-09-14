import { test } from "node:test";
import assert from "node:assert/strict";
import { procesarFacebook, type EntradaFB } from "../lib/procesar-facebook";
import { dbFalsa } from "./db-falsa";

console.error = () => {};

const entrada = (msg: Record<string, unknown>, senderId = "298712345098765"): EntradaFB => ({
  messaging: [{ sender: { id: senderId }, message: { mid: "fb-mid-1", ...msg } }],
});

test("un DM de texto crea el lead SIN CONTACTO, guarda el mensaje con su id de Meta y pide aviso", async () => {
  const { db, tablas } = dbFalsa();
  const r = await procesarFacebook([entrada({ mid: "fb-mid.A1", text: "quiero remodelar mi baño de 6 m2" })], db);
  assert.equal(r.procesados, 1);
  assert.equal(tablas.leads.length, 1);
  assert.equal(tablas.leads[0].canal, "facebook");
  assert.equal(tablas.leads[0].tipo_proyecto, "bano");
  assert.equal(tablas.leads[0].superficie_m2, 6);
  assert.equal(tablas.leads[0].etiqueta, "SIN CONTACTO");
  assert.equal(tablas.leads[0].sesion_id, "fb:298712345098765");
  assert.equal(tablas.mensajes[0].asunto, "facebook:fb-mid.A1");
  assert.equal(r.avisos.length, 1);
  assert.match(r.avisos[0].url, /^\/\?lead=/);
});

test("un reintento de Meta con el mismo id no duplica ni vuelve a avisar", async () => {
  const { db, tablas } = dbFalsa();
  const m = entrada({ mid: "fb-mid.B2", text: "hola" });
  await procesarFacebook([m], db);
  const r2 = await procesarFacebook([m], db);
  assert.equal(r2.duplicados, 1);
  assert.equal(r2.avisos.length, 0);
  assert.equal(tablas.mensajes.length, 1);
});

test("el eco de un mensaje que nosotros mandamos no se registra como DM entrante", async () => {
  const { db, tablas } = dbFalsa();
  const r = await procesarFacebook([entrada({ mid: "fb-mid.C3", text: "Gracias por escribirnos", is_echo: true })], db);
  assert.equal(r.procesados, 0);
  assert.equal(tablas.leads.length, 0);
});

test("un mismo PSID en dos DM seguidos actualiza el mismo lead en vez de duplicarlo", async () => {
  const { db, tablas } = dbFalsa();
  await procesarFacebook([entrada({ mid: "fb-mid.D1", text: "hola" })], db);
  await procesarFacebook([entrada({ mid: "fb-mid.D2", text: "quiero una cocina de 20 m2" })], db);
  assert.equal(tablas.leads.length, 1);
  assert.equal(tablas.leads[0].tipo_proyecto, "cocina");
  assert.equal(tablas.mensajes.length, 2);
});

test("un adjunto sin texto se guarda como mensaje legible sin inventar tipo de proyecto", async () => {
  const { db, tablas } = dbFalsa();
  const r = await procesarFacebook([entrada({ mid: "fb-mid.E1", attachments: [{ type: "image" }] })], db);
  assert.equal(r.procesados, 1);
  assert.equal(tablas.mensajes[0].cuerpo, "[image recibido por Messenger]");
  assert.equal(tablas.leads[0].tipo_proyecto, null);
});
