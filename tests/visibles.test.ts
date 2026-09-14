import { test } from "node:test";
import assert from "node:assert/strict";
import { leadsVisibles } from "../lib/visibles";

/**
 * Qué leads aparecen en pantalla. Un error acá no rompe nada a la vista:
 * simplemente esconde a un cliente, que en este proyecto es la forma más cara
 * de fallar (regla del 2026-09-11: entra todo, se clasifica, no se descarta).
 */

const lead = (id: string, extra: Partial<{ estado: string; clasificacion: string; nombre: string; comuna: string }> = {}) => ({
  id,
  estado: "contacto_inicial",
  clasificacion: "A",
  nombre: `Cliente ${id}`,
  comuna: "Ñuñoa",
  ...extra,
});

const base = {
  filtro: null,
  busqueda: "",
  sinResponder: new Map<string, string>(),
  paraHoy: [] as ReturnType<typeof lead>[],
};

test("en Hoy solo se ven los A aptos, no la lista completa", () => {
  const a1 = lead("a1");
  const filas = [a1, lead("b1", { clasificacion: "B" }), lead("c1", { clasificacion: "C" })];
  const r = leadsVisibles({ ...base, filas, tab: "hoy", listaA: [a1] });
  assert.deepEqual(r.map((f) => f.id), ["a1"]);
});

test("en Hoy no se repite quien ya está en 'Te escribieron'", () => {
  const a1 = lead("a1");
  const a2 = lead("a2");
  const r = leadsVisibles({
    ...base,
    filas: [a1, a2],
    tab: "hoy",
    listaA: [a1, a2],
    sinResponder: new Map([["a1", "2026-09-14T10:00:00Z"]]),
  });
  assert.deepEqual(r.map((f) => f.id), ["a2"], "a1 ya aparece en su propia sección");
});

test("en Hoy tampoco se repite quien ya está en 'Para hoy'", () => {
  const a1 = lead("a1");
  const a2 = lead("a2");
  const r = leadsVisibles({ ...base, filas: [a1, a2], tab: "hoy", listaA: [a1, a2], paraHoy: [a2] });
  assert.deepEqual(r.map((f) => f.id), ["a1"]);
});

test("la bandeja muestra todo, sin esconder a nadie", () => {
  const filas = [lead("a1"), lead("b1", { clasificacion: "B" }), lead("d1", { clasificacion: "D" })];
  const r = leadsVisibles({ ...base, filas, tab: "bandeja", listaA: [] });
  assert.equal(r.length, 3, "ningún lead se descarta en la bandeja");
});

test("el pipeline deja fuera a los que siguen en contacto inicial", () => {
  const filas = [lead("a1"), lead("v1", { estado: "visita_terreno" }), lead("c1", { estado: "cerrado" })];
  const r = leadsVisibles({ ...base, filas, tab: "pipeline", listaA: [] });
  assert.deepEqual(r.map((f) => f.id), ["v1", "c1"]);
});

test("el filtro por clase se aplica sobre lo que ya se ve", () => {
  const filas = [lead("a1"), lead("b1", { clasificacion: "B" }), lead("b2", { clasificacion: "B" })];
  const r = leadsVisibles({ ...base, filas, tab: "bandeja", listaA: [], filtro: "B" });
  assert.deepEqual(r.map((f) => f.id), ["b1", "b2"]);
});

test("la búsqueda solo filtra en la bandeja, no en Hoy", () => {
  const a1 = lead("a1", { nombre: "Ana Pérez" });
  const a2 = lead("a2", { nombre: "Bruno Soto" });
  const enBandeja = leadsVisibles({ ...base, filas: [a1, a2], tab: "bandeja", listaA: [], busqueda: "ana" });
  assert.deepEqual(enBandeja.map((f) => f.id), ["a1"]);
  // En Hoy la búsqueda ni siquiera está en pantalla: no debe recortar la lista.
  const enHoy = leadsVisibles({ ...base, filas: [a1, a2], tab: "hoy", listaA: [a1, a2], busqueda: "ana" });
  assert.equal(enHoy.length, 2);
});

test("una búsqueda con solo espacios no esconde a nadie", () => {
  const filas = [lead("a1"), lead("a2")];
  const r = leadsVisibles({ ...base, filas, tab: "bandeja", listaA: [], busqueda: "   " });
  assert.equal(r.length, 2);
});

test("una búsqueda sin coincidencias devuelve vacío, no la lista entera", () => {
  const filas = [lead("a1", { nombre: "Ana" })];
  const r = leadsVisibles({ ...base, filas, tab: "bandeja", listaA: [], busqueda: "zzzz" });
  assert.equal(r.length, 0);
});

test("filtro y búsqueda se combinan sin perderse uno del otro", () => {
  const filas = [
    lead("b1", { clasificacion: "B", nombre: "Ana Pérez" }),
    lead("b2", { clasificacion: "B", nombre: "Bruno Soto" }),
    lead("a1", { clasificacion: "A", nombre: "Ana Díaz" }),
  ];
  const r = leadsVisibles({ ...base, filas, tab: "bandeja", listaA: [], filtro: "B", busqueda: "ana" });
  assert.deepEqual(r.map((f) => f.id), ["b1"]);
});

test("sin leads no revienta en ninguna pestaña", () => {
  for (const tab of ["hoy", "bandeja", "pipeline"] as const) {
    assert.deepEqual(leadsVisibles({ ...base, filas: [], tab, listaA: [] }), []);
  }
});
