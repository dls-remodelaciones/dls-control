import { test } from "node:test";
import assert from "node:assert/strict";
import { resumirSemana, contarPendientesA, avancesSemana, type FilaLead } from "../lib/resumen";

const lead = (canal: string, clasificacion: string, extra: Partial<FilaLead> = {}): FilaLead => ({
  canal,
  clasificacion,
  estado: "contacto_inicial",
  apto_para_llamar: clasificacion === "A",
  creado: "2026-09-10T12:00:00Z",
  ...extra,
});

test("cuenta clases, canales y compara con la semana anterior", () => {
  const semana = [lead("cotizador", "A"), lead("cotizador", "B"), lead("whatsapp", "C")];
  const r = resumirSemana(semana, [lead("chatbot", "B")], 1);
  assert.equal(r.titulo, "3 leads nuevos esta semana (+2 vs. la semana anterior)");
  assert.match(r.cuerpo, /A 1 · B 1 · C 1 · D 0/);
  assert.match(r.cuerpo, /Llegaron por: 2 cotizador, 1 WhatsApp/);
  assert.match(r.cuerpo, /1 lead A sigue sin llamar/);
});

test("una semana sin leads después de una con leads pide revisar el sitio", () => {
  const r = resumirSemana([], [lead("chatbot", "B"), lead("web", "C")], 0);
  assert.equal(r.titulo, "Semana sin leads nuevos");
  assert.match(r.cuerpo, /La semana anterior entraron 2/);
  assert.match(r.cuerpo, /No hay leads A esperando llamada/);
});

test("singular y sin tendencia cuando es igual", () => {
  const r = resumirSemana([lead("manual", "A")], [lead("web", "D")], 2);
  assert.equal(r.titulo, "1 lead nuevo esta semana (igual que la semana anterior)");
  assert.match(r.cuerpo, /1 anotados a mano/);
  assert.match(r.cuerpo, /2 leads A siguen sin llamar/);
});

test("pendientes A: solo los aptos que siguen en contacto inicial", () => {
  const todos = [
    lead("web", "A"),
    lead("web", "A", { estado: "visita_terreno" }),
    lead("web", "A", { apto_para_llamar: false }),
    lead("web", "B"),
  ];
  assert.equal(contarPendientesA(todos), 1);
});

test("embudo: cuenta los avances a visita, presupuesto y cierre de la semana", () => {
  const cambio = (de: string, a: string) => ({ antes: { estado: de }, despues: { estado: a } });
  const av = avancesSemana([
    cambio("contacto_inicial", "visita_terreno"),
    cambio("visita_terreno", "presupuesto_enviado"),
    cambio("presupuesto_enviado", "cerrado"),
    cambio("cerrado", "cerrado"), // editar sin cambiar estado no cuenta
  ]);
  assert.deepEqual(av, { visitas: 1, presupuestos: 1, cierres: 1 });
  const r = resumirSemana([lead("web", "A")], [], 0, av);
  assert.match(r.cuerpo, /Avanzaron: 1 visita, 1 presupuesto, 1 cierre\./);
  assert.doesNotMatch(resumirSemana([lead("web", "A")], [], 0).cuerpo, /Avanzaron/);
});

test("motivos de no prosperó, del más frecuente al menos", async () => {
  const { motivosSemana } = await import("../lib/resumen");
  assert.equal(
    motivosSemana([{ motivo_no_prospero: "Precio / presupuesto" }, { motivo_no_prospero: "Precio / presupuesto" }, { motivo_no_prospero: null }]),
    "No prosperaron 3: 2 precio / presupuesto, 1 sin motivo anotado.",
  );
  assert.equal(motivosSemana([]), "");
});

test("tiempo de respuesta: mediana de la primera respuesta a cada mensaje del cliente", async () => {
  const { tiempoRespuesta, textoTiempo } = await import("../lib/resumen");
  const m = (lead_id: string, direccion: string, hhmm: string) => ({ lead_id, direccion, creado: `2026-09-14T${hhmm}:00Z` });
  const t = tiempoRespuesta([
    m("a", "entrante", "10:00"), m("a", "entrante", "10:05"), m("a", "saliente", "10:20"), // 20 min
    m("b", "entrante", "11:00"), m("b", "saliente", "13:00"), // 120 min
    m("c", "entrante", "12:00"), m("c", "saliente", "12:10"), // 10 min
    m("d", "entrante", "15:00"), // sin respuesta todavía: no cuenta
  ]);
  assert.deepEqual(t, { mediana: 20, conversaciones: 3 });
  assert.equal(textoTiempo(t), "Respondiste los WhatsApp en 20 min (mediana de 3 respuestas).");
  assert.equal(tiempoRespuesta([m("x", "entrante", "10:00")]), null);
});
