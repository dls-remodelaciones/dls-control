import { test } from "node:test";
import assert from "node:assert/strict";
import { diasSinLeads, cambioDeNombre, aSinLlamar, type EstadoNombre } from "../lib/novedades";

const ahora = new Date("2026-09-20T12:00:00Z");

test("días sin leads, redondeado hacia abajo", () => {
  assert.equal(diasSinLeads("2026-09-20T08:00:00Z", ahora), 0);
  assert.equal(diasSinLeads("2026-09-15T13:00:00Z", ahora), 4);
  assert.equal(diasSinLeads("2026-09-15T11:00:00Z", ahora), 5);
  assert.equal(diasSinLeads(null, ahora), null);
});

test("leads A sin llamar: aptos, en contacto inicial y con más de 48 h", () => {
  const l = (creado: string, extra = {}) => ({ clasificacion: "A", apto_para_llamar: true, estado: "contacto_inicial", creado, ...extra });
  const r = aSinLlamar(
    [
      l("2026-09-17T12:00:00Z"), // 72 h → sí
      l("2026-09-18T12:00:00Z"), // 48 h justas → sí
      l("2026-09-19T12:00:00Z"), // 24 h → todavía no
      l("2026-09-10T12:00:00Z", { estado: "visita_terreno" }), // ya se movió
      l("2026-09-10T12:00:00Z", { apto_para_llamar: false }), // A sin teléfono válido
      l("2026-09-10T12:00:00Z", { clasificacion: "B" }),
    ],
    ahora,
  );
  assert.equal(r.length, 2);
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
