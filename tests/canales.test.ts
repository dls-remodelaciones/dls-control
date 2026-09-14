import { test } from "node:test";
import assert from "node:assert/strict";
import { comoResponder } from "../lib/canales";

/**
 * Un lead sin teléfono que llegó por Instagram o Messenger tiene que ofrecer
 * alguna salida: el aviso suena en el celular y si el panel no da por dónde
 * contestar, esa persona se pierde aunque el lead esté perfectamente guardado.
 */

test("un DM de Instagram lleva a la bandeja de Instagram", () => {
  const r = comoResponder("instagram");
  assert.equal(r?.texto, "Responder en Instagram");
  assert.match(r!.href, /^https:\/\/www\.instagram\.com\//);
});

test("un DM de Messenger lleva a la bandeja de la página", () => {
  const r = comoResponder("facebook");
  assert.equal(r?.texto, "Responder en Messenger");
  assert.match(r!.href, /^https:\/\/business\.facebook\.com\//);
});

test("da igual cómo venga escrito el canal", () => {
  for (const v of ["Instagram", "INSTAGRAM", "  instagram  "]) {
    assert.equal(comoResponder(v)?.texto, "Responder en Instagram", v);
  }
});

test("un canal sin bandeja propia no inventa un botón", () => {
  for (const v of ["web", "cotizador", "chatbot", "correo", "manual", "whatsapp"]) {
    assert.equal(comoResponder(v), null, v);
  }
});

test("sin canal no revienta", () => {
  assert.equal(comoResponder(null), null);
  assert.equal(comoResponder(undefined), null);
  assert.equal(comoResponder(""), null);
});

test("los enlaces son https, porque se abren en otra pestaña", () => {
  for (const canal of ["instagram", "facebook"]) {
    assert.match(comoResponder(canal)!.href, /^https:\/\//, canal);
  }
});
