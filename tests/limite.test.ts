import { test } from "node:test";
import assert from "node:assert/strict";
import { Ventana, ipDe } from "../lib/limite";

test("deja pasar hasta el máximo y corta el siguiente", () => {
  const v = new Ventana(3, 60_000);
  assert.deepEqual([1, 2, 3, 4].map(() => v.permitir("ip", 1000)), [true, true, true, false]);
});

test("cada IP tiene su propio contador", () => {
  const v = new Ventana(1, 60_000);
  assert.equal(v.permitir("a", 0), true);
  assert.equal(v.permitir("b", 0), true);
  assert.equal(v.permitir("a", 0), false);
});

test("pasada la ventana, vuelve a dejar pasar", () => {
  const v = new Ventana(2, 60_000);
  v.permitir("ip", 0);
  v.permitir("ip", 1);
  assert.equal(v.permitir("ip", 2), false);
  assert.equal(v.permitir("ip", 60_002), true);
});

test("los intentos rechazados no alargan el castigo", () => {
  const v = new Ventana(1, 60_000);
  v.permitir("ip", 0);
  for (let t = 1; t < 60_000; t += 5000) v.permitir("ip", t); // insiste todo el minuto
  assert.equal(v.permitir("ip", 60_001), true);
});

test("la IP sale de las cabeceras de Vercel", () => {
  assert.equal(ipDe(new Headers({ "x-real-ip": "1.2.3.4" })), "1.2.3.4");
  assert.equal(ipDe(new Headers({ "x-forwarded-for": "5.6.7.8, 10.0.0.1" })), "5.6.7.8");
  assert.equal(ipDe(new Headers()), "desconocida");
});
