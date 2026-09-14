import { test } from "node:test";
import assert from "node:assert/strict";
import { avisar, type Enviador } from "../lib/avisos";
import { dbFalsa } from "./db-falsa";

/**
 * Los avisos al celular son lo único que hace que Daniel se entere de un lead
 * cuando el panel está cerrado, y un WhatsApp tiene 24 horas para responderse.
 *
 * La regla que manda: **un aviso que falla nunca rompe lo que lo disparó.** Si
 * el push no sale, el lead ya quedó registrado igual.
 *
 * Lo otro que se cuida acá es la limpieza de dispositivos muertos: un celular
 * que desinstaló el panel responde 410 para siempre, y sin borrarlo se
 * reintentaría en cada aviso hasta el fin de los tiempos.
 */

const suscripcion = (id: string) => ({ id, endpoint: `https://push.ejemplo/${id}`, p256dh: "clave", auth: "auth" });
const AVISO = { titulo: "Lead nuevo", cuerpo: "Ana quiere cotizar una cocina", url: "/?lead=1", tag: "lead-1" };

/** Un enviador que siempre acepta. */
const acepta: Enviador = async () => undefined;

/** Un enviador que falla con el código que responde el servicio de push. */
const fallaCon = (statusCode: number): Enviador => async () => {
  throw Object.assign(new Error("push rechazado"), { statusCode });
};

test("sin base de datos no se intenta avisar", async () => {
  const r = await avisar(AVISO, null, acepta);
  assert.deepEqual(r, { enviados: 0, fallidos: 0, error: "sin_base_de_datos" });
});

test("sin ningún dispositivo suscrito no falla, simplemente no envía", async () => {
  const { db } = dbFalsa();
  assert.deepEqual(await avisar(AVISO, db, acepta), { enviados: 0, fallidos: 0 });
});

test("el aviso sale a todos los dispositivos suscritos", async () => {
  const { db, tablas } = dbFalsa();
  tablas.push_subs = [suscripcion("a"), suscripcion("b"), suscripcion("c")];
  assert.deepEqual(await avisar(AVISO, db, acepta), { enviados: 3, fallidos: 0 });
  assert.equal(tablas.push_subs.length, 3, "no se borra ninguno");
});

test("un dispositivo que desinstaló el panel (410) se borra para no reintentar siempre", async () => {
  const { db, tablas } = dbFalsa();
  tablas.push_subs = [suscripcion("muerto")];
  const r = await avisar(AVISO, db, fallaCon(410));
  assert.deepEqual(r, { enviados: 0, fallidos: 1 });
  assert.equal(tablas.push_subs.length, 0, "el suscriptor muerto se borra");
});

test("un 404 también se considera dispositivo muerto", async () => {
  const { db, tablas } = dbFalsa();
  tablas.push_subs = [suscripcion("muerto")];
  await avisar(AVISO, db, fallaCon(404));
  assert.equal(tablas.push_subs.length, 0);
});

test("un fallo pasajero (500) NO borra el dispositivo: puede volver", async () => {
  const { db, tablas } = dbFalsa();
  tablas.push_subs = [suscripcion("vivo")];
  const r = await avisar(AVISO, db, fallaCon(500));
  assert.deepEqual(r, { enviados: 0, fallidos: 1 });
  assert.equal(tablas.push_subs.length, 1, "un error temporal no debe perder la suscripción");
});

test("con un dispositivo muerto y otro vivo, solo se borra el muerto", async () => {
  const { db, tablas } = dbFalsa();
  tablas.push_subs = [suscripcion("vivo"), suscripcion("muerto")];
  const enviar: Enviador = async (destino) => {
    if (destino.endpoint.endsWith("muerto")) throw Object.assign(new Error("ido"), { statusCode: 410 });
  };
  const r = await avisar(AVISO, db, enviar);
  assert.deepEqual(r, { enviados: 1, fallidos: 1 });
  assert.deepEqual(
    tablas.push_subs.map((s) => s.id),
    ["vivo"],
  );
});

test("el aviso se recorta para que quepa en la pantalla del celular", async () => {
  const { db, tablas } = dbFalsa();
  tablas.push_subs = [suscripcion("a")];
  let carga = "";
  await avisar({ titulo: "T".repeat(200), cuerpo: "C".repeat(500) }, db, async (_d, c) => {
    carga = c;
  });
  const enviado = JSON.parse(carga) as { titulo: string; cuerpo: string; url: string };
  assert.equal(enviado.titulo.length, 80);
  assert.equal(enviado.cuerpo.length, 180);
  assert.equal(enviado.url, "/", "sin url explícita, el toque lleva al inicio");
});

test("un error inesperado se traga: el lead ya está guardado y no se puede perder por un aviso", async () => {
  const { db, tablas } = dbFalsa();
  tablas.push_subs = [suscripcion("a")];
  const r = await avisar(AVISO, db, async () => {
    throw new Error("algo muy raro");
  });
  assert.equal(r.fallidos, 1);
  assert.equal(r.enviados, 0);
});
