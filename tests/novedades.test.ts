import { test } from "node:test";
import assert from "node:assert/strict";
import {
  diasSinLeads,
  cambioDeNombre,
  aSinLlamar,
  presupuestosDormidos,
  type EstadoNombre,
} from "../lib/novedades";

const ahora = new Date("2026-09-20T12:00:00Z");

test("días sin leads, redondeado hacia abajo", () => {
  assert.equal(diasSinLeads("2026-09-20T08:00:00Z", ahora), 0);
  assert.equal(diasSinLeads("2026-09-15T13:00:00Z", ahora), 4);
  assert.equal(diasSinLeads("2026-09-15T11:00:00Z", ahora), 5);
  assert.equal(diasSinLeads(null, ahora), null);
});

test("leads A sin llamar: aptos, en contacto inicial y con más de 48 h", () => {
  const l = (creado: string, extra = {}) => ({ clasificacion: "A", apto_para_llamar: true, estado: "contacto_inicial", creado, ...extra });
  const r = aSinLlamar(
    [
      l("2026-09-17T12:00:00Z"), // 72 h → sí
      l("2026-09-18T12:00:00Z"), // 48 h justas → sí
      l("2026-09-19T12:00:00Z"), // 24 h → todavía no
      l("2026-09-10T12:00:00Z", { estado: "visita_terreno" }), // ya se movió
      l("2026-09-10T12:00:00Z", { apto_para_llamar: false }), // A sin teléfono válido
      l("2026-09-10T12:00:00Z", { clasificacion: "B" }),
    ],
    ahora,
  );
  assert.equal(r.length, 2);
});

const base: EstadoNombre = { nombre: "D.L.S", estado: "APPROVED", nuevo: "PENDING_REVIEW" };

test("la primera vez solo guarda, no avisa; sin cambios tampoco", () => {
  assert.equal(cambioDeNombre(null, base), null);
  assert.equal(cambioDeNombre(base, { ...base }), null);
});

test("avisa cuando Meta aprueba el nombre nuevo", () => {
  const r = cambioDeNombre(base, { nombre: "DLS Remodelaciones", estado: "APPROVED", nuevo: "NONE" });
  assert.equal(r?.titulo, "Meta aprobó el nombre de WhatsApp");
  assert.match(r!.cuerpo, /DLS Remodelaciones/);
});

test("avisa cuando Meta lo rechaza", () => {
  const r = cambioDeNombre(base, { ...base, nuevo: "DECLINED" });
  assert.equal(r?.titulo, "Meta rechazó el nombre de WhatsApp");
});

/* ── presupuestos dormidos ──────────────────────────────────────────────── */

/**
 * Un presupuesto enviado es el dinero más cercano que hay en el panel: ya se
 * hizo el trabajo de cotizar. Lo que se prueba acá es que no se avise antes de
 * tiempo (insistir a los dos días molesta) ni se deje pasar una venta que se
 * enfría, y que "sin movimiento" se mida por la última actividad y no por
 * cuándo entró el lead.
 */
const haceDias = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

test("un presupuesto de ayer no está dormido", () => {
  const r = presupuestosDormidos(
    [{ estado: "presupuesto_enviado", ultima_actividad: haceDias(1), creado: haceDias(30) }],
    new Date(),
  );
  assert.equal(r.length, 0, "lo movieron ayer: no urge");
});

test("un presupuesto de diez días sí está dormido", () => {
  const r = presupuestosDormidos(
    [{ estado: "presupuesto_enviado", ultima_actividad: haceDias(10), creado: haceDias(40) }],
    new Date(),
  );
  assert.equal(r.length, 1);
});

test("el borde son siete días, y cae del lado de avisar", () => {
  assert.equal(
    presupuestosDormidos([{ estado: "presupuesto_enviado", ultima_actividad: haceDias(7.1), creado: haceDias(9) }], new Date()).length,
    1,
  );
  assert.equal(
    presupuestosDormidos([{ estado: "presupuesto_enviado", ultima_actividad: haceDias(6.5), creado: haceDias(9) }], new Date()).length,
    0,
  );
});

test("solo mira presupuestos enviados, no otras etapas", () => {
  const leads = [
    { estado: "contacto_inicial", ultima_actividad: haceDias(30), creado: haceDias(30) },
    { estado: "visita_terreno", ultima_actividad: haceDias(30), creado: haceDias(30) },
    { estado: "cerrado", ultima_actividad: haceDias(30), creado: haceDias(30) },
    { estado: "no_prospero", ultima_actividad: haceDias(30), creado: haceDias(30) },
    { estado: "presupuesto_enviado", ultima_actividad: haceDias(30), creado: haceDias(30) },
  ];
  const r = presupuestosDormidos(leads, new Date());
  assert.equal(r.length, 1);
  assert.equal(r[0].estado, "presupuesto_enviado");
});

test("un presupuesto viejo que se movió hoy no aparece", () => {
  // Lo que importa es cuánto lleva quieto, no cuándo entró el cliente.
  const r = presupuestosDormidos(
    [{ estado: "presupuesto_enviado", ultima_actividad: haceDias(0), creado: haceDias(90) }],
    new Date(),
  );
  assert.equal(r.length, 0);
});

test("sin última actividad se usa la fecha de entrada", () => {
  const r = presupuestosDormidos(
    [{ estado: "presupuesto_enviado", ultima_actividad: null, creado: haceDias(20) }],
    new Date(),
  );
  assert.equal(r.length, 1);
});

test("el más frío va primero", () => {
  const leads = [
    { id: "medio", estado: "presupuesto_enviado", ultima_actividad: haceDias(10), creado: haceDias(10) },
    { id: "frio", estado: "presupuesto_enviado", ultima_actividad: haceDias(25), creado: haceDias(25) },
    { id: "tibio", estado: "presupuesto_enviado", ultima_actividad: haceDias(8), creado: haceDias(8) },
  ];
  assert.deepEqual(
    presupuestosDormidos(leads, new Date()).map((l) => l.id),
    ["frio", "medio", "tibio"],
  );
});

test("una fecha inválida no cuenta como dormido", () => {
  const r = presupuestosDormidos(
    [{ estado: "presupuesto_enviado", ultima_actividad: "cualquier cosa", creado: "tampoco" }],
    new Date(),
  );
  assert.equal(r.length, 0);
});
