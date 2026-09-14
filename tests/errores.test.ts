import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizar, agregar, resumen, type ErrorSitio } from "../lib/errores";

const ahora = new Date("2026-09-14T12:00:00Z");

test("normaliza y descarta lo que no sirve", () => {
  assert.equal(normalizar({ mensaje: "" }, ahora), null);
  assert.equal(normalizar({ mensaje: "Script error." }, ahora), null);
  const e = normalizar({ mensaje: "x".repeat(999), fuente: "https://www.dlsremodelaciones.cl/dls-chatbot.js", linea: "42" }, ahora)!;
  assert.equal(e.mensaje.length, 300);
  assert.equal(e.linea, 42);
});

test("guarda solo los últimos 50", () => {
  let lista: ErrorSitio[] = [];
  for (let i = 0; i < 60; i++) lista = agregar(lista, normalizar({ mensaje: "e" + i }, ahora)!);
  assert.equal(lista.length, 50);
  assert.equal(lista[0].mensaje, "e10");
});

test("resume las últimas 24 h y el que más se repite", () => {
  const e = (mensaje: string, cuando: string, linea = 1): ErrorSitio => ({ mensaje, fuente: "https://x/dls-lead.js", linea, navegador: "", cuando });
  const r = resumen(
    [
      e("viejo", "2026-09-12T12:00:00Z"),
      e("TypeError: a is undefined", "2026-09-14T08:00:00Z", 10),
      e("TypeError: a is undefined", "2026-09-14T09:00:00Z", 10),
      e("otro", "2026-09-14T10:00:00Z"),
    ],
    ahora,
  );
  assert.equal(r.cantidad, 3);
  assert.equal(r.veces, 2);
  assert.equal(r.masComun, "TypeError: a is undefined (dls-lead.js:10)");
});
