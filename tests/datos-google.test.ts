import { test } from "node:test";
import assert from "node:assert/strict";
import { revisarDatosGoogle } from "../lib/datos-google";

test("lee el teléfono del negocio y detecta las preguntas frecuentes", () => {
  const html = `<head>
    <script type="application/ld+json">{"@type":"HomeAndConstructionBusiness","telephone":"+56956381974"}</script>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"FAQPage","mainEntity":[]}
    </script>
    <script>var noEsJson = {;</script>`;
  assert.deepEqual(revisarDatosGoogle(html), { bloques: 2, invalidos: 0, telefono: "56956381974", tienePreguntas: true });
});

test("un bloque con una coma rota cuenta como inválido", () => {
  const r = revisarDatosGoogle(`<script type="application/ld+json">{"telephone":"+56 9 5638 1974",}</script>`);
  assert.equal(r.invalidos, 1);
  assert.equal(r.telefono, "");
});

test("una portada sin datos para Google no revienta", () => {
  assert.deepEqual(revisarDatosGoogle("<html></html>"), { bloques: 0, invalidos: 0, telefono: "", tienePreguntas: false });
});
