import { test } from "node:test";
import assert from "node:assert/strict";
import { nombreArchivo, ultimoRespaldo } from "../lib/respaldo";

test("nombre del archivo por fecha", () => {
  assert.equal(nombreArchivo(new Date("2026-09-20T06:00:00Z")), "datos-2026-09-20.json");
});

test("encuentra el respaldo más reciente e ignora archivos ajenos", () => {
  assert.equal(
    ultimoRespaldo(["datos-2026-09-13.json", "datos-2026-09-20.json", "otra-cosa.txt", ".emptyFolderPlaceholder"]),
    "2026-09-20",
  );
  assert.equal(ultimoRespaldo([]), null);
});
