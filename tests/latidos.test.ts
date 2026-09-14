import { test } from "node:test";
import assert from "node:assert/strict";
import { atrasadas, TAREAS } from "../lib/latidos";

/**
 * Si el cron de cada hora deja de correr, dejan de salir los avisos de ventana
 * de WhatsApp por vencer. El silencio parece calma: nada falla en pantalla,
 * simplemente se pierden clientes. Estas pruebas cuidan al que avisa.
 */

const AHORA = new Date("2026-09-14T12:00:00Z");
const haceHoras = (h: number) => new Date(AHORA.getTime() - h * 3_600_000).toISOString();

test("con todo al día no se reporta nada", () => {
  assert.deepEqual(atrasadas({ recordatorio: haceHoras(1), resumen: haceHoras(24) }, AHORA), []);
});

test("el recordatorio atrasado se reporta en horas", () => {
  const r = atrasadas({ recordatorio: haceHoras(5) }, AHORA);
  assert.equal(r.length, 1);
  assert.match(r[0], /Recordatorios de cada hora/);
  assert.match(r[0], /5 h/);
});

test("justo en el límite todavía no es atraso", () => {
  assert.deepEqual(atrasadas({ recordatorio: haceHoras(TAREAS.recordatorio.maxHoras) }, AHORA), []);
});

test("pasado el límite por poco ya es atraso", () => {
  assert.equal(atrasadas({ recordatorio: haceHoras(TAREAS.recordatorio.maxHoras + 0.5) }, AHORA).length, 1);
});

test("más de dos días se cuenta en días, no en horas", () => {
  const r = atrasadas({ resumen: haceHoras(10 * 24) }, AHORA);
  assert.equal(r.length, 1);
  assert.match(r[0], /10 días/);
});

test("una tarea que nunca corrió no se reporta: puede ser que recién se creó", () => {
  assert.deepEqual(atrasadas({}, AHORA), []);
  assert.deepEqual(atrasadas({ recordatorio: undefined }, AHORA), []);
});

test("las dos tareas atrasadas se reportan juntas", () => {
  const r = atrasadas({ recordatorio: haceHoras(50), resumen: haceHoras(20 * 24) }, AHORA);
  assert.equal(r.length, 2);
});
