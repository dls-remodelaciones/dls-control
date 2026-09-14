import { test } from "node:test";
import assert from "node:assert/strict";
import { pedirJson } from "../lib/pedir";

const original = globalThis.fetch;

test("sin conexión devuelve un error en palabras en vez de lanzar", async () => {
  globalThis.fetch = (async () => {
    throw new TypeError("Failed to fetch");
  }) as typeof fetch;
  try {
    const r = await pedirJson("/api/x");
    assert.equal(r.ok, false);
    assert.equal(r.error, "sin_conexion");
  } finally {
    globalThis.fetch = original;
  }
});

test("una página de error que no es JSON tampoco lanza", async () => {
  globalThis.fetch = (async () => new Response("<html>504</html>", { status: 504 })) as typeof fetch;
  try {
    const r = await pedirJson("/api/x");
    assert.equal(r.error, "respuesta_rara");
    assert.match(r.detalle ?? "", /504/);
  } finally {
    globalThis.fetch = original;
  }
});

test("una respuesta normal pasa tal cual", async () => {
  globalThis.fetch = (async () => Response.json({ ok: true, score: 80 })) as typeof fetch;
  try {
    assert.deepEqual(await pedirJson("/api/x"), { ok: true, score: 80 });
  } finally {
    globalThis.fetch = original;
  }
});
