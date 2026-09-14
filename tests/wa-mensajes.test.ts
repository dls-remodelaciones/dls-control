import { test } from "node:test";
import assert from "node:assert/strict";
import { textoDeMensaje, medioDe, extension } from "../lib/wa-mensajes";
import { normalizarComuna } from "../lib/comunas";

test("texto, fotos, audios y documentos", () => {
  assert.equal(textoDeMensaje({ type: "text", text: { body: "hola" } }), "hola");
  assert.equal(textoDeMensaje({ type: "image", image: { id: "1", caption: "mi cocina" } }), "[foto] mi cocina");
  assert.equal(textoDeMensaje({ type: "audio", audio: { id: "2", voice: true } }), "[nota de voz]");
  assert.equal(textoDeMensaje({ type: "document", document: { id: "3", filename: "planos.pdf" } }), "[documento planos.pdf]");
});

test("ubicación con enlace a Google Maps", () => {
  assert.equal(
    textoDeMensaje({ type: "location", location: { latitude: -33.41, longitude: -70.58, name: "Casa", address: "Apoquindo 6410" } }),
    "[ubicación] Casa, Apoquindo 6410 https://maps.google.com/?q=-33.41,-70.58",
  );
});

test("contactos, reacciones, botones y tipos desconocidos", () => {
  assert.equal(
    textoDeMensaje({ type: "contacts", contacts: [{ name: { formatted_name: "Juan Maestro" }, phones: [{ phone: "+56 9 1111 2222" }] }] }),
    "[contacto] Juan Maestro +56 9 1111 2222",
  );
  assert.equal(textoDeMensaje({ type: "reaction", reaction: { emoji: "👍" } }), "[reaccionó con 👍]");
  assert.equal(textoDeMensaje({ type: "button", button: { text: "Sí, retomemos" } }), "[tocó el botón] Sí, retomemos");
  assert.equal(textoDeMensaje({ type: "interactive", interactive: { list_reply: { title: "Martes" } } }), "[eligió] Martes");
  assert.equal(textoDeMensaje({ type: "order" }), "[order recibido por WhatsApp]");
});

test("detecta archivos adjuntos y su extensión", () => {
  assert.deepEqual(medioDe({ type: "image", image: { id: "abc", mime_type: "image/jpeg" } }), { id: "abc", tipo: "image", mime: "image/jpeg", nombre: "" });
  assert.equal(medioDe({ type: "text", text: { body: "x" } }), null);
  assert.equal(extension("image", "image/png"), "png");
  assert.equal(extension("audio", "audio/ogg; codecs=opus"), "ogg");
  assert.equal(extension("document", "application/octet-stream", "Presupuesto.XLSX"), "xlsx");
});

test("comunas con su nombre oficial", () => {
  assert.equal(normalizarComuna("las condes"), "Las Condes");
  assert.equal(normalizarComuna("NUNOA"), "Ñuñoa");
  assert.equal(normalizarComuna("  penalolen "), "Peñalolén");
  assert.equal(normalizarComuna("santiago centro"), "Santiago");
  assert.equal(normalizarComuna("viña del mar"), "Viña del Mar");
  assert.equal(normalizarComuna(""), "");
});
