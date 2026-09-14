import { test } from "node:test";
import assert from "node:assert/strict";
import { PLANTILLAS_APROBADAS, plantillaRellena } from "../lib/whatsapp";

test("las plantillas de respaldo declaran tantas variables como huecos tiene su texto", () => {
  for (const p of PLANTILLAS_APROBADAS) {
    const huecos = new Set(p.cuerpo.match(/\{\{\s*(\d+)\s*\}\}/g) ?? []).size;
    assert.equal(p.variables, huecos, p.nombre);
    assert.equal(p.idioma, "es_CL");
  }
});

test("se rellenan para guardar el texto enviado", () => {
  const p = PLANTILLAS_APROBADAS.find((x) => x.nombre === "visita_terreno")!;
  assert.equal(
    plantillaRellena(p.cuerpo, ["Ana", "Ñuñoa", "jueves 18"]),
    "Hola Ana, te confirmo la visita a terreno en Ñuñoa para el jueves 18. Si te acomoda otro horario, respóndeme por acá y lo movemos.",
  );
});
