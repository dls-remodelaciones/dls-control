import { test } from "node:test";
import assert from "node:assert/strict";
import { agruparPorEtapa, ETAPAS } from "../lib/etapas";

/**
 * El pipeline es donde se mira qué se está quedando trabado. Lo que se prueba
 * es que ningún lead desaparezca de la vista: un estado que esta lista no
 * conozca tiene que seguir apareciendo, porque un cliente invisible es un
 * cliente perdido y no falla nada a la vista cuando pasa.
 */

type L = { id: string; estado: string; creado?: string };

test("las etapas salen en el orden del negocio, no alfabético ni por tamaño", () => {
  const filas: L[] = [
    { id: "1", estado: "cerrado" },
    { id: "2", estado: "visita_terreno" },
    { id: "3", estado: "cotizador_web" },
    { id: "4", estado: "presupuesto_enviado" },
  ];
  assert.deepEqual(
    agruparPorEtapa(filas).map((g) => g.etapa.clave),
    ["cotizador_web", "visita_terreno", "presupuesto_enviado", "cerrado"],
  );
});

test("las etapas vacías no aparecen: una sección con cero adentro es ruido", () => {
  const g = agruparPorEtapa([{ id: "1", estado: "visita_terreno" }]);
  assert.equal(g.length, 1);
  assert.equal(g[0].etapa.clave, "visita_terreno");
});

test("dentro de una etapa, lo último que entró va arriba", () => {
  const filas: L[] = [
    { id: "viejo", estado: "visita_terreno", creado: "2026-09-01T10:00:00Z" },
    { id: "nuevo", estado: "visita_terreno", creado: "2026-09-14T10:00:00Z" },
    { id: "medio", estado: "visita_terreno", creado: "2026-09-08T10:00:00Z" },
  ];
  assert.deepEqual(
    agruparPorEtapa(filas)[0].leads.map((l) => l.id),
    ["nuevo", "medio", "viejo"],
  );
});

test("un estado desconocido no desaparece: sale en su propio grupo, al final", () => {
  const filas: L[] = [
    { id: "1", estado: "visita_terreno" },
    { id: "2", estado: "estado_inventado_manana" },
  ];
  const g = agruparPorEtapa(filas);
  assert.equal(g.length, 2);
  assert.equal(g[1].etapa.clave, "estado_inventado_manana");
  assert.equal(g[1].leads.length, 1);
});

test("un lead sin estado tampoco se pierde", () => {
  const g = agruparPorEtapa([{ id: "1", estado: "" }]);
  assert.equal(g.length, 1);
  assert.equal(g[0].etapa.nombre, "Sin etapa");
  assert.equal(g[0].leads[0].id, "1");
});

test("no se pierde ni se duplica ningún lead al repartirlos", () => {
  const filas: L[] = [
    { id: "a", estado: "cotizador_web" },
    { id: "b", estado: "cerrado" },
    { id: "c", estado: "raro" },
    { id: "d", estado: "cotizador_web" },
    { id: "e", estado: "no_prospero" },
  ];
  const repartidos = agruparPorEtapa(filas).flatMap((g) => g.leads.map((l) => l.id));
  assert.equal(repartidos.length, filas.length);
  assert.deepEqual([...repartidos].sort(), ["a", "b", "c", "d", "e"]);
});

test("las etapas cerradas están marcadas como tales, y van al final", () => {
  const cerradas = ETAPAS.filter((e) => !e.viva).map((e) => e.clave);
  assert.deepEqual(cerradas, ["cerrado", "no_prospero"]);
  assert.deepEqual(ETAPAS.slice(-2).map((e) => e.clave), cerradas, "las cerradas van al final del camino");
});

test("cada etapa dice qué falta para que avance", () => {
  for (const e of ETAPAS) {
    assert.ok(e.pendiente.length > 0, `${e.clave} no dice qué falta`);
    assert.ok(e.color.startsWith("var("), `${e.clave} debería usar un color del panel`);
  }
});

test("una lista vacía no devuelve secciones fantasma", () => {
  assert.deepEqual(agruparPorEtapa([]), []);
});
