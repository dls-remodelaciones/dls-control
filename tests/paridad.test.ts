import { test } from "node:test";
import assert from "node:assert/strict";
import { diferenciasConfig } from "../lib/paridad";
import { config } from "../lib/negocio";
import { atrasadas } from "../lib/latidos";

/** Arma un negocio.json del sitio a partir de la config del panel, como está publicado hoy. */
function sitioIgual() {
  const c = config();
  return {
    scoring: {
      pesos: { ...c.pesos },
      umbrales: { ...c.umbrales },
      presupuesto: { ...c.puntos.presupuesto },
      plazo: { ...c.puntos.plazo },
      comuna: { ...c.puntos.comuna },
      propiedad: { ...c.puntos.propiedad },
      superficie: { ...c.puntos.superficie },
      interaccion: { subio_fotos: c.puntos.interaccion.fotos, termino_cotizador: c.puntos.interaccion.cotizador, respondio_followup: c.puntos.interaccion.followup },
    },
    cobertura: { comunas_principales: [...c.comunas_principales], comunas_secundarias: [...c.comunas_secundarias] },
    tipos_proyecto: Object.fromEntries(
      Object.entries(c.tipos).map(([k, t]) => [
        k,
        { label: t.label, uf_m2: t.uf_m2, superficie_coherente: { ...t.superficie }, rangos_presupuesto: t.rangos.map((label) => ({ label })) },
      ]),
    ),
  };
}

test("sin diferencias cuando el sitio y el panel coinciden", () => {
  assert.deepEqual(diferenciasConfig(sitioIgual(), config()), []);
});

test("detecta un tramo, un umbral y un tipo que cambiaron en un solo lado", () => {
  const s = sitioIgual();
  s.scoring.umbrales.A = 80;
  (s.tipos_proyecto.bano as { rangos_presupuesto: { label: string }[] }).rangos_presupuesto[0].label = "Menos de $3.000.000";
  delete (s.tipos_proyecto as Record<string, unknown>).quincho;
  const d = diferenciasConfig(s, config());
  assert.equal(d.length, 3);
  assert.ok(d.some((x) => x.startsWith("umbrales")));
  assert.ok(d.some((x) => x.startsWith("bano.tramos")));
  assert.ok(d.some((x) => x.includes("quincho") && x.includes("solo en el panel")));
});

test("tareas automáticas atrasadas", () => {
  const ahora = new Date("2026-09-14T12:00:00Z");
  assert.deepEqual(atrasadas({ recordatorio: "2026-09-14T11:00:00Z" }, ahora), []);
  assert.deepEqual(atrasadas({ recordatorio: "2026-09-14T06:00:00Z" }, ahora), ["Recordatorios de cada hora: no corre hace 6 h"]);
  assert.deepEqual(atrasadas({ resumen: "2026-09-01T12:00:00Z" }, ahora), ["Resumen semanal: no corre hace 13 días"]);
  assert.deepEqual(atrasadas({}, ahora), []);
});
