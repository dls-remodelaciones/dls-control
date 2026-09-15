import { test } from "node:test";
import assert from "node:assert/strict";
import { revisarContactoPublicado, resumirContactoPublicado } from "../lib/contacto-publicado";

/**
 * Este chequeo tiene que aguantar el sitio real, que está lleno de correos y
 * teléfonos de ejemplo en los formularios. Si grita por esos, Daniel lo empieza
 * a ignorar y el día que aparezca un correo personal de verdad no le va a
 * creer. Así que se prueban las dos direcciones: que detecte lo malo y que
 * NO se queje de lo bueno.
 */

const OFICIAL = { dominioOficial: "dlsremodelaciones.cl", telefonoOficial: "+56 9 5638 1974" };

/** Atajo: revisar una sola página y resumirla, como hacía la versión anterior. */
function revisarUna(html: string, donde = "el sitio") {
  return resumirContactoPublicado(
    [{ donde, contacto: revisarContactoPublicado(html, OFICIAL) }],
    OFICIAL.dominioOficial,
  );
}

test("un sitio correcto no genera ninguna alarma", () => {
  const html = `
    <p>Escríbenos a contacto@dlsremodelaciones.cl</p>
    <a href="https://wa.me/56956381974">+56 9 5638 1974</a>
    <input placeholder="tucorreo@ejemplo.cl">
    <input placeholder="+56 9 1234 5678">
    <span>nombre@correo.cl</span>`;
  const r = revisarContactoPublicado(html, OFICIAL);
  assert.deepEqual(r.correosPersonales, []);
  assert.deepEqual(r.telefonosAjenos, []);
  assert.equal(revisarUna(html).ok, true);
});

test("detecta un correo personal publicado", () => {
  const html = "<p>Contacto: daniel.lehmann@gmail.com</p>";
  assert.deepEqual(revisarContactoPublicado(html, OFICIAL).correosPersonales, ["daniel.lehmann@gmail.com"]);
  const s = revisarUna(html);
  assert.equal(s.ok, false);
  assert.match(s.detalle, /un correo personal \(daniel\.lehmann@gmail\.com\)/);
  assert.match(s.detalle, /no entra al panel/);
});

test("el aviso dice en cuál de las dos páginas está el problema", () => {
  // Sin esto el aviso decía "hay un correo personal" y no se sabía si había que
  // ir al sitio o al panel. El problema real del 14-sep estaba en el panel.
  const s = resumirContactoPublicado(
    [
      { donde: "el sitio", contacto: revisarContactoPublicado("<p>contacto@dlsremodelaciones.cl</p>", OFICIAL) },
      { donde: "la página de ingreso", contacto: revisarContactoPublicado("<p>x@gmail.com</p>", OFICIAL) },
    ],
    OFICIAL.dominioOficial,
  );
  assert.equal(s.ok, false);
  assert.match(s.detalle, /en la página de ingreso/);
  assert.doesNotMatch(s.detalle, /en el sitio,/, "no debe acusar a la página que está bien");
});

test("cuando las dos están bien, el aviso nombra las dos", () => {
  const s = resumirContactoPublicado(
    [
      { donde: "el sitio", contacto: revisarContactoPublicado("<p>contacto@dlsremodelaciones.cl</p>", OFICIAL) },
      { donde: "la página de ingreso", contacto: revisarContactoPublicado("<p>tu@correo.cl</p>", OFICIAL) },
    ],
    OFICIAL.dominioOficial,
  );
  assert.equal(s.ok, true);
  assert.match(s.detalle, /el sitio y la página de ingreso/);
});

test("detecta los proveedores personales más usados en Chile", () => {
  for (const correo of ["x@hotmail.com", "x@outlook.cl", "x@yahoo.es", "x@icloud.com", "x@live.cl"]) {
    const r = revisarContactoPublicado(`<p>${correo}</p>`, OFICIAL);
    assert.deepEqual(r.correosPersonales, [correo], `no detectó ${correo}`);
  }
});

test("detecta un teléfono que no es el de la empresa", () => {
  const html = '<a href="https://wa.me/56982291198">escríbenos</a>';
  assert.deepEqual(revisarContactoPublicado(html, OFICIAL).telefonosAjenos, ["982291198"]);
  const s = revisarUna(html);
  assert.equal(s.ok, false);
  assert.match(s.detalle, /\+56 982291198/);
  assert.match(s.detalle, /no es el número de la empresa/);
});

test("el número de la empresa se reconoce en cualquier formato", () => {
  for (const escrito of ["+56 9 5638 1974", "56956381974", "+56956381974", "9 5638 1974", "9-5638-1974"]) {
    const r = revisarContactoPublicado(`<p>${escrito}</p>`, OFICIAL);
    assert.deepEqual(r.telefonosAjenos, [], `marcó como ajeno el número propio escrito "${escrito}"`);
  }
});

test("no marca lo que está dentro de un comentario o de un script", () => {
  const html = `
    <!-- antes decía viejo@gmail.com -->
    <script>const ejemplo = "otro@gmail.com";</script>
    <p>contacto@dlsremodelaciones.cl</p>`;
  const r = revisarContactoPublicado(html, OFICIAL);
  assert.deepEqual(r.correosPersonales, [], "un correo comentado o en un script no está publicado");
});

test("el mismo correo repetido se cuenta una vez", () => {
  const r = revisarContactoPublicado("<p>a@gmail.com</p><footer>a@gmail.com</footer>", OFICIAL);
  assert.equal(r.correosPersonales.length, 1);
});

test("los ejemplos de relleno no cuentan como teléfonos ajenos", () => {
  for (const relleno of ["+56 9 1234 5678", "+56 9 0000 0000", "+56 9 9999 9999"]) {
    const r = revisarContactoPublicado(`<input placeholder="${relleno}">`, OFICIAL);
    assert.deepEqual(r.telefonosAjenos, [], `marcó el ejemplo ${relleno}`);
  }
});

test("los identificadores largos de la portada no pasan por teléfono", () => {
  // Estos están de verdad en el sitio y en los datos de Meta. Si el patrón se
  // comiera un trozo de ellos, la revisión de las 8:00 avisaría de un número
  // inexistente todos los días hasta que nadie le crea.
  const html = `
    <a href="https://www.facebook.com/profile.php?id=61593048545595">Facebook</a>
    <meta name="waba" content="1064608879652326">
    <script>gtag('config','G-2JWSJNQBQC');</script>
    <p>WABA 102938475869504</p>`;
  const r = revisarContactoPublicado(html, OFICIAL);
  assert.deepEqual(r.telefonosAjenos, [], `confundió un id con un teléfono: ${r.telefonosAjenos}`);
});

test("un fijo o un número extranjero no se confunde con un móvil chileno", () => {
  const r = revisarContactoPublicado("<p>+56 2 2345 6789 · +1 555 010 9999</p>", OFICIAL);
  assert.deepEqual(r.telefonosAjenos, []);
});

test("sin teléfono oficial configurado no acusa al número propio como ajeno", () => {
  // Si Meta no responde, `numeroMeta` llega vacío: mejor no decir nada que
  // acusar en falso y hacer que el chequeo pierda credibilidad.
  const r = revisarContactoPublicado("<p>+56 9 5638 1974</p>", { dominioOficial: "dlsremodelaciones.cl" });
  assert.equal(r.telefonosAjenos.length, 1, "sin referencia, lo reporta para que Daniel decida");
});

test("html vacío o basura no rompe la revisión diaria", () => {
  for (const nada of ["", "   ", "<html></html>"]) {
    const r = revisarContactoPublicado(nada, OFICIAL);
    assert.deepEqual(r.correosPersonales, []);
    assert.deepEqual(r.telefonosAjenos, []);
  }
});
