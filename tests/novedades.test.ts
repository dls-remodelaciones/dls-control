import { test } from "node:test";
import assert from "node:assert/strict";
import { diasSinLeads, cambioDeNombre, type EstadoNombre } from "../lib/novedades";

const ahora = new Date("2026-09-20T12:00:00Z");

test("días sin leads, redondeado hacia abajo", () => {
  assert.equal(diasSinLeads("2026-09-20T08:00:00Z", ahora), 0);
  assert.equal(diasSinLeads("2026-09-15T13:00:00Z", ahora), 4);
  assert.equal(diasSinLeads("2026-09-15T11:00:00Z", ahora), 5);
  assert.equal(diasSinLeads(null, ahora), null);
});

const base: EstadoNombre = { nombre: "D.L.S", estado: "APPROVED", nuevo: "PENDING_REVIEW" };

test("la primera vez solo guarda, no avisa; sin cambios tampoco", () => {
  assert.equal(cambioDeNombre(null, base), null);
  assert.equal(cambioDeNombre(base, { ...base }), null);
});

test("avisa cuando Meta aprueba el nombre nuevo", () => {
  const r = cambioDeNombre(base, { nombre: "DLS Remodelaciones", estado: "APPROVED", nuevo: "NONE" });
  assert.equal(r?.titulo, "Meta aprobó el nombre de WhatsApp");
  assert.match(r!.cuerpo, /DLS Remodelaciones/);
});

test("avisa cuando Meta lo rechaza", () => {
  const r = cambioDeNombre(base, { ...base, nuevo: "DECLINED" });
  assert.equal(r?.titulo, "Meta rechazó el nombre de WhatsApp");
});
