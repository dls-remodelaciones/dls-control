import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { firmaValida } from "../lib/firma-meta";

// Secreto de PRUEBA, inventado para este archivo. No es el de la app.
const SECRETO = "secreto-de-prueba-0123456789abcdef";
const cuerpo = JSON.stringify({ object: "whatsapp_business_account", entry: [{ changes: [] }] });
const firmar = (texto: string, secreto = SECRETO) => "sha256=" + crypto.createHmac("sha256", secreto).update(texto).digest("hex");

// Los mensajes de log de los rechazos ensucian la salida de las pruebas.
console.error = () => {};
console.warn = () => {};

test("acepta un POST firmado por Meta con el secreto correcto", () => {
  assert.equal(firmaValida(cuerpo, firmar(cuerpo), SECRETO), true);
});

test("rechaza si el cuerpo fue alterado después de firmar", () => {
  const alterado = cuerpo.replace("whatsapp_business_account", "whatsapp_business_accounx");
  assert.equal(firmaValida(alterado, firmar(cuerpo), SECRETO), false);
});

test("rechaza una firma hecha con otro secreto", () => {
  assert.equal(firmaValida(cuerpo, firmar(cuerpo, "otro-secreto"), SECRETO), false);
});

test("rechaza sin cabecera, con otro algoritmo o con largo distinto", () => {
  assert.equal(firmaValida(cuerpo, null, SECRETO), false);
  assert.equal(firmaValida(cuerpo, firmar(cuerpo).replace("sha256=", "sha1="), SECRETO), false);
  assert.equal(firmaValida(cuerpo, "sha256=abc", SECRETO), false);
});

test("un secreto pegado con espacios o salto de línea sigue funcionando", () => {
  assert.equal(firmaValida(cuerpo, firmar(cuerpo), `  ${SECRETO}\n`), true);
});

test("sin secreto configurado deja pasar (y la revisión diaria avisa que falta)", () => {
  assert.equal(firmaValida(cuerpo, null, undefined), true);
  assert.equal(firmaValida(cuerpo, null, "   "), true);
});
