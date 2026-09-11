import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Código de la app anterior, guardado sólo como referencia: no se compila
    // ni se despliega. Revisarlo con las reglas de hoy sólo genera ruido —
    // eran 7 de los 9 errores que salían al correr eslint (2026-09-11).
    "_legacy/**",
  ]),
]);

export default eslintConfig;
