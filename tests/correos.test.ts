import { test } from "node:test";
import assert from "node:assert/strict";
import { inicioDeCiclo, proximoReinicio, sumar, vigente } from "../lib/correos";

const d = (s: string) => new Date(s + "T12:00:00Z");

test("el ciclo empieza el día de reinicio", () => {
  assert.equal(inicioDeCiclo(d("2026-09-13"), 9), "2026-09-09");
  assert.equal(inicioDeCiclo(d("2026-09-09"), 9), "2026-09-09");
  assert.equal(inicioDeCiclo(d("2026-09-08"), 9), "2026-08-09");
  assert.equal(inicioDeCiclo(d("2026-01-05"), 9), "2025-12-09");
});

test("el próximo reinicio es el mismo día del mes siguiente", () => {
  assert.equal(proximoReinicio(d("2026-09-13"), 9), "2026-10-09");
  assert.equal(proximoReinicio(d("2026-12-20"), 9), "2027-01-09");
  assert.equal(proximoReinicio(d("2026-09-08"), 9), "2026-09-09");
});

test("suma dentro del ciclo y reinicia al cambiar", () => {
  const u1 = sumar(null, 2, d("2026-09-13"));
  assert.deepEqual(u1, { ciclo: "2026-09-09", cantidad: 2 });
  const u2 = sumar(u1, 1, d("2026-10-01"));
  assert.equal(u2.cantidad, 3);
  const u3 = sumar(u2, 1, d("2026-10-10"));
  assert.deepEqual(u3, { ciclo: "2026-10-09", cantidad: 1 });
});

test("lo guardado de un ciclo anterior cuenta como cero", () => {
  assert.equal(vigente({ ciclo: "2026-08-09", cantidad: 190 }, d("2026-09-13")).cantidad, 0);
  assert.equal(vigente({ ciclo: "2026-09-09", cantidad: 40 }, d("2026-09-13")).cantidad, 40);
});
