import { test } from "node:test";
import assert from "node:assert/strict";
import { correoDelPanel } from "../lib/sesion";

test("solo los correos del panel tienen acceso", () => {
  delete process.env.PANEL_EMAILS;
  assert.equal(correoDelPanel("dls.lehmann@gmail.com"), true);
  assert.equal(correoDelPanel("DLS.Lehmann@Gmail.com "), true);
  assert.equal(correoDelPanel("cualquiera@gmail.com"), false);
  assert.equal(correoDelPanel(""), false);
});

test("PANEL_EMAILS permite sumar a alguien sin tocar código", () => {
  process.env.PANEL_EMAILS = "dls.lehmann@gmail.com, socio@dlsremodelaciones.cl";
  assert.equal(correoDelPanel("socio@dlsremodelaciones.cl"), true);
  assert.equal(correoDelPanel("otro@dlsremodelaciones.cl"), false);
  delete process.env.PANEL_EMAILS;
});
