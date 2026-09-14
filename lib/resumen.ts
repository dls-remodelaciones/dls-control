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
