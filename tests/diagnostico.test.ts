import { test } from "node:test";
import assert from "node:assert/strict";
import { diagnosticar, type LeadDiag, type MensajeDiag } from "../lib/diagnostico";

const lead = (extra: Partial<LeadDiag> = {}): LeadDiag => ({
  id: "L1",
  nombre: "Ana",
  fuente_original: "google",
  desglose: [{ senal: "Interacción", detalle: "cotizador" }],
  ...extra,
});
const msg = (cuerpo: unknown, creado: string, canal = "chatbot"): MensajeDiag => ({
  lead_id: "L1",
  canal,
  cuerpo: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo),
  creado,
});

test("una ficha sana no propone nada", () => {
  const r = diagnosticar([lead()], [msg({ nombre: "Ana", fuente_original: "google" }, "2026-09-10T10:00:00Z")], new Set());
  assert.deepEqual(r, []);
});

test("recupera el nombre borrado desde el último envío que lo traía", () => {
  const r = diagnosticar(
    [lead({ nombre: "Sin nombre" })],
    [
      msg({ nombre: "Ana P", fuente_original: "google" }, "2026-09-10T10:00:00Z"),
      msg({ nombre: "Ana Pérez" }, "2026-09-11T10:00:00Z"),
      msg("hola (texto de WhatsApp)", "2026-09-12T10:00:00Z", "whatsapp"),
    ],
    new Set(),
  );
  assert.equal(r[0].cambios.find((c) => c.campo === "nombre")?.propuesto, "Ana Pérez");
});

test("propone la fuente del primer envío si fue pisada", () => {
  const r = diagnosticar(
    [lead({ fuente_original: "whatsapp" })],
    [msg({ fuente_original: "cotizador www.dlsremodelaciones.cl" }, "2026-09-10T10:00:00Z"), msg({ fuente_original: "whatsapp" }, "2026-09-11T10:00:00Z")],
    new Set(),
  );
  assert.equal(r[0].cambios[0].campo, "fuente_original");
  assert.equal(r[0].cambios[0].propuesto, "cotizador www.dlsremodelaciones.cl");
});

test("detecta puntos de cotizador perdidos", () => {
  const r = diagnosticar([lead({ desglose: [{ senal: "Interacción", detalle: "sin señales" }] })], [], new Set(["L1"]));
  assert.equal(r[0].cambios[0].campo, "puntaje");
});

test("un cuerpo cortado o no JSON no revienta", () => {
  assert.deepEqual(diagnosticar([lead()], [msg('{"nombre": "Ana', "2026-09-10T10:00:00Z")], new Set()), []);
});
