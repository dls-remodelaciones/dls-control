import { test } from "node:test";
import assert from "node:assert/strict";
import { aCsv, celda } from "../lib/exportar";

test("celdas seguras para Excel", () => {
  assert.equal(celda("Ana"), "Ana");
  assert.equal(celda("=HYPERLINK(\"x\")"), "\"'=HYPERLINK(\"\"x\"\")\"");
  assert.equal(celda("+56912345678"), "'+56912345678");
  assert.equal(celda("Pérez; Hijos"), "\"Pérez; Hijos\"");
  assert.equal(celda("línea 1\nlínea 2"), "\"línea 1\nlínea 2\"");
  assert.equal(celda(null), "");
});

test("CSV con BOM, separador ; y una fila por lead", () => {
  const csv = aCsv([
    { creado: "2026-09-13T15:00:00Z", nombre: "Ana", telefono: "56912345678", clasificacion: "A", score: 83.5, comuna: "Ñuñoa" },
  ]);
  assert.ok(csv.startsWith("﻿Fecha;Nombre;Teléfono"));
  const filas = csv.trim().split("\r\n");
  assert.equal(filas.length, 2);
  assert.match(filas[1], /^2026-09-13;Ana;56912345678;;;Ñuñoa;/);
  assert.match(filas[1], /;A;83,5;/);
});
