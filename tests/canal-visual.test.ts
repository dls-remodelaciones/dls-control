import { test } from "node:test";
import assert from "node:assert/strict";
import { canalVisual } from "../lib/canal-visual";

/**
 * Lo que se juega acá es que Daniel sepa por dónde le escribieron sin abrir la
 * ficha. Dos cosas importan más que el dibujo: que cada canal tenga su propia
 * silueta y su propio color (si dos se repiten, la lista vuelve a verse plana),
 * y que un canal nuevo que nadie mapeó no desaparezca de la tarjeta.
 */

const CONOCIDOS = ["whatsapp", "instagram", "facebook", "correo", "cotizador", "chatbot", "web", "manual"];

test("cada canal conocido trae nombre, color y forma", () => {
  for (const c of CONOCIDOS) {
    const v = canalVisual(c);
    assert.ok(v.nombre.length > 0, `${c} sin nombre`);
    assert.match(v.color, /^#[0-9a-f]{6}$/i, `${c} sin color válido`);
    assert.ok(v.forma.length > 0, `${c} sin forma`);
  }
});

test("los nombres son los de Daniel, no los de la columna", () => {
  assert.equal(canalVisual("facebook").nombre, "Messenger");
  assert.equal(canalVisual("web").nombre, "Formulario");
  assert.equal(canalVisual("manual").nombre, "Anotado a mano");
});

test("los canales de conversación no se confunden con los formularios", () => {
  for (const c of ["whatsapp", "instagram", "facebook", "correo"]) {
    assert.equal(canalVisual(c).conversacion, true, `${c} debería esperar respuesta`);
  }
  for (const c of ["cotizador", "chatbot", "web", "manual"]) {
    assert.equal(canalVisual(c).conversacion, false, `${c} no espera respuesta`);
  }
});

test("las cuatro redes donde te escriben tienen siluetas distintas entre sí", () => {
  const formas = ["whatsapp", "instagram", "facebook", "correo"].map((c) => canalVisual(c).forma);
  assert.equal(new Set(formas).size, formas.length, "dos canales dibujan el mismo ícono");
});

test("los colores de las redes no se repiten: el color es la mitad del reconocimiento", () => {
  const colores = ["whatsapp", "instagram", "facebook", "correo", "cotizador"].map((c) => canalVisual(c).color);
  assert.equal(new Set(colores).size, colores.length, "dos canales comparten color");
});

test("da igual cómo venga escrito el canal en la base", () => {
  for (const escrito of ["WhatsApp", " whatsapp ", "WHATSAPP"]) {
    assert.equal(canalVisual(escrito).nombre, "WhatsApp", `no reconoció "${escrito}"`);
  }
});

test("un canal nuevo que nadie mapeó igual se muestra, no se esconde", () => {
  const v = canalVisual("tiktok");
  assert.equal(v.nombre, "tiktok");
  assert.ok(v.color, "tiene que tener un color con el que dibujarse");
  assert.equal(v.forma, "formulario");
});

test("sin canal no revienta ni deja la tarjeta muda", () => {
  for (const vacio of [null, undefined, "", "   "]) {
    const v = canalVisual(vacio);
    assert.equal(v.nombre, "Origen desconocido");
    assert.ok(v.forma);
  }
});
