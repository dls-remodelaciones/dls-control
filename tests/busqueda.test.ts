import { test } from "node:test";
import assert from "node:assert/strict";
import { coincide } from "../lib/busqueda";

const ana = { nombre: "Ana Pérez", telefono: "56912345678", email: "ana@correo.cl", comuna: "Ñuñoa", tipo_proyecto: "cocina" };

test("nombre y comuna sin tildes ni mayúsculas", () => {
  assert.equal(coincide(ana, "perez"), true);
  assert.equal(coincide(ana, "NUNOA"), true);
  assert.equal(coincide(ana, "ana nunoa"), true);
  assert.equal(coincide(ana, "ana vitacura"), false);
});

test("teléfono escrito de cualquier forma", () => {
  assert.equal(coincide(ana, "9 1234 5678"), true);
  assert.equal(coincide(ana, "+56912345678"), true);
  assert.equal(coincide(ana, "5678"), true);
  assert.equal(coincide(ana, "9999 0000"), false);
});

test("vacío muestra todo; correo y tipo también se buscan", () => {
  assert.equal(coincide(ana, "  "), true);
  assert.equal(coincide(ana, "correo.cl"), true);
  assert.equal(coincide(ana, "cocina"), true);
});
