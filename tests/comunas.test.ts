import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizarComuna, COMUNAS_RM } from "../lib/comunas";

/**
 * Los clientes escriben la comuna como se les ocurre. Si "las condes" y
 * "Las Condes" entran como dos comunas distintas, el resumen semanal, el Excel
 * y la búsqueda del panel las cuentan por separado y las cifras mienten.
 */

test("las 52 comunas de la RM vuelven a su nombre oficial escritas de cualquier forma", () => {
  for (const oficial of COMUNAS_RM) {
    assert.equal(normalizarComuna(oficial.toLowerCase()), oficial, oficial);
    assert.equal(normalizarComuna(oficial.toUpperCase()), oficial, oficial);
    assert.equal(normalizarComuna(`  ${oficial}  `), oficial, oficial);
  }
});

test("sin tildes también calza: 'nunoa' y 'penalolen' son comunas reales", () => {
  assert.equal(normalizarComuna("nunoa"), "Ñuñoa");
  assert.equal(normalizarComuna("NUNOA"), "Ñuñoa");
  assert.equal(normalizarComuna("penalolen"), "Peñalolén");
  assert.equal(normalizarComuna("estacion central"), "Estación Central");
  assert.equal(normalizarComuna("conchali"), "Conchalí");
});

test("las formas que la gente usa de verdad", () => {
  assert.equal(normalizarComuna("santiago centro"), "Santiago");
  assert.equal(normalizarComuna("Stgo"), "Santiago");
  assert.equal(normalizarComuna("til til"), "Tiltil");
  assert.equal(normalizarComuna("PAC"), "Pedro Aguirre Cerda");
  assert.equal(normalizarComuna("est central"), "Estación Central");
});

test("una comuna de otra región no se descarta: se guarda bien escrita", () => {
  assert.equal(normalizarComuna("viña del mar"), "Viña del Mar");
  assert.equal(normalizarComuna("VALPARAISO"), "Valparaiso");
  assert.equal(normalizarComuna("puerto de la cruz"), "Puerto de la Cruz");
});

test("vacío, nulo o basura no inventan una comuna", () => {
  assert.equal(normalizarComuna(""), "");
  assert.equal(normalizarComuna(null), "");
  assert.equal(normalizarComuna(undefined), "");
  assert.equal(normalizarComuna("   "), "");
});

test("un texto larguísimo se corta en vez de guardarse entero", () => {
  assert.ok(normalizarComuna("a".repeat(200)).length <= 80);
});

test("los espacios de más no crean comunas distintas", () => {
  assert.equal(normalizarComuna("las    condes"), "Las Condes");
  assert.equal(normalizarComuna("\tLas Condes\n"), "Las Condes");
});
