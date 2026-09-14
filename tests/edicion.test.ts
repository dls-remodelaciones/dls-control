import { test } from "node:test";
import assert from "node:assert/strict";
import { camposCambiados, datoInvalido } from "../lib/edicion";
import { describir } from "../app/historial";

const con = (body: Record<string, unknown>) => (k: string) => Object.prototype.hasOwnProperty.call(body, k);

test("un teléfono o correo mal escrito se rechaza en vez de borrarse", () => {
  const b1 = { telefono: "9 1234" };
  assert.equal(datoInvalido(b1, con(b1))?.error, "telefono_invalido");
  const b2 = { email: "ana@gmail" };
  assert.equal(datoInvalido(b2, con(b2))?.error, "correo_invalido");
});

test("dejarlos en blanco a propósito o escribirlos bien sí se acepta", () => {
  const b = { telefono: "", email: "  ", nombre: "Ana" };
  assert.equal(datoInvalido(b, con(b)), null);
  const ok = { telefono: "+56 9 5638 1974", email: "ana@gmail.com" };
  assert.equal(datoInvalido(ok, con(ok)), null);
  assert.equal(datoInvalido({}, con({})), null);
});

test("registra solo los datos que cambiaron", () => {
  const previo = { comuna: "Ñuñoa", superficie_m2: 40, nota_interna: "llamar", fecha_proxima_accion: "2026-09-15T13:00:00+00:00", email: null };
  const nuevo = { comuna: "Providencia", superficie_m2: "40", nota_interna: "llamar tarde", fecha_proxima_accion: "2026-09-15T13:00:00.000Z", email: "" };
  const r = camposCambiados(previo, nuevo);
  assert.deepEqual(r.antes, { comuna: "Ñuñoa", nota_interna: null });
  assert.deepEqual(r.despues, { comuna: "Providencia", nota_interna: null });
});

test("el historial dice qué datos cambiaron", () => {
  assert.equal(
    describir({
      tipo: "edicion",
      antes: { score: 60, clasificacion: "B", estado: "contacto_inicial", comuna: "Ñuñoa", telefono: null, nota_interna: null },
      despues: { score: 60, clasificacion: "B", estado: "contacto_inicial", comuna: "Providencia", telefono: "56956381974", nota_interna: null },
    }),
    "Ficha editada · teléfono: vacío → 56956381974 · comuna: Ñuñoa → Providencia · nota actualizada",
  );
  assert.equal(describir({ tipo: "wa_atendido", antes: null, despues: null }), "WhatsApp marcado como atendido");
});
