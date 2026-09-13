import { test } from "node:test";
import assert from "node:assert/strict";
import { porVencer, type MensajeWA } from "../lib/recordatorio";

const AHORA = Date.parse("2026-09-14T12:00:00Z");
const haceHoras = (h: number) => new Date(AHORA - h * 3_600_000).toISOString();
const msg = (lead_id: string, direccion: string, horas: number, cuerpo = "hola"): MensajeWA => ({
  lead_id,
  direccion,
  cuerpo,
  creado: haceHoras(horas),
});

test("avisa cuando al mensaje sin respuesta le quedan entre 2 y 3 horas", () => {
  const r = porVencer([msg("a", "entrante", 21.5, "quiero cotizar")], AHORA);
  assert.equal(r.length, 1);
  assert.equal(r[0].lead_id, "a");
  assert.equal(r[0].horas_restantes, 2.5);
  assert.equal(r[0].cuerpo, "quiero cotizar");
});

test("no avisa si ya se le respondió después", () => {
  assert.equal(porVencer([msg("a", "entrante", 21.5), msg("a", "saliente", 20)], AHORA).length, 0);
});

test("una respuesta vieja no tapa un mensaje nuevo sin responder", () => {
  // Orden desordenado a propósito: la regla no puede depender del orden de la consulta.
  const r = porVencer([msg("a", "entrante", 21.5), msg("a", "saliente", 23), msg("a", "entrante", 23.5)], AHORA);
  assert.equal(r.length, 1);
});

test("fuera de la franja no avisa: ni muy temprano ni con la ventana ya cerrada", () => {
  assert.equal(porVencer([msg("a", "entrante", 20.9)], AHORA).length, 0); // quedan 3.1 h
  assert.equal(porVencer([msg("a", "entrante", 22)], AHORA).length, 0); // quedan 2 h justas: la hora anterior ya avisó
  assert.equal(porVencer([msg("a", "entrante", 25)], AHORA).length, 0); // cerrada
});

test("la franja de una hora se toca exactamente una vez con el cron cada hora", () => {
  const m = [msg("a", "entrante", 0)];
  const creado = Date.parse(m[0].creado);
  // Minuto arbitrario del mensaje; el cron corre en punto.
  let veces = 0;
  for (let h = 0; h <= 26; h++) veces += porVencer(m, creado + h * 3_600_000 + 17 * 60_000).length;
  assert.equal(veces, 1);
});

test("mensajes sin lead se ignoran", () => {
  assert.equal(porVencer([{ lead_id: null, direccion: "entrante", cuerpo: "x", creado: haceHoras(21.5) }], AHORA).length, 0);
});
