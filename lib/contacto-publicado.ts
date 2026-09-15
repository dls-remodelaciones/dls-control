/**
 * Vigila que el sitio publique solo datos de contacto de la empresa.
 *
 * Existe por algo que pasó de verdad: la página de ingreso del panel mostraba
 * un correo personal como ejemplo, y los perfiles de Instagram tenían el
 * teléfono personal en vez del de la empresa. Ninguna de las dos cosas rompía
 * nada — el sistema seguía funcionando perfecto — así que nadie se habría dado
 * cuenta hasta que un cliente escribiera al lugar equivocado y ese mensaje no
 * llegara al panel. Un lead perdido sin ningún error a la vista.
 *
 * La revisión de las 8:00 lo mira todos los días. Que este archivo exista
 * significa que la auditoría de una noche no hay que repetirla nunca a mano.
 *
 * El criterio es a propósito estrecho: solo marca lo que **seguro** está mal, no
 * todo lo que podría estarlo. Un chequeo que grita por cosas correctas se
 * empieza a ignorar, y un chequeo ignorado es peor que ninguno.
 */

/**
 * Proveedores de correo personal. Un correo del negocio nunca vive acá.
 *
 * Se buscan estos en vez de "todo lo que no sea del dominio de la empresa"
 * porque el sitio está lleno de ejemplos inventados en los formularios
 * (`tucorreo@ejemplo.cl`, `nombre@correo.cl`) y marcarlos sería ruido.
 */
export const PROVEEDORES_PERSONALES = [
  "gmail.com",
  "hotmail.com",
  "hotmail.cl",
  "outlook.com",
  "outlook.cl",
  "yahoo.com",
  "yahoo.es",
  "icloud.com",
  "live.cl",
  "live.com",
];

const CORREOS = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/**
 * Móvil chileno: NUEVE dígitos que empiezan en 9, con o sin +56 delante.
 *
 * Mismo patrón que `lib/contacto-en-texto.ts`, y por la misma razón: el `9` va
 * separado de los dos grupos de cuatro. Escribirlo como `9\d{3}` + `\d{4}`
 * cuenta ocho dígitos y entonces no reconoce ningún número real — pasó, y los
 * dos tests que lo agarraron son los que están en este archivo.
 *
 * Los dos `(?<!\d)` y `(?!\d)` de los extremos son lo que evita que un trozo de
 * un identificador largo pase por teléfono. La portada tiene el id de la página
 * de Facebook (61593048545595) y el de WhatsApp Business (1064608879652326): sin
 * los bordes, la revisión diaria despertaría a Daniel a las 8:00 acusando un
 * número que no existe, y un chequeo que avisa en falso deja de creerse.
 */
const MOVILES = /(?<!\d)(?:\+?\s*56[\s.-]*)?(9)[\s.-]?(\d{4})[\s.-]?(\d{4})(?!\d)/g;

export interface ContactoPublicado {
  /** Correos de proveedores personales encontrados en la página. */
  correosPersonales: string[];
  /** Móviles chilenos que no son el de la empresa ni un ejemplo obvio. */
  telefonosAjenos: string[];
}

/**
 * ¿Es un número de relleno de un formulario de ejemplo?
 *
 * "+56 9 1234 5678" y "+56 9 0000 0000" están en el sitio como marcas de agua
 * de los campos. No son errores.
 */
function esDeEjemplo(digitos: string): boolean {
  // Se mira desde el segundo dígito: el primero siempre es el 9 del móvil, así
  // que "900000000" es ocho ceros y sí es relleno, aunque el número completo no
  // tenga todos los dígitos iguales.
  const cuerpo = digitos.slice(1);
  if (/^(\d)\1+$/.test(cuerpo)) return true;
  if (digitos.includes("1234") || digitos.includes("5678")) return true;
  return false;
}

/** Quita etiquetas y comentarios: un correo dentro de un comentario HTML no se publica. */
function soloVisibleYEnlaces(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
}

export function revisarContactoPublicado(
  html: string,
  opciones: { dominioOficial: string; telefonoOficial?: string },
): ContactoPublicado {
  const texto = soloVisibleYEnlaces(html || "");

  const correosPersonales = [
    ...new Set(
      (texto.match(CORREOS) ?? [])
        .map((c) => c.toLowerCase())
        .filter((c) => PROVEEDORES_PERSONALES.some((p) => c.endsWith(`@${p}`))),
    ),
  ];

  // El oficial, en dígitos y sin el 56, para comparar sin depender del formato.
  const oficial = (opciones.telefonoOficial ?? "").replace(/\D/g, "").replace(/^56/, "");

  const telefonosAjenos = [
    ...new Set(
      [...texto.matchAll(MOVILES)]
        .map((m) => `${m[1]}${m[2]}${m[3]}`)
        .filter((n) => n !== oficial && !esDeEjemplo(n)),
    ),
  ];

  return { correosPersonales, telefonosAjenos };
}

/** El texto que ve Daniel en la revisión diaria. */
export function resumirContactoPublicado(r: ContactoPublicado, dominioOficial: string): { ok: boolean; detalle: string } {
  const problemas: string[] = [];
  if (r.correosPersonales.length) {
    problemas.push(
      `hay ${r.correosPersonales.length === 1 ? "un correo personal publicado" : `${r.correosPersonales.length} correos personales publicados`}: ${r.correosPersonales.join(", ")}`,
    );
  }
  if (r.telefonosAjenos.length) {
    problemas.push(
      `aparece${r.telefonosAjenos.length === 1 ? "" : "n"} ${r.telefonosAjenos.map((n) => `+56 ${n}`).join(", ")}, que no es el número de la empresa`,
    );
  }
  if (!problemas.length) {
    return { ok: true, detalle: `Solo datos de la empresa (@${dominioOficial} y el número único).` };
  }
  return {
    ok: false,
    detalle: `En el sitio ${problemas.join(" y ")}. Un cliente que escriba ahí no entra al panel.`,
  };
}
