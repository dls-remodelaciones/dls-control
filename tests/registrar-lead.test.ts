import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { registrarLead, type EntradaLead } from "../lib/registrar-lead";
import { interaccionPrevia } from "../lib/negocio";
import { dbFalsa } from "./db-falsa";

/**
 * Pruebas del registro de leads: la puerta por la que entra cada lead de las
 * cuatro vías (cotizador, chatbot, formulario, WhatsApp) y del alta manual.
 *
 * Lo que se protege acá es la regla "nada se pierde": un mismo cliente no se
 * duplica, un dato que ya teníamos no se borra porque llegó un envío más pobre,
 * y lo que Daniel movió a mano no lo pisa el sistema.
 *
 * Escribirlas encontró cuatro fallas reales (13-sep-2026), cada una con su
 * prueba abajo: un filtro que dejaba a un envío caer sobre la ficha de otro
 * cliente, el nombre que se borraba, los puntos del cotizador que se perdían al
 * recalcular y la fuente original que se pisaba.
 */

const registrar = (db: never, body: EntradaLead) => registrarLead(body, db);

function ok<T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> {
  assert.equal(r.ok, true, `se esperaba ok y llegó ${JSON.stringify(r)}`);
  return r as Extract<T, { ok: true }>;
}

describe("alta y dedupe", () => {
  test("un lead nuevo con teléfono se crea, queda NUEVO y avisa", async () => {
    const { db, tablas } = dbFalsa();
    const r = ok(await registrar(db, { canal: "chatbot", nombre: "Ana", telefono: "+56 9 1234 5678", tipo_proyecto: "cocina" }));
    assert.equal(r.creado, true);
    assert.equal(r.etiqueta, "NUEVO");
    assert.equal(r.recien_contactable, true);
    assert.equal(tablas.leads.length, 1);
    assert.equal(tablas.leads[0].telefono, "56912345678");
    assert.equal(tablas.mensajes.length, 1, "queda el rastro de lo que llegó");
  });

  test("el mismo teléfono escrito distinto cae en la misma ficha y no vuelve a avisar", async () => {
    const { db, tablas } = dbFalsa();
    ok(await registrar(db, { canal: "chatbot", nombre: "Ana", telefono: "+56 9 1234 5678" }));
    const r = ok(await registrar(db, { canal: "whatsapp", nombre: "Ana", telefono: "912345678", mensaje: "hola" }));
    assert.equal(r.creado, false);
    assert.equal(r.recien_contactable, false);
    assert.equal(tablas.leads.length, 1);
  });

  test("el mismo correo en mayúsculas también es la misma persona", async () => {
    const { db, tablas } = dbFalsa();
    ok(await registrar(db, { nombre: "Ana", email: "ana@correo.cl" }));
    ok(await registrar(db, { nombre: "Ana", email: "ANA@Correo.cl" }));
    assert.equal(tablas.leads.length, 1);
  });

  test("sin contacto ni datos se rechaza; sin contacto y con datos exige sesión", async () => {
    const { db } = dbFalsa();
    const vacio = await registrar(db, {});
    assert.equal(vacio.ok, false);
    const sinSesion = await registrar(db, { nombre: "Ana" });
    assert.equal(sinSesion.ok, false);
  });

  test("un lead sin contacto entra como SIN CONTACTO y avisa recién cuando deja su teléfono", async () => {
    const { db, tablas } = dbFalsa();
    const r1 = ok(await registrar(db, { canal: "cotizador", sesion_id: "s-1", tipo_proyecto: "bano", comuna: "Ñuñoa" }));
    assert.equal(r1.etiqueta, "SIN CONTACTO");
    assert.equal(r1.recien_contactable, false);
    const r2 = ok(await registrar(db, { canal: "cotizador", sesion_id: "s-1", nombre: "Ana", telefono: "912345678" }));
    assert.equal(r2.creado, false);
    assert.equal(r2.etiqueta, "NUEVO");
    assert.equal(r2.recien_contactable, true);
    assert.equal(tablas.leads.length, 1);
  });
});

describe("nada se pierde al fusionar", () => {
  test("un envío sin comuna no borra la comuna que ya estaba", async () => {
    const { db, tablas } = dbFalsa();
    ok(await registrar(db, { nombre: "Ana", telefono: "912345678", comuna: "Providencia" }));
    ok(await registrar(db, { telefono: "912345678", mensaje: "¿me llaman?" }));
    assert.equal(tablas.leads[0].comuna, "Providencia");
  });

  test("un mensaje sin nombre no reemplaza el nombre por 'Sin nombre'", async () => {
    const { db, tablas } = dbFalsa();
    ok(await registrar(db, { canal: "chatbot", nombre: "Ana Pérez", telefono: "912345678" }));
    const r = ok(await registrar(db, { canal: "whatsapp", nombre: "", telefono: "56912345678", mensaje: "hola" }));
    assert.equal(tablas.leads[0].nombre, "Ana Pérez");
    assert.equal(r.nombre, "Ana Pérez");
  });

  test("a quien nunca dio nombre se le muestra 'Sin nombre'", async () => {
    const { db, tablas } = dbFalsa();
    ok(await registrar(db, { telefono: "912345678", mensaje: "hola" }));
    assert.equal(tablas.leads[0].nombre, "Sin nombre");
  });

  test("las fotos que ya había no se borran con un envío sin fotos", async () => {
    const { db, tablas } = dbFalsa();
    ok(await registrar(db, { nombre: "Ana", telefono: "912345678", fotos: ["a.jpg"] }));
    ok(await registrar(db, { telefono: "912345678", comuna: "Ñuñoa" }));
    assert.deepEqual(tablas.leads[0].fotos, ["a.jpg"]);
  });

  test("la fuente original es la del primer contacto, no la del último", async () => {
    const { db, tablas } = dbFalsa();
    ok(await registrar(db, { canal: "cotizador", nombre: "Ana", telefono: "912345678", fuente_original: "google" }));
    ok(await registrar(db, { canal: "whatsapp", telefono: "912345678", mensaje: "hola", fuente_original: "whatsapp" }));
    assert.equal(tablas.leads[0].fuente_original, "google");
  });

  test("haber completado el cotizador sigue sumando después de que escribe por WhatsApp", async () => {
    const { db, tablas } = dbFalsa();
    const base = { nombre: "Ana", telefono: "912345678", tipo_proyecto: "cocina", comuna: "Providencia", superficie_m2: 20 };
    const r1 = ok(await registrar(db, { ...base, canal: "cotizador" }));
    const r2 = ok(await registrar(db, { canal: "whatsapp", telefono: "912345678", mensaje: "hola" }));
    assert.equal(r2.score, r1.score, "el puntaje no puede bajar por escribir");
    assert.equal(interaccionPrevia(tablas.leads[0]).termino_cotizador, true);
  });

  test("una etiqueta que Daniel movió a mano no la pisa un envío nuevo", async () => {
    const { db, tablas } = dbFalsa();
    ok(await registrar(db, { nombre: "Ana", telefono: "912345678" }));
    tablas.leads[0].etiqueta = "SEGUIMIENTO";
    const r = ok(await registrar(db, { telefono: "912345678", mensaje: "hola" }));
    assert.equal(tablas.leads[0].etiqueta, "SEGUIMIENTO");
    assert.equal(r.etiqueta, "SEGUIMIENTO");
  });
});

describe("varios proyectos de una misma persona", () => {
  test("se acumulan, el repetido no se duplica y manda el más grande", async () => {
    const { db, tablas } = dbFalsa();
    ok(await registrar(db, { nombre: "Ana", telefono: "912345678", tipo_proyecto: "bano", superficie_m2: 6, comuna: "Ñuñoa" }));
    ok(await registrar(db, { telefono: "912345678", tipo_proyecto: "quincho", superficie_m2: 40, comuna: "Ñuñoa" }));
    ok(await registrar(db, { telefono: "912345678", tipo_proyecto: "bano", superficie_m2: 6, comuna: "Ñuñoa" }));
    const lead = tablas.leads[0];
    assert.equal((lead.proyectos as unknown[]).length, 2);
    assert.equal(lead.tipo_proyecto, "quincho");
    assert.equal(lead.superficie_m2, 40);
  });
});

describe("seguridad del filtro de búsqueda", () => {
  test("un sesion_id armado no puede hacer caer el envío sobre la ficha de otro cliente", async () => {
    const { db, tablas } = dbFalsa();
    ok(await registrar(db, { nombre: "Cliente real", telefono: "912345678", comuna: "Vitacura" }));
    await registrar(db, { nombre: "Intruso", sesion_id: "x,telefono.neq.0", comuna: "Otra" });
    const real = tablas.leads.find((l) => l.telefono === "56912345678");
    assert.equal(real?.nombre, "Cliente real");
    assert.equal(real?.comuna, "Vitacura");
  });

  test("un correo con coma tampoco se cuela", async () => {
    const { db, tablas } = dbFalsa();
    ok(await registrar(db, { nombre: "Cliente real", telefono: "912345678" }));
    await registrar(db, { nombre: "Intruso", email: "a,telefono.neq.0@x.cl" });
    assert.equal(tablas.leads.find((l) => l.telefono === "56912345678")?.nombre, "Cliente real");
  });
});
