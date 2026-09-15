import { test } from "node:test";
import assert from "node:assert/strict";
import { urgenciaDeEspera } from "../lib/urgencia";

/**
 * Esto decide a quién le contesta Daniel primero, así que el error que importa
 * es decir "puedes responder" cuando la ventana de Meta ya se cerró: ahí el
 * mensaje no sale y el cliente queda sin respuesta creyendo que lo ignoraron.
 * Por eso los bordes se prueban por los dos lados.
 */

/** Hace `h` horas, en ISO. */
function haceHoras(h: number): string {
  return new Date(Date.now() - h * 3_600_000).toISOString();
}

test("quien acaba de escribir no urge: hay casi 24 horas", () => {
  const u = urgenciaDeEspera(haceHoras(0.2));
  assert.equal(u.nivel, "abierta");
  assert.equal(u.alarma, false);
  assert.ok(u.horas_restantes > 23);
});

test("pasada la mitad del día la ventana entra en la jornada", () => {
  const u = urgenciaDeEspera(haceHoras(14));
  assert.equal(u.nivel, "hoy");
  assert.equal(u.alarma, false);
  assert.match(u.texto, /Quedan/);
});

test("con 4 horas o menos es lo primero que hay que hacer", () => {
  const u = urgenciaDeEspera(haceHoras(21));
  assert.equal(u.nivel, "ultimas");
  assert.equal(u.alarma, true);
  assert.match(u.texto, /para responder/);
});

test("pasadas las 24 horas se dice que solo queda llamar", () => {
  const u = urgenciaDeEspera(haceHoras(30));
  assert.equal(u.nivel, "cerrada");
  assert.equal(u.alarma, true);
  assert.equal(u.horas_restantes, 0);
  assert.match(u.texto, /llamada/);
});

test("el borde de las 24 horas cae del lado cerrado, no del abierto", () => {
  assert.equal(urgenciaDeEspera(haceHoras(23.9)).nivel, "ultimas");
  assert.equal(urgenciaDeEspera(haceHoras(24.1)).nivel, "cerrada");
});

test("el borde de las 4 horas restantes separa 'últimas' de 'hoy'", () => {
  // Quedan 3,9 h → últimas. Quedan 4,2 h → todavía "hoy".
  assert.equal(urgenciaDeEspera(haceHoras(20.1)).nivel, "ultimas");
  assert.equal(urgenciaDeEspera(haceHoras(19.8)).nivel, "hoy");
});

test("bajo una hora se habla en minutos, que es como se lee el apuro", () => {
  const u = urgenciaDeEspera(haceHoras(23.5));
  assert.match(u.texto, /min/, `debería decir minutos: "${u.texto}"`);
  assert.doesNotMatch(u.texto, /0,5 h/);
});

test("las horas con decimal se escriben con coma, como en Chile", () => {
  const u = urgenciaDeEspera(haceHoras(21.5));
  assert.match(u.texto, /2,5 h/, `"${u.texto}"`);
});

test("sin fecha de espera se trata como cerrada, no como abierta", () => {
  for (const vacio of [null, undefined, "", "no es una fecha"]) {
    const u = urgenciaDeEspera(vacio);
    assert.equal(u.nivel, "cerrada", `"${vacio}" debería ser cerrada`);
    assert.equal(u.alarma, true);
  }
});
