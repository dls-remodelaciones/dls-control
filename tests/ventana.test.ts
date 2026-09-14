import { test } from "node:test";
import assert from "node:assert/strict";
import { ventanaAbierta, VENTANA_HORAS } from "../lib/ventana";
import { ventanaAbierta as desdeWhatsapp } from "../lib/whatsapp";

/**
 * La ventana de 24 horas rige igual en WhatsApp, Instagram y Messenger, y se
 * calcula en un solo lugar para que el panel y el servidor nunca discrepen: que
 * la pantalla diga "puedes responder" y el envío falle es peor que no ofrecerlo.
 */

const haceHoras = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

test("sin ningún mensaje de la persona la ventana nunca se abrió", () => {
  assert.deepEqual(ventanaAbierta(null), { abierta: false, horas_restantes: 0 });
  assert.deepEqual(ventanaAbierta(undefined), { abierta: false, horas_restantes: 0 });
});

test("una fecha ilegible se trata como cerrada, no como abierta", () => {
  assert.deepEqual(ventanaAbierta("ayer por la tarde"), { abierta: false, horas_restantes: 0 });
});

test("recién escrito deja casi las 24 horas completas", () => {
  const r = ventanaAbierta(haceHoras(0.1));
  assert.equal(r.abierta, true);
  assert.ok(r.horas_restantes > 23.5, `horas: ${r.horas_restantes}`);
});

test("a 20 horas quedan 4 y sigue abierta", () => {
  const r = ventanaAbierta(haceHoras(20));
  assert.equal(r.abierta, true);
  assert.ok(r.horas_restantes > 3.9 && r.horas_restantes <= 4, `horas: ${r.horas_restantes}`);
});

test("justo pasado el límite ya está cerrada", () => {
  assert.deepEqual(ventanaAbierta(haceHoras(VENTANA_HORAS + 0.1)), { abierta: false, horas_restantes: 0 });
});

test("whatsapp.ts y ventana.ts son la misma regla, no dos copias", () => {
  const fecha = haceHoras(5);
  assert.deepEqual(desdeWhatsapp(fecha), ventanaAbierta(fecha));
  assert.equal(desdeWhatsapp(null).abierta, ventanaAbierta(null).abierta);
});
