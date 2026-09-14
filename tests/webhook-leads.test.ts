import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST, OPTIONS } from "../app/api/leads/webhook/route";

/**
 * La puerta por la que entran los leads del sitio. Estas pruebas cubren todo lo
 * que se decide ANTES de tocar la base: origen, tamaño, JSON, token y topes.
 * Un error acá es un lead real rechazado o un intruso aceptado.
 */

process.env.DLS_WEBHOOK_TOKEN = "token-de-prueba";
const SITIO = "https://www.dlsremodelaciones.cl";
let ipN = 0;

function pedir(cuerpo: string, { origen = SITIO as string | null, ip = `10.0.0.${++ipN}` } = {}) {
  const headers: Record<string, string> = { "content-type": "text/plain", "x-real-ip": ip };
  if (origen) headers.origin = origen;
  return new NextRequest("https://dls-control.vercel.app/api/leads/webhook", { method: "POST", headers, body: cuerpo });
}

test("rechaza envíos desde otra web", async () => {
  const r = await POST(pedir("{}", { origen: "https://sitio-ajeno.com" }));
  assert.equal(r.status, 403);
});

test("rechaza JSON roto y token equivocado", async () => {
  assert.equal((await POST(pedir("no es json"))).status, 400);
  assert.equal((await POST(pedir(JSON.stringify({ token: "otro", nombre: "Ana" })))).status, 401);
});

test("rechaza envíos de más de 100 KB", async () => {
  const r = await POST(pedir("x".repeat(120_000)));
  assert.equal(r.status, 413);
});

test("sin Origin (un script) corta al 11º envío; desde el sitio deja pasar más", async () => {
  const sinOrigen = [];
  for (let i = 0; i < 11; i++) sinOrigen.push((await POST(pedir("roto", { origen: null, ip: "10.9.9.9" }))).status);
  assert.deepEqual(sinOrigen.slice(0, 10), Array(10).fill(400));
  assert.equal(sinOrigen[10], 429);

  const conOrigen = [];
  for (let i = 0; i < 20; i++) conOrigen.push((await POST(pedir("roto", { ip: "10.8.8.8" }))).status);
  assert.ok(conOrigen.every((s) => s === 400), "20 envíos desde el sitio no deberían topar");
});

test("el preflight responde con los permisos para el sitio", async () => {
  const r = await OPTIONS(new NextRequest("https://dls-control.vercel.app/api/leads/webhook", { method: "OPTIONS", headers: { origin: SITIO } }));
  assert.equal(r.status, 204);
  assert.equal(r.headers.get("access-control-allow-origin"), SITIO);
});
