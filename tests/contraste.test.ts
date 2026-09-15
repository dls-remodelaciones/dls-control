import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  contraste,
  luminancia,
  peorContraste,
  sirveParaTextoChico,
  FONDOS_PANEL,
  MINIMO_TEXTO_CHICO,
  MINIMO_TEXTO_GRANDE,
} from "../lib/contraste";

/**
 * Esta prueba lee `app/globals.css` de verdad y mide la paleta real. No prueba
 * una copia de los colores: si alguien aclara un tono en el CSS, esto se pone
 * rojo. Es la única red que existe contra el texto ilegible — ni los tipos ni
 * las pruebas de comportamiento lo ven, porque el panel funciona perfecto con
 * texto que no se puede leer en el celular.
 */

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

/** Lee un `--color-x: #rrggbb;` del CSS real. */
function delCss(nombre: string): string {
  const m = css.match(new RegExp(`--color-${nombre}:\\s*(#[0-9a-fA-F]{6})`));
  assert.ok(m, `no se encontró --color-${nombre} en globals.css`);
  return m![1];
}

/* ── la fórmula ─────────────────────────────────────────────────────────── */

test("negro sobre blanco da el máximo, y un color contra sí mismo da 1", () => {
  assert.equal(Math.round(contraste("#000000", "#ffffff")), 21);
  assert.equal(contraste("#b8895a", "#b8895a"), 1);
});

test("el orden de los colores no cambia el resultado", () => {
  assert.equal(contraste("#1d1c21", "#fbf9f5"), contraste("#fbf9f5", "#1d1c21"));
});

test("la luminancia va de 0 a 1", () => {
  assert.equal(luminancia("#000000"), 0);
  assert.equal(luminancia("#ffffff"), 1);
});

test("un color mal escrito se rechaza en vez de dar un número inventado", () => {
  for (const malo of ["", "#fff", "azul", "#12345g"]) {
    assert.throws(() => luminancia(malo), /color inválido/, `debió rechazar "${malo}"`);
  }
});

/* ── la paleta real del panel ───────────────────────────────────────────── */

test("los fondos del panel son los que dice el CSS", () => {
  assert.equal(delCss("bg"), FONDOS_PANEL.bg);
  assert.equal(delCss("surface"), FONDOS_PANEL.surface);
  assert.equal(delCss("warm"), FONDOS_PANEL.warm);
});

test("el texto principal y el secundario se leen sobre los tres fondos", () => {
  for (const nombre of ["ink", "muted"]) {
    const color = delCss(nombre);
    const peor = peorContraste(color);
    assert.ok(
      peor >= MINIMO_TEXTO_CHICO,
      `--color-${nombre} (${color}) se queda en ${peor.toFixed(2)}, y el mínimo para texto chico es ${MINIMO_TEXTO_CHICO}`,
    );
  }
});

test("las señales que se usan en texto chico cumplen el mínimo", () => {
  // El ámbar y el gris de "dormido" tienen variante propia para texto justamente
  // porque los originales no llegaban: 2,28 y 2,63 sobre el beige.
  for (const nombre of ["a", "ok", "b-texto", "c-texto"]) {
    const color = delCss(nombre);
    const peor = peorContraste(color);
    assert.ok(
      peor >= MINIMO_TEXTO_CHICO,
      `--color-${nombre} (${color}) se queda en ${peor.toFixed(2)}, mínimo ${MINIMO_TEXTO_CHICO}`,
    );
  }
});

test("el rojo y el verde sirven para cualquier texto, incluidas las cifras", () => {
  for (const nombre of ["a", "ok"]) {
    const color = delCss(nombre);
    const peor = peorContraste(color);
    assert.ok(
      peor >= MINIMO_TEXTO_GRANDE,
      `--color-${nombre} (${color}) da ${peor.toFixed(2)} y no alcanza ni para texto grande (${MINIMO_TEXTO_GRANDE})`,
    );
  }
});

test("el ámbar y el gris de marca NO sirven para texto, ni grande", () => {
  /**
   * Esto no es una queja: es la razón de que existan las variantes `-texto`.
   * `--color-b` da 2,28 sobre el beige y `--color-c` 2,63, así que no alcanzan
   * ni el 3 del texto grande. Sirven para bordes, insignias y fondos, donde el
   * contraste no decide si algo se puede leer.
   *
   * Si alguien los oscurece lo suficiente como para que esta prueba falle, la
   * buena noticia es que ya sirven para texto y se pueden unificar con sus
   * variantes. Ese día hay que borrar esta prueba, no maquillarla.
   */
  for (const nombre of ["b", "c"]) {
    const peor = peorContraste(delCss(nombre));
    assert.ok(
      peor < MINIMO_TEXTO_GRANDE,
      `--color-${nombre} ya llega a ${peor.toFixed(2)}: sirve para texto y sobran las variantes -texto`,
    );
  }
});

test("la variante de texto es más oscura que el tono de marca, no otra cosa", () => {
  // Si alguien cambia el ámbar de marca, la variante de texto debe seguirlo:
  // son el mismo color, uno más oscuro. Que no terminen siendo dos colores
  // distintos con el mismo nombre.
  for (const [marca, texto] of [["b", "b-texto"], ["c", "c-texto"]]) {
    assert.ok(
      luminancia(delCss(texto)) < luminancia(delCss(marca)),
      `--color-${texto} debería ser más oscuro que --color-${marca}`,
    );
  }
});

test("el ayudante de texto chico coincide con la medición", () => {
  assert.equal(sirveParaTextoChico("#b8895a"), false, "el ámbar de marca no sirve para texto chico");
  assert.equal(sirveParaTextoChico(delCss("b-texto")), true);
});
