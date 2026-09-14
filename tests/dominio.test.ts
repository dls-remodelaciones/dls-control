import { test } from "node:test";
import assert from "node:assert/strict";
import { leerVencimiento, diasHasta } from "../lib/dominio";

// Respuesta real de whois.nic.cl del 13-sep-2026.
const WHOIS = `Registrant name: dls arquitectura y construccion
Registrar name: NIC Chile
Creation date: 2026-09-03 20:47:23 CLST
Expiration date: 2028-09-03 20:47:23 CLST
Name server: becky.ns.cloudflare.com`;

test("lee la fecha de vencimiento del whois de NIC Chile", () => {
  assert.equal(leerVencimiento(WHOIS), "2028-09-03");
  assert.equal(leerVencimiento("No match"), null);
});

test("días hasta el vencimiento", () => {
  assert.equal(diasHasta("2028-09-03", new Date("2028-07-20T12:00:00Z")), 44);
  assert.equal(diasHasta("2028-09-03", new Date("2028-09-04T12:00:00Z")), -2);
});
