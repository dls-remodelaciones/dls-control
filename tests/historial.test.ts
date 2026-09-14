import { test } from "node:test";
import assert from "node:assert/strict";
import { describir } from "../app/historial";

test("describe cada tipo de actividad en palabras", () => {
  assert.equal(describir({ tipo: "llamada", antes: null, despues: null }), "Llamada desde el panel");
  assert.equal(
    describir({ tipo: "edicion", antes: { score: 70, clasificacion: "B", estado: "contacto_inicial" }, despues: { score: 80, clasificacion: "A", estado: "visita_terreno" } }),
    "Ficha editada · estado: contacto inicial → visita a terreno · B 70 → A 80",
  );
  assert.equal(describir({ tipo: "score", antes: null, despues: { score: 58, clasificacion: "B" } }), "Entró como B 58");
  assert.equal(describir({ tipo: "whatsapp_no_entregado", antes: null, despues: { motivo: "número sin WhatsApp" } }), "WhatsApp no entregado · número sin WhatsApp");
  assert.equal(describir({ tipo: "otro", antes: null, despues: null }), "otro");
});
