import { test } from "node:test";
import assert from "node:assert/strict";
import { agruparPorCanal } from "../lib/agrupar-canal";

/**
 * Acá se decide qué ve Daniel primero al abrir la bandeja, así que lo que se
 * prueba es el orden, no el agrupado —agrupar es fácil, ordenar bien es el
 * trabajo—. El error caro sería enterrar un canal con alguien esperando debajo
 * de treinta cotizaciones dormidas del sitio.
 */

type L = { id: string; canal?: string | null; creado?: string };

/** Hace `h` horas, en ISO. */
function haceHoras(h: number): string {
  return new Date(Date.now() - h * 3_600_000).toISOString();
}

const sinNadie = new Map<string, string>();

test("cada canal queda en su propio grupo, con su ícono y su nombre", () => {
  const filas: L[] = [
    { id: "1", canal: "whatsapp" },
    { id: "2", canal: "instagram" },
    { id: "3", canal: "whatsapp" },
  ];
  const g = agruparPorCanal(filas, sinNadie);
  assert.equal(g.length, 2);
  const wa = g.find((x) => x.clave === "whatsapp")!;
  assert.equal(wa.leads.length, 2);
  assert.equal(wa.visual.nombre, "WhatsApp");
});

test("el canal que tiene a alguien esperando va antes que el que solo tiene volumen", () => {
  const filas: L[] = [
    ...Array.from({ length: 30 }, (_, i) => ({ id: `web${i}`, canal: "web", creado: haceHoras(100) })),
    { id: "ig1", canal: "instagram", creado: haceHoras(2) },
  ];
  const g = agruparPorCanal(filas, new Map([["ig1", haceHoras(2)]]));
  assert.equal(g[0].clave, "instagram", "Instagram tiene a alguien esperando: va primero");
  assert.equal(g[1].clave, "web");
});

test("entre canales con gente esperando, primero al que se le cierra antes la ventana", () => {
  const filas: L[] = [
    { id: "wa1", canal: "whatsapp", creado: haceHoras(3) },
    { id: "ig1", canal: "instagram", creado: haceHoras(20) },
  ];
  // El de Instagram escribió hace 20 h: le quedan 4. El de WhatsApp, 21.
  const g = agruparPorCanal(
    filas,
    new Map([
      ["wa1", haceHoras(3)],
      ["ig1", haceHoras(20)],
    ]),
  );
  assert.equal(g[0].clave, "instagram");
  assert.equal(g[1].clave, "whatsapp");
});

test("sin nadie esperando, los canales se ordenan por cantidad", () => {
  const filas: L[] = [
    { id: "a", canal: "correo" },
    { id: "b", canal: "cotizador" },
    { id: "c", canal: "cotizador" },
    { id: "d", canal: "cotizador" },
  ];
  const g = agruparPorCanal(filas, sinNadie);
  assert.equal(g[0].clave, "cotizador");
  assert.equal(g[1].clave, "correo");
});

test("dos canales del mismo tamaño no se turnan de lugar en cada refresco", () => {
  const filas: L[] = [
    { id: "a", canal: "correo" },
    { id: "b", canal: "chatbot" },
  ];
  const primero = agruparPorCanal(filas, sinNadie).map((x) => x.clave);
  const segundo = agruparPorCanal([...filas].reverse(), sinNadie).map((x) => x.clave);
  assert.deepEqual(primero, segundo, "el orden debe ser estable, no depender de cómo vino la lista");
});

test("dentro de un canal, quien espera respuesta va arriba aunque sea más nuevo", () => {
  const filas: L[] = [
    { id: "viejo", canal: "whatsapp", creado: haceHoras(50) },
    { id: "espera", canal: "whatsapp", creado: haceHoras(1) },
  ];
  const g = agruparPorCanal(filas, new Map([["espera", haceHoras(1)]]));
  assert.equal(g[0].leads[0].id, "espera");
});

test("entre los que esperan, el que lleva más rato queda arriba", () => {
  const filas: L[] = [
    { id: "reciente", canal: "whatsapp", creado: haceHoras(1) },
    { id: "antiguo", canal: "whatsapp", creado: haceHoras(2) },
  ];
  const g = agruparPorCanal(
    filas,
    new Map([
      ["reciente", haceHoras(1)],
      ["antiguo", haceHoras(18)],
    ]),
  );
  assert.deepEqual(
    g[0].leads.map((l) => l.id),
    ["antiguo", "reciente"],
  );
});

test("entre los que no esperan, lo último que entró va arriba", () => {
  const filas: L[] = [
    { id: "ayer", canal: "cotizador", creado: haceHoras(30) },
    { id: "recién", canal: "cotizador", creado: haceHoras(1) },
    { id: "semana", canal: "cotizador", creado: haceHoras(170) },
  ];
  const g = agruparPorCanal(filas, sinNadie);
  assert.deepEqual(
    g[0].leads.map((l) => l.id),
    ["recién", "ayer", "semana"],
  );
});

test("se cuenta cuántos esperan en cada canal, para el aviso de la cabecera", () => {
  const filas: L[] = [
    { id: "1", canal: "whatsapp" },
    { id: "2", canal: "whatsapp" },
    { id: "3", canal: "whatsapp" },
  ];
  const g = agruparPorCanal(
    filas,
    new Map([
      ["1", haceHoras(2)],
      ["2", haceHoras(5)],
    ]),
  );
  assert.equal(g[0].esperando, 2);
  assert.equal(g[0].leads.length, 3);
  assert.ok(g[0].masAntiguoEsperando, "tiene que saber desde cuándo espera el más antiguo");
});

test("en 'Para hoy' manda la hora del recordatorio, y lo vencido va arriba", () => {
  // Al revés que en la bandeja: acá el orden es ascendente, porque un
  // recordatorio que venció ayer urge más que uno de esta tarde.
  type R = L & { vence?: string };
  const filas: R[] = [
    { id: "tarde", canal: "whatsapp", creado: haceHoras(2), vence: haceHoras(-6) },
    { id: "vencido", canal: "whatsapp", creado: haceHoras(80), vence: haceHoras(20) },
    { id: "mediodia", canal: "whatsapp", creado: haceHoras(50), vence: haceHoras(1) },
  ];
  const g = agruparPorCanal(filas, sinNadie, { ascPor: (f) => f.vence });
  assert.deepEqual(
    g[0].leads.map((l) => l.id),
    ["vencido", "mediodia", "tarde"],
  );
});

test("con 'ascPor', quien espera respuesta sigue yendo antes que todos", () => {
  type R = L & { vence?: string };
  const filas: R[] = [
    { id: "vencido", canal: "whatsapp", vence: haceHoras(30) },
    { id: "escribio", canal: "whatsapp", vence: haceHoras(-2) },
  ];
  const g = agruparPorCanal(filas, new Map([["escribio", haceHoras(3)]]), { ascPor: (f) => f.vence });
  assert.equal(g[0].leads[0].id, "escribio", "una persona esperando manda sobre cualquier recordatorio");
});

test("un lead sin canal no se pierde: queda en su propio grupo visible", () => {
  const g = agruparPorCanal([{ id: "x" }, { id: "y", canal: null }], sinNadie);
  assert.equal(g.length, 1);
  assert.equal(g[0].leads.length, 2);
  assert.equal(g[0].visual.nombre, "Origen desconocido");
});

test("una lista vacía no devuelve grupos fantasma", () => {
  assert.deepEqual(agruparPorCanal([], sinNadie), []);
});

test("fechas inválidas no rompen el orden ni tumban la bandeja", () => {
  const filas: L[] = [
    { id: "malo", canal: "web", creado: "no es fecha" },
    { id: "bueno", canal: "web", creado: haceHoras(1) },
  ];
  const g = agruparPorCanal(filas, sinNadie);
  assert.equal(g[0].leads.length, 2);
  assert.equal(g[0].leads[0].id, "bueno", "el que tiene fecha válida va primero");
});
