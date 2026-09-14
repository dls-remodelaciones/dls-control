import { test } from "node:test";
import assert from "node:assert/strict";
import { fallidos } from "../lib/entregas";

test("solo los fallidos, con el motivo en palabras simples", () => {
  const r = fallidos([
    { id: "a", status: "sent", recipient_id: "56911111111" },
    { id: "b", status: "delivered", recipient_id: "56911111111" },
    { id: "c", status: "failed", recipient_id: "56922222222", errors: [{ code: 131047, title: "Re-engagement message" }] },
  ]);
  assert.equal(r.length, 1);
  assert.equal(r[0].telefono, "56922222222");
  assert.match(r[0].motivo, /24 horas/);
});

test("un código desconocido usa el detalle de Meta", () => {
  const r = fallidos([
    { status: "failed", recipient_id: "56933333333", errors: [{ code: 999, message: "Algo", error_data: { details: "Detalle de Meta" } }] },
  ]);
  assert.equal(r[0].motivo, "Detalle de Meta");
  assert.equal(r[0].codigo, 999);
});

test("sin errores ni destinatario no revienta", () => {
  assert.deepEqual(fallidos([{ status: "failed" }]), []);
  assert.equal(fallidos([{ status: "failed", recipient_id: "569" }])[0].motivo, "Meta no dio el motivo");
});
