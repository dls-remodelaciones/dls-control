import { test } from "node:test";
import assert from "node:assert/strict";
import { estadoDominio } from "../lib/dominio-memoria";

const ahora = new Date("2026-09-16T12:00:00Z");
const visto = (vence: string, dias: number) => ({
  vence,
  visto: new Date(ahora.getTime() - dias * 86_400_000).toISOString(),
});

test("con respuesta de NIC: verde si falta mucho, y guarda lo leído", () => {
  const r = estadoDominio("2028-09-03", null, ahora);
  assert.equal(r.ok, true);
  assert.equal(r.guardar?.vence, "2028-09-03");
});

test("con respuesta de NIC: avisa cuando quedan pocos días", () => {
  const r = estadoDominio("2026-10-01", null, ahora);
  assert.equal(r.ok, false);
  assert.match(r.detalle, /quedan 14 días/);
});

test("sin respuesta de NIC pero con dato reciente: sigue en verde y lo dice", () => {
  const r = estadoDominio(null, visto("2028-09-03", 1), ahora);
  assert.equal(r.ok, true);
  assert.match(r.detalle, /última consulta \(hace 1 día/);
  assert.equal(r.guardar, null);
});

test("sin respuesta de NIC por más de una semana: deja de estar en verde", () => {
  const r = estadoDominio(null, visto("2028-09-03", 9), ahora);
  assert.equal(r.ok, false);
  assert.match(r.detalle, /9 días sin poder consultar/);
});

test("aunque NIC no responda, un vencimiento cercano guardado sí avisa", () => {
  const r = estadoDominio(null, visto("2026-09-30", 2), ahora);
  assert.equal(r.ok, false);
  assert.match(r.detalle, /quedan 13 días/);
});

test("sin respuesta y sin nada guardado: no se puede afirmar que esté bien", () => {
  const r = estadoDominio(null, null, ahora);
  assert.equal(r.ok, false);
  assert.match(r.detalle, /Nunca se ha podido consultar/);
});
