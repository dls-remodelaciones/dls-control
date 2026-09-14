import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import type { NextRequest } from "next/server";
import { quienLlama } from "../lib/cron";

/**
 * Quién puede disparar las rutas programadas (respaldo, resumen, recordatorios,
 * revisión de salud). Es control de acceso, así que conviene que esté probado:
 * sin CRON_SECRET el reconocimiento es por user-agent, que cualquiera puede
 * imitar, y la regla que importa es que **al poner el secreto, el user-agent
 * deje de bastar**.
 *
 * Sin credenciales de Supabase en el entorno de pruebas, la rama de sesión
 * siempre responde "no hay sesión", que es justo lo que se quiere aislar acá.
 */

const ENV = { ...process.env };
afterEach(() => {
  process.env = { ...ENV };
});

/** Solo se usa `headers.get`, así que alcanza con eso. */
const peticion = (headers: Record<string, string>) =>
  ({
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
  }) as unknown as NextRequest;

test("sin secreto, el cron de Vercel se reconoce por su user-agent", async () => {
  delete process.env.CRON_SECRET;
  const r = await quienLlama(peticion({ "user-agent": "vercel-cron/1.0" }));
  assert.equal(r.cron, true);
});

test("sin secreto, un visitante cualquiera no es el cron", async () => {
  delete process.env.CRON_SECRET;
  const r = await quienLlama(peticion({ "user-agent": "Mozilla/5.0" }));
  assert.equal(r.cron, false);
  assert.equal(r.sesion, false);
});

test("sin secreto y sin user-agent tampoco pasa", async () => {
  delete process.env.CRON_SECRET;
  assert.equal((await quienLlama(peticion({}))).cron, false);
});

test("con secreto, el Bearer correcto entra", async () => {
  process.env.CRON_SECRET = "secreto-de-prueba";
  const r = await quienLlama(peticion({ authorization: "Bearer secreto-de-prueba" }));
  assert.equal(r.cron, true);
});

test("con secreto, un Bearer equivocado no entra", async () => {
  process.env.CRON_SECRET = "secreto-de-prueba";
  const r = await quienLlama(peticion({ authorization: "Bearer otra-cosa" }));
  assert.equal(r.cron, false);
});

test("al poner el secreto, imitar el user-agent deja de servir", async () => {
  process.env.CRON_SECRET = "secreto-de-prueba";
  const r = await quienLlama(peticion({ "user-agent": "vercel-cron/1.0" }));
  assert.equal(r.cron, false, "el user-agent no puede saltarse el secreto");
});

test("un secreto con espacios alrededor igual funciona", async () => {
  process.env.CRON_SECRET = "  secreto-de-prueba  ";
  const r = await quienLlama(peticion({ authorization: "Bearer secreto-de-prueba" }));
  assert.equal(r.cron, true);
});
