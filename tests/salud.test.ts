import { test } from "node:test";
import assert from "node:assert/strict";
import { leerSitio } from "../lib/salud";

// Fragmentos con la forma real de los archivos publicados del sitio. Si alguien
// cambia cómo se escribe el token o el número allá, esta prueba avisa antes de
// que la revisión diaria empiece a dar falsas alarmas.
const LEAD = `var PANEL = {
  url: 'https://dls-control.vercel.app/api/leads/webhook',
  token: 'dls_abc123'   // viaja en el JS publico a proposito
};`;
const COTIZADOR = `const WA_NUM = '56956381974';  // Chip dedicado
const PANEL_URL='https://dls-control.vercel.app/api/leads/webhook';
const PANEL_TOKEN='dls_abc123';`;

test("lee token, url y número de los archivos del sitio", () => {
  assert.deepEqual(leerSitio(LEAD, COTIZADOR), {
    tokenLead: "dls_abc123",
    tokenCotizador: "dls_abc123",
    urlPanelCotizador: "https://dls-control.vercel.app/api/leads/webhook",
    numeroCotizador: "56956381974",
  });
});

test("si el sitio cambia de forma, devuelve vacío en vez de inventar", () => {
  const r = leerSitio("nada", "nada");
  assert.equal(r.tokenLead, "");
  assert.equal(r.tokenCotizador, "");
  assert.equal(r.numeroCotizador, "");
});
