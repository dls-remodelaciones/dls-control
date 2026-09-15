import { test } from "node:test";
import assert from "node:assert/strict";
import { diasQuieto, textoQuieto, DIAS_QUIETO } from "../lib/quieto";

/**
 * Lo que importa acá es no gritar por nada. Si cada tarjeta de la Bandeja
 * dijera "sin moverse hace 3 días", el aviso deja de significar algo al segundo
 * día de uso. Así que se prueba sobre todo cuándo NO tiene que decir nada:
 * leads cerrados, recién movidos, o sin fecha válida.
 */

const haceDias = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

test("un lead movido hoy no dice nada", () => {
  assert.equal(diasQuieto({ estado: "visita_terreno", ultima_actividad: haceDias(0) }), null);
});

test("por debajo del umbral tampoco", () => {
  assert.equal(diasQuieto({ estado: "visita_terreno", ultima_actividad: haceDias(DIAS_QUIETO - 1) }), null);
});

test("desde el umbral, devuelve los días enteros", () => {
  assert.equal(diasQuieto({ estado: "visita_terreno", ultima_actividad: haceDias(4) }), 4);
  assert.equal(diasQuieto({ estado: "presupuesto_enviado", ultima_actividad: haceDias(21) }), 21);
});

test("un lead cerrado no está quieto: terminó", () => {
  for (const estado of ["cerrado", "no_prospero"]) {
    assert.equal(diasQuieto({ estado, ultima_actividad: haceDias(90) }), null, estado);
  }
});

test("las cuatro etapas vivas sí se miran", () => {
  for (const estado of ["contacto_inicial", "cotizador_web", "visita_terreno", "presupuesto_enviado"]) {
    assert.equal(diasQuieto({ estado, ultima_actividad: haceDias(10) }), 10, estado);
  }
});

test("un estado que no existe en la lista no dispara el aviso", () => {
  // Preferible callar que acusar de quieto un estado que nadie mapeó.
  assert.equal(diasQuieto({ estado: "estado_inventado", ultima_actividad: haceDias(30) }), null);
  assert.equal(diasQuieto({ estado: "", ultima_actividad: haceDias(30) }), null);
});

test("sin última actividad se usa la fecha de entrada", () => {
  assert.equal(diasQuieto({ estado: "visita_terreno", ultima_actividad: null, creado: haceDias(8) }), 8);
});

test("sin ninguna fecha válida no dice nada", () => {
  assert.equal(diasQuieto({ estado: "visita_terreno", ultima_actividad: "cualquier cosa", creado: "" }), null);
  assert.equal(diasQuieto({ estado: "visita_terreno" }), null);
});

test("lo que entró hace meses pero se movió ayer está vivo", () => {
  assert.equal(diasQuieto({ estado: "presupuesto_enviado", ultima_actividad: haceDias(1), creado: haceDias(120) }), null);
});

test("el umbral se puede ajustar sin tocar la función", () => {
  assert.equal(diasQuieto({ estado: "visita_terreno", ultima_actividad: haceDias(5) }, new Date(), 10), null);
  assert.equal(diasQuieto({ estado: "visita_terreno", ultima_actividad: haceDias(12) }, new Date(), 10), 12);
});

test("el texto está en singular cuando es un solo día", () => {
  assert.equal(textoQuieto(1), "sin moverse hace 1 día");
  assert.equal(textoQuieto(9), "sin moverse hace 9 días");
});
