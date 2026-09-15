import { test } from "node:test";
import assert from "node:assert/strict";
import { leadsDePrueba, sinPruebas, TIPO_MARCA, TIPO_DESMARCA } from "../lib/prueba";

/**
 * El error caro acá es esconder un cliente real, no mostrar un lead de prueba de
 * más. Por eso todo lo ambiguo —fechas inválidas, empates, marcas de otro tipo—
 * cae del lado de "no es prueba".
 */

const marca = (lead_id: string, tipo: string, creado: string) => ({ lead_id, tipo, creado });

test("sin historial, ningún lead es de prueba", () => {
  assert.equal(leadsDePrueba([]).size, 0);
});

test("un lead marcado queda marcado", () => {
  const r = leadsDePrueba([marca("a", TIPO_MARCA, "2026-09-15T10:00:00Z")]);
  assert.deepEqual([...r], ["a"]);
});

test("desmarcar después de marcar lo devuelve a la lista", () => {
  const r = leadsDePrueba([
    marca("a", TIPO_MARCA, "2026-09-15T10:00:00Z"),
    marca("a", TIPO_DESMARCA, "2026-09-15T11:00:00Z"),
  ]);
  assert.equal(r.size, 0);
});

test("volver a marcar después de desmarcar vuelve a esconderlo", () => {
  const r = leadsDePrueba([
    marca("a", TIPO_MARCA, "2026-09-15T10:00:00Z"),
    marca("a", TIPO_DESMARCA, "2026-09-15T11:00:00Z"),
    marca("a", TIPO_MARCA, "2026-09-15T12:00:00Z"),
  ]);
  assert.deepEqual([...r], ["a"]);
});

test("no importa el orden en que venga el historial: manda la fecha", () => {
  const desordenado = leadsDePrueba([
    marca("a", TIPO_DESMARCA, "2026-09-15T11:00:00Z"),
    marca("a", TIPO_MARCA, "2026-09-15T10:00:00Z"),
  ]);
  assert.equal(desordenado.size, 0, "la más reciente es el desmarcado");
});

test("cada lead se decide por su cuenta", () => {
  const r = leadsDePrueba([
    marca("a", TIPO_MARCA, "2026-09-15T10:00:00Z"),
    marca("b", TIPO_MARCA, "2026-09-15T10:00:00Z"),
    marca("b", TIPO_DESMARCA, "2026-09-15T12:00:00Z"),
    marca("c", TIPO_MARCA, "2026-09-15T13:00:00Z"),
  ]);
  assert.deepEqual([...r].sort(), ["a", "c"]);
});

test("las otras actividades del lead no lo marcan", () => {
  const r = leadsDePrueba([
    marca("a", "llamada", "2026-09-15T10:00:00Z"),
    marca("a", "wa_atendido", "2026-09-15T11:00:00Z"),
    marca("a", "edicion", "2026-09-15T12:00:00Z"),
  ]);
  assert.equal(r.size, 0);
});

test("un empate de fechas deja el lead a la vista", () => {
  const misma = "2026-09-15T10:00:00Z";
  assert.equal(leadsDePrueba([marca("a", TIPO_MARCA, misma), marca("a", TIPO_DESMARCA, misma)]).size, 0);
  // Y al revés, para que no dependa del orden de llegada.
  assert.equal(leadsDePrueba([marca("a", TIPO_DESMARCA, misma), marca("a", TIPO_MARCA, misma)]).size, 0);
});

test("una fecha inválida se ignora en vez de esconder el lead", () => {
  assert.equal(leadsDePrueba([marca("a", TIPO_MARCA, "no es fecha")]).size, 0);
  assert.equal(leadsDePrueba([marca("a", TIPO_MARCA, "")]).size, 0);
});

test("una marca sin lead no rompe nada", () => {
  assert.equal(leadsDePrueba([marca("", TIPO_MARCA, "2026-09-15T10:00:00Z")]).size, 0);
});

/* ── filtrar listas ─────────────────────────────────────────────────────── */

test("los leads de prueba se quitan y los demás conservan su orden", () => {
  const filas = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.deepEqual(sinPruebas(filas, new Set(["b"])), [{ id: "a" }, { id: "c" }]);
});

test("sin marcas, la lista vuelve tal cual", () => {
  const filas = [{ id: "a" }, { id: "b" }];
  assert.equal(sinPruebas(filas, new Set()), filas, "la misma referencia: no hay nada que filtrar");
});
