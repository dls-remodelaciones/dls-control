import { test } from "node:test";
import assert from "node:assert/strict";
import { cuandoLlego } from "../lib/cuando";

/**
 * El borde que importa es la medianoche: a las 00:30, un mensaje de las 23:50
 * llegó "ayer" aunque hayan pasado cuarenta minutos. Contarlo por horas
 * transcurridas diría "hoy" y haría dudar del orden de llegada, que es
 * justamente lo que esto viene a resolver.
 */

/**
 * Las fechas se construyen en hora local y NO con un desfase escrito a mano
 * ("-03:00"): Chile cambia de huso el primer domingo de septiembre, así que el
 * 2 y el 14 de septiembre del mismo año no están en el mismo desfase y un test
 * con offset fijo falla por el cambio de hora y no por un error del código.
 * Costó un test rojo descubrirlo.
 */
function local(a: number, m: number, d: number, h: number, min: number): string {
  return new Date(a, m - 1, d, h, min).toISOString();
}

const ahora = new Date(2026, 8, 14, 15, 30);

test("lo de hoy se dice con la hora", () => {
  assert.equal(cuandoLlego(local(2026, 9, 14, 14, 32), ahora), "hoy 14:32");
});

test("lo de ayer se dice ayer, con su hora", () => {
  assert.equal(cuandoLlego(local(2026, 9, 13, 9, 10), ahora), "ayer 09:10");
});

test("a las 00:30, un mensaje de las 23:50 es de ayer y no de hoy", () => {
  const medianoche = new Date(2026, 8, 15, 0, 30);
  assert.equal(cuandoLlego(local(2026, 9, 14, 23, 50), medianoche), "ayer 23:50");
});

test("más atrás se dice la fecha con la hora, sin repetir el año", () => {
  const r = cuandoLlego(local(2026, 9, 2, 14, 30), ahora);
  assert.match(r, /sep/);
  assert.match(r, /14:30/);
  assert.doesNotMatch(r, /2026/, "el año en curso no se repite");
});

test("de otro año se muestra el año, porque omitirlo engaña", () => {
  const r = cuandoLlego(local(2025, 12, 20, 10, 0), ahora);
  assert.match(r, /2025/);
});

test("sin fecha devuelve vacío, no 'Invalid Date' en pantalla", () => {
  for (const vacio of [null, undefined, "", "cualquier cosa"]) {
    assert.equal(cuandoLlego(vacio, ahora), "");
  }
});
