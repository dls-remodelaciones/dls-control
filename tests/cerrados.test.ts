import { test } from "node:test";
import assert from "node:assert/strict";
import { leerCerrados, estaCerrado, alternarCerrado, VACIO } from "../lib/cerrados";

/**
 * Esto decide qué secciones aparecen dobladas al abrir el panel, o sea qué
 * clientes NO se ven al entrar. El error caro no es perder la preferencia —eso
 * se arregla con un toque— sino esconder un canal que nadie mandó esconder.
 * Por eso todo lo raro cae del lado de "abierto".
 */

test("sin nada guardado, todas las secciones están abiertas", () => {
  for (const nada of [null, undefined, "", VACIO]) {
    assert.deepEqual(leerCerrados(nada), {});
    assert.equal(estaCerrado(nada, "whatsapp"), false);
  }
});

test("cerrar una sección la deja cerrada, y volver a tocarla la abre", () => {
  const cerrado = alternarCerrado(VACIO, "cotizador");
  assert.equal(estaCerrado(cerrado, "cotizador"), true);

  const abierto = alternarCerrado(cerrado, "cotizador");
  assert.equal(estaCerrado(abierto, "cotizador"), false);
});

test("cerrar una no toca a las demás", () => {
  let s = alternarCerrado(VACIO, "cotizador");
  s = alternarCerrado(s, "correo");
  assert.equal(estaCerrado(s, "cotizador"), true);
  assert.equal(estaCerrado(s, "correo"), true);
  assert.equal(estaCerrado(s, "whatsapp"), false);
});

test("las listas distintas no se pisan entre sí", () => {
  // La misma sección de WhatsApp aparece en "Te escribieron" y más abajo:
  // cerrar una no puede cerrar la otra.
  const s = alternarCerrado(VACIO, "esp-whatsapp");
  assert.equal(estaCerrado(s, "esp-whatsapp"), true);
  assert.equal(estaCerrado(s, "a-whatsapp"), false);
});

test("solo se guarda lo cerrado, para que un canal nuevo nunca nazca oculto", () => {
  const s = alternarCerrado(VACIO, "correo");
  assert.deepEqual(JSON.parse(s), { correo: true });
  assert.equal(estaCerrado(s, "tiktok"), false, "un canal que nadie previó tiene que verse");
});

test("un valor corrupto en el navegador deja todo abierto en vez de romper", () => {
  for (const basura of ["{no es json", "[]", "null", '"texto"', "42"]) {
    assert.deepEqual(leerCerrados(basura), {}, `falló con ${basura}`);
    assert.equal(estaCerrado(basura, "whatsapp"), false);
  }
});

test("valores que no son 'true' se ignoran, no se interpretan como cerrado", () => {
  // Restos de una versión anterior, o alguien editando a mano.
  const raro = JSON.stringify({ whatsapp: "sí", correo: 1, instagram: false, cotizador: true });
  assert.deepEqual(leerCerrados(raro), { cotizador: true });
});

test("alternar sobre basura parte de cero sin arrastrar el desorden", () => {
  const s = alternarCerrado("{roto", "whatsapp");
  assert.deepEqual(JSON.parse(s), { whatsapp: true });
});
