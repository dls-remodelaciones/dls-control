/**
 * Base de datos en memoria con la forma exacta del cliente de Supabase que usa
 * `registrarLead`: `.from().select().or().limit()`, `.update().eq()`,
 * `.insert()` y `.insert().select().single()`.
 *
 * El filtro `.or()` se interpreta como lo hace PostgREST: condiciones separadas
 * por comas, salvo las comas dentro de comillas dobles. Ese detalle no es
 * decorativo — es justo lo que permite probar que un valor enviado desde el
 * sitio no puede colar condiciones propias en la búsqueda.
 */

type Fila = Record<string, unknown>;

/** Parte `a.eq.1,b.eq."x,y"` en condiciones, respetando comillas y escapes. */
function partir(filtro: string): string[] {
  const partes: string[] = [];
  let actual = "";
  let enComillas = false;
  for (let i = 0; i < filtro.length; i++) {
    const c = filtro[i];
    if (c === "\\" && enComillas) {
      actual += c + (filtro[i + 1] ?? "");
      i++;
      continue;
    }
    if (c === '"') enComillas = !enComillas;
    if (c === "," && !enComillas) {
      partes.push(actual);
      actual = "";
      continue;
    }
    actual += c;
  }
  partes.push(actual);
  return partes;
}

function valor(crudo: string): string {
  if (crudo.startsWith('"') && crudo.endsWith('"')) {
    return crudo.slice(1, -1).replace(/\\(.)/g, "$1");
  }
  return crudo;
}

/** Evalúa una condición. Operador desconocido → error, como PostgREST. */
function cumple(fila: Fila, cond: string): boolean {
  const m = cond.match(/^([a-z_]+)\.(eq|neq)\.([\s\S]*)$/);
  if (!m) throw new Error(`condición no soportada: ${cond}`);
  const [, col, op, crudo] = m;
  const v = String(fila[col] ?? "");
  const esperado = valor(crudo);
  return op === "eq" ? v === esperado : v !== esperado;
}

export function dbFalsa(leadsIniciales: Fila[] = []) {
  const tablas: Record<string, Fila[]> = {
    leads: leadsIniciales.map((f) => structuredClone(f)),
    mensajes: [],
    actividad: [],
    cotizaciones: [],
  };
  let n = 0;

  const from = (tabla: string) => {
    const filas = (tablas[tabla] ??= []);
    return {
      select: () => ({
        eq: (col: string, val: unknown) => ({
          limit: async (k: number) => ({ data: filas.filter((f) => f[col] === val).slice(0, k), error: null }),
        }),
        or: (filtro: string) => ({
          limit: async (k: number) => {
            try {
              const conds = partir(filtro);
              return { data: filas.filter((f) => conds.some((c) => cumple(f, c))).slice(0, k), error: null };
            } catch (e) {
              return { data: null, error: { message: (e as Error).message } };
            }
          },
        }),
      }),
      update: (cambios: Fila) => ({
        eq: async (col: string, val: unknown) => {
          for (const f of filas) if (f[col] === val) Object.assign(f, structuredClone(cambios));
          return { error: null };
        },
      }),
      insert: (fila: Fila) => {
        const nueva = { id: `id-${++n}`, ...structuredClone(fila) };
        filas.push(nueva);
        return Object.assign(Promise.resolve({ error: null }), {
          select: () => ({ single: async () => ({ data: nueva, error: null }) }),
        });
      },
    };
  };

  return { db: { from } as never, tablas };
}
