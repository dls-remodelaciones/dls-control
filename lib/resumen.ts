/**
 * Resumen semanal de leads, para el aviso de los lunes.
 *
 * Existe porque el panel muestra el día a día, pero no la tendencia: si esta
 * semana entraron la mitad de leads que la anterior, o si los A se están
 * quedando sin llamar, no hay ninguna pantalla que lo diga.
 *
 * Función pura: recibe las filas y devuelve el texto. La ruta solo consulta y avisa.
 */

export interface FilaLead {
  canal: string | null;
  clasificacion: string | null;
  estado: string | null;
  apto_para_llamar: boolean | null;
  creado: string;
}

const NOMBRE_CANAL: Record<string, string> = {
  cotizador: "cotizador",
  chatbot: "chatbot",
  web: "formulario",
  whatsapp: "WhatsApp",
  manual: "anotados a mano",
  instagram: "Instagram",
  correo: "correo",
};

/** Cambios de estado registrados al editar fichas (actividad tipo "edicion"). */
export interface CambioEstado {
  antes: { estado?: string } | null;
  despues: { estado?: string } | null;
}

/**
 * Embudo de la semana: cuántos leads avanzaron a visita, presupuesto o cierre.
 * Contar leads nuevos dice si llega gente; esto dice si se está convirtiendo.
 */
export function avancesSemana(cambios: CambioEstado[]): { visitas: number; presupuestos: number; cierres: number } {
  const a = { visitas: 0, presupuestos: 0, cierres: 0 };
  for (const c of cambios) {
    const de = c.antes?.estado;
    const a_ = c.despues?.estado;
    if (!a_ || de === a_) continue;
    if (a_ === "visita_terreno") a.visitas++;
    if (a_ === "presupuesto_enviado") a.presupuestos++;
    if (a_ === "cerrado") a.cierres++;
  }
  return a;
}

export function resumirSemana(
  semana: FilaLead[],
  anterior: FilaLead[],
  pendientesA: number,
  avances: { visitas: number; presupuestos: number; cierres: number } = { visitas: 0, presupuestos: 0, cierres: 0 },
): { titulo: string; cuerpo: string } {
  const n = semana.length;
  const clases = { A: 0, B: 0, C: 0, D: 0 } as Record<string, number>;
  const canales = new Map<string, number>();
  for (const l of semana) {
    if (l.clasificacion && l.clasificacion in clases) clases[l.clasificacion]++;
    const c = NOMBRE_CANAL[l.canal ?? ""] ?? l.canal ?? "otro";
    canales.set(c, (canales.get(c) ?? 0) + 1);
  }

  const diferencia = n - anterior.length;
  const tendencia =
    anterior.length === 0 && n === 0
      ? ""
      : diferencia === 0
        ? " (igual que la semana anterior)"
        : ` (${diferencia > 0 ? "+" : ""}${diferencia} vs. la semana anterior)`;

  const titulo = n === 0 ? "Semana sin leads nuevos" : `${n} ${n === 1 ? "lead nuevo" : "leads nuevos"} esta semana${tendencia}`;

  const partes: string[] = [];
  if (n > 0) {
    partes.push(`A ${clases.A} · B ${clases.B} · C ${clases.C} · D ${clases.D}.`);
    const origen = [...canales.entries()].sort((a, b) => b[1] - a[1]).map(([c, k]) => `${k} ${c}`);
    partes.push(`Llegaron por: ${origen.join(", ")}.`);
  } else if (anterior.length > 0) {
    partes.push(`La semana anterior entraron ${anterior.length}. Revisa que el sitio y WhatsApp estén funcionando.`);
  }
  partes.push(
    pendientesA === 0
      ? "No hay leads A esperando llamada."
      : `${pendientesA} ${pendientesA === 1 ? "lead A sigue" : "leads A siguen"} sin llamar.`,
  );

  if (avances.visitas || avances.presupuestos || avances.cierres) {
    const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
    partes.push(
      `Avanzaron: ${plural(avances.visitas, "visita", "visitas")}, ${plural(avances.presupuestos, "presupuesto", "presupuestos")}, ${plural(avances.cierres, "cierre", "cierres")}.`,
    );
  }

  return { titulo, cuerpo: partes.join(" ") };
}

/** Leads A listos para llamar que nadie ha movido del estado inicial. */
export function contarPendientesA(todos: FilaLead[]): number {
  return todos.filter((l) => l.clasificacion === "A" && l.apto_para_llamar && l.estado === "contacto_inicial").length;
}

/**
 * Por qué no prosperaron los leads que se cerraron así esta semana. Si la mayoría
 * dice "precio", el problema no es la cantidad de leads.
 */
export function motivosSemana(filas: { motivo_no_prospero: string | null }[]): string {
  if (!filas.length) return "";
  const conteo = new Map<string, number>();
  for (const f of filas) {
    const m = (f.motivo_no_prospero || "sin motivo anotado").toLowerCase();
    conteo.set(m, (conteo.get(m) ?? 0) + 1);
  }
  const partes = [...conteo.entries()].sort((a, b) => b[1] - a[1]).map(([m, n]) => `${n} ${m}`);
  return `No prosperaron ${filas.length}: ${partes.join(", ")}.`;
}

export interface MensajeTiempo {
  lead_id: string | null;
  direccion: string;
  creado: string;
}

/**
 * Cuánto tardó la primera respuesta a cada mensaje del cliente (mediana, en
 * minutos). En WhatsApp la velocidad vende: quien responde en minutos se queda
 * con el cliente que le escribió a tres empresas a la vez.
 */
export function tiempoRespuesta(mensajes: MensajeTiempo[]): { mediana: number; conversaciones: number } | null {
  const porLead = new Map<string, MensajeTiempo[]>();
  for (const m of mensajes) {
    if (!m.lead_id) continue;
    if (!porLead.has(m.lead_id)) porLead.set(m.lead_id, []);
    porLead.get(m.lead_id)!.push(m);
  }
  const demoras: number[] = [];
  for (const lista of porLead.values()) {
    lista.sort((a, b) => Date.parse(a.creado) - Date.parse(b.creado));
    let esperandoDesde: number | null = null;
    for (const m of lista) {
      if (m.direccion === "entrante" && esperandoDesde === null) esperandoDesde = Date.parse(m.creado);
      if (m.direccion === "saliente" && esperandoDesde !== null) {
        demoras.push((Date.parse(m.creado) - esperandoDesde) / 60_000);
        esperandoDesde = null;
      }
    }
  }
  if (!demoras.length) return null;
  demoras.sort((a, b) => a - b);
  const medio = Math.floor(demoras.length / 2);
  const mediana = demoras.length % 2 ? demoras[medio] : (demoras[medio - 1] + demoras[medio]) / 2;
  return { mediana: Math.round(mediana), conversaciones: demoras.length };
}

export function textoTiempo(t: { mediana: number; conversaciones: number } | null): string {
  if (!t) return "";
  const cuanto = t.mediana < 60 ? `${t.mediana} min` : t.mediana < 48 * 60 ? `${Math.round(t.mediana / 60)} h` : `${Math.round(t.mediana / 1440)} días`;
  return `Respondiste los WhatsApp en ${cuanto} (mediana de ${t.conversaciones} ${t.conversaciones === 1 ? "respuesta" : "respuestas"}).`;
}
