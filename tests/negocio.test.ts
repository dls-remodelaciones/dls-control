import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  calificar,
  tierPresupuesto,
  normalizarTelefono,
  normalizarM2,
  normalizarTipo,
  normalizarPlazo,
  normalizarPropiedad,
  emailValido,
  zonaComuna,
  config,
  type Lead,
  type TipoProyecto,
} from "../lib/negocio";

/**
 * Pruebas del motor de calificación.
 *
 * Existen por un caso concreto: el 12 de septiembre de 2026 se descubrió que
 * `calificar()` devolvía **NaN** cuando el plazo no venía exactamente
 * normalizado. No restaba unos puntos — convertía el puntaje completo en NaN y
 * mandaba el lead a la clase D con todas sus señales buenas intactas. Estuvo
 * así desde el principio y se encontró de casualidad, mirando otra cosa.
 *
 * De ahí la forma de este archivo: más que comprobar que los casos bonitos dan
 * el número correcto, comprueba que **ninguna entrada rara rompe el puntaje**.
 * Un motor que se equivoca por poco es un problema; uno que devuelve NaN borra
 * el trabajo de captar ese lead.
 *
 * Se corre con:  npm test
 */

const base = (extra: Partial<Lead> = {}): Lead =>
  ({
    canal: "web",
    nombre: "Prueba",
    telefono: "56912345678",
    telefono_crudo: "+56912345678",
    email: "p@p.cl",
    tipo_proyecto: "cocina",
    comuna: "Providencia",
    superficie_m2: 16,
    rango_presupuesto: "$5.000.000 - $10.000.000",
    financiamiento: "",
    plazo: "inmediato",
    propiedad: "propia",
    fotos: [],
    termino_cotizador: false,
    ...extra,
  }) as Lead;

describe("el puntaje nunca se rompe", () => {
  // La regresión que motivó todo esto.
  const entradasRaras: [string, Partial<Lead>][] = [
    ["plazo en texto crudo", { plazo: "1 a 3 meses" }],
    ["plazo inventado", { plazo: "cuando se pueda" }],
    ["plazo vacío", { plazo: "" }],
    ["propiedad en texto crudo", { propiedad: "propietario" }],
    ["propiedad inventada", { propiedad: "herencia" }],
    ["propiedad vacía", { propiedad: "" }],
    ["tipo inexistente", { tipo_proyecto: "piscina" as TipoProyecto }],
    ["tipo vacío", { tipo_proyecto: "" as TipoProyecto }],
    ["superficie cero", { superficie_m2: 0 }],
    ["superficie absurda", { superficie_m2: 99999 }],
    ["presupuesto de otro tipo", { rango_presupuesto: "Menos de 1.500 UF" }],
    ["presupuesto inventado", { rango_presupuesto: "como mil pesos" }],
    ["comuna inexistente", { comuna: "Ciudad Gótica" }],
    ["todo vacío salvo el canal", {
      nombre: "", telefono: "", email: "", tipo_proyecto: "" as TipoProyecto,
      comuna: "", superficie_m2: 0, rango_presupuesto: "", plazo: "", propiedad: "",
    }],
  ];

  for (const [nombre, extra] of entradasRaras) {
    test(nombre, () => {
      const c = calificar(base(extra));
      assert.ok(Number.isFinite(c.score), `el puntaje salió ${c.score}`);
      assert.ok(c.score >= 0 && c.score <= 100, `puntaje fuera de rango: ${c.score}`);
      assert.ok(["A", "B", "C", "D"].includes(c.clasificacion));
      // Cada señal tiene que aportar un número, no undefined.
      for (const s of c.desglose) {
        assert.ok(Number.isFinite(s.puntos), `la señal "${s.senal}" dio ${s.puntos}`);
      }
    });
  }
});

describe("reglas duras", () => {
  test("sin teléfono válido no se puede llamar, por muy alto que puntúe", () => {
    const c = calificar(base({ telefono: "", termino_cotizador: true }));
    assert.equal(c.apto_para_llamar, false);
  });

  test("un teléfono mal escrito cuenta como no tener teléfono", () => {
    const c = calificar(base({ telefono: "123" }));
    assert.equal(c.apto_para_llamar, false);
  });

  test("fuera del radio de operación es D, aunque tenga todo lo demás", () => {
    const c = calificar(base({ comuna: "Rancagua", termino_cotizador: true }));
    assert.equal(c.clasificacion, "D");
  });

  test("con todo completo y presupuesto sobre el rango, es A y llamable", () => {
    const c = calificar(
      base({ comuna: "Las Condes", rango_presupuesto: "Más de $10.000.000", termino_cotizador: true }),
    );
    assert.equal(c.clasificacion, "A");
    assert.equal(c.apto_para_llamar, true);
  });
});

describe("tramos de presupuesto", () => {
  test("los tramos vigentes se reconocen, en los seis tipos", () => {
    for (const [tipo, v] of Object.entries(config().tipos)) {
      const esperado = ["bajo", "en_rango", "sobre"];
      v.rangos.forEach((etiqueta, i) => {
        assert.equal(
          tierPresupuesto(tipo as TipoProyecto, etiqueta),
          esperado[i],
          `${tipo}: "${etiqueta}" no se reconoció como ${esperado[i]}`,
        );
      });
    }
  });

  // Al recalcular los tramos el 12-09-2026, los leads guardados antes tenían el
  // texto viejo. Sin esta compatibilidad perdían los 30 puntos del presupuesto
  // y bajaban de clase sin que nadie tocara su ficha.
  const viejos: [string, string, string][] = [
    ["cocina", "$25.000.000 - $30.000.000", "en_rango"],
    ["cocina", "$15.000.000 - $25.000.000", "bajo"],
    ["quincho", "Más de $45.000.000", "sobre"],
    ["bano", "Menos de $5.000.000", "bajo"],
    ["estacionamiento", "$13.000.000 - $16.000.000", "en_rango"],
    ["walking_closet", "Más de $10.000.000", "sobre"],
    ["casa_completa", "≈2.000 UF", "en_rango"],
  ];
  for (const [tipo, etiqueta, esperado] of viejos) {
    test(`se sigue entendiendo el tramo antiguo de ${tipo}`, () => {
      assert.equal(tierPresupuesto(tipo as TipoProyecto, etiqueta), esperado);
    });
  }

  test("lo que no se reconoce es 'no_se', nunca un tramo inventado", () => {
    assert.equal(tierPresupuesto("cocina", "cualquier cosa"), "no_se");
    assert.equal(tierPresupuesto("cocina", ""), "no_se");
    assert.equal(tierPresupuesto("" as TipoProyecto, "Menos de $5.000.000"), "no_se");
  });
});

describe("normalizadores", () => {
  test("teléfonos chilenos en los formatos que escribe la gente", () => {
    for (const t of ["+56 9 1234 5678", "56912345678", "912345678", "9 1234 5678", "12345678"]) {
      assert.equal(normalizarTelefono(t), t === "12345678" ? "56912345678" : "56912345678", `falló con "${t}"`);
    }
  });

  test("lo que no es teléfono devuelve vacío", () => {
    for (const t of ["", "hola", "123", "56", null, undefined]) {
      assert.equal(normalizarTelefono(t), "");
    }
  });

  test("la superficie no se traga la unidad", () => {
    assert.equal(normalizarM2("18 m2"), 18);
    assert.equal(normalizarM2("18m²"), 18);
    assert.equal(normalizarM2("18 metros cuadrados"), 18);
    assert.equal(normalizarM2("no sé"), 0);
  });

  test("'propietario' y 'propietaria' son casa propia", () => {
    assert.equal(normalizarPropiedad("propietario"), "propia");
    assert.equal(normalizarPropiedad("propietaria"), "propia");
    assert.equal(normalizarPropiedad("soy el dueño"), "propia");
    assert.equal(normalizarPropiedad("arrendada"), "arriendo");
    assert.equal(normalizarPropiedad("la estoy comprando"), "por_comprar");
  });

  test("el plazo entiende lenguaje suelto", () => {
    assert.equal(normalizarPlazo("lo antes posible, es urgente"), "inmediato");
    assert.equal(normalizarPlazo("en 3 meses"), "1-3_meses");
    assert.equal(normalizarPlazo("solo estoy averiguando"), "explorando");
    assert.equal(normalizarPlazo("marciano"), "");
  });

  test("el tipo de proyecto tolera mayúsculas y acentos", () => {
    assert.equal(normalizarTipo("COCINA"), "cocina");
    assert.equal(normalizarTipo("Baño"), "bano");
    assert.equal(normalizarTipo("walking closet"), "walking_closet");
  });

  test("correos", () => {
    assert.equal(emailValido("a@b.cl"), true);
    assert.equal(emailValido("a@b"), false);
    assert.equal(emailValido("sin arroba"), false);
  });

  test("las comunas se clasifican por zona", () => {
    assert.equal(zonaComuna("Las Condes"), "principal");
    assert.equal(zonaComuna("SANTIAGO"), "secundaria");
    assert.equal(zonaComuna("Rancagua"), "fuera_radio");
    assert.equal(zonaComuna(""), "sin_dato");
  });
});

describe("coherencia interna de la configuración", () => {
  test("cada tipo tiene exactamente tres tramos, y distintos entre sí", () => {
    for (const [tipo, v] of Object.entries(config().tipos)) {
      assert.equal(v.rangos.length, 3, `${tipo} no tiene 3 tramos`);
      assert.equal(new Set(v.rangos).size, 3, `${tipo} tiene tramos repetidos`);
    }
  });

  test("los pesos de las señales suman 100", () => {
    const suma = Object.values(config().pesos).reduce((a, b) => a + b, 0);
    assert.equal(suma, 100);
  });

  test("ninguna señal puede dar más puntos que su peso", () => {
    const { pesos, puntos } = config();
    assert.ok(Math.max(...Object.values(puntos.presupuesto)) <= pesos.presupuesto);
    assert.ok(Math.max(...Object.values(puntos.plazo)) <= pesos.plazo);
    assert.ok(Math.max(...Object.values(puntos.comuna)) <= pesos.comuna);
    assert.ok(Math.max(...Object.values(puntos.propiedad)) <= pesos.propiedad);
  });

  test("los umbrales van de mayor a menor", () => {
    const u = config().umbrales;
    assert.ok(u.A > u.B && u.B > u.C, `umbrales incoherentes: ${JSON.stringify(u)}`);
  });
});
