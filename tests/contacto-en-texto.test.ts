import { test } from "node:test";
import assert from "node:assert/strict";
import { telefonoEnTexto, correoEnTexto } from "../lib/contacto-en-texto";

/**
 * Detectar el teléfono que la persona escribió en su propio mensaje.
 *
 * Las pruebas que más importan son las de abajo, las de lo que NO debe
 * detectarse: en una remodelación el mensaje viene lleno de cifras —metros,
 * UF, montos— y confundir una con un teléfono significa llamar a un
 * desconocido, o fusionar la ficha de dos clientes distintos.
 */

test("los formatos en que la gente escribe su móvil", () => {
  const casos: [string, string][] = [
    ["mi numero es 9 8765 4321", "998765431".slice(0, 0) + "987654321"],
    ["llámame al +56 9 8765 4321", "987654321"],
    ["+56987654321", "987654321"],
    ["56987654321", "987654321"],
    ["987654321", "987654321"],
    ["mi wsp: 9.8765.4321", "987654321"],
    ["9-8765-4321 gracias", "987654321"],
    ["Hola! Mi fono es 56 9 8765 4321, quedo atenta", "987654321"],
  ];
  for (const [texto, esperado] of casos) {
    assert.equal(telefonoEnTexto(texto), esperado, texto);
  }
});

test("NO confunde las cifras de un proyecto con un teléfono", () => {
  const nada = [
    "quiero remodelar mi cocina de 20 m2",
    "un quincho de 120 metros cuadrados",
    "tengo presupuesto de 2.000 UF",
    "más de $45.000.000 pesos",
    "el depto tiene 3 dormitorios y 90 m2",
    "mi casa es de 200 mts2",
    "presupuesto 95000000 pesos",
  ];
  for (const t of nada) {
    assert.equal(telefonoEnTexto(t), "", t);
  }
});

test("un número que no es móvil chileno no se toma", () => {
  for (const t of ["mi fijo es 22 345 6789", "llama al 800 123 456", "1234", "el 8 7654 3210"]) {
    assert.equal(telefonoEnTexto(t), "", t);
  }
});

test("de un mensaje con cifras y teléfono, saca solo el teléfono", () => {
  const t = "Hola, quiero remodelar mi cocina de 20 m2, presupuesto 2.000 UF. Mi número es 9 8765 4321";
  assert.equal(telefonoEnTexto(t), "987654321");
});

test("sin texto o sin nada que parezca teléfono devuelve vacío", () => {
  for (const t of ["", "   ", "hola", "[image recibido por Instagram]"]) {
    assert.equal(telefonoEnTexto(t), "", t);
  }
});

test("el correo se detecta y se guarda en minúsculas", () => {
  assert.equal(correoEnTexto("escríbeme a Ana.Perez@Correo.CL porfa"), "ana.perez@correo.cl");
  assert.equal(correoEnTexto("mi mail: juan+obras@gmail.com"), "juan+obras@gmail.com");
});

test("un texto sin correo no inventa uno", () => {
  for (const t of ["hola @dls.remodelaciones", "cuesta 20 m2", ""]) {
    assert.equal(correoEnTexto(t), "", t);
  }
});
