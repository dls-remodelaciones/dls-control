/**
 * Cosas que la revisión diaria mira sin que sean "fallas" del sistema.
 */

const DIA = 86_400_000;

/** Días seguidos sin que entre ningún lead, a partir de los cuales se avisa. */
export const DIAS_SILENCIO = 5;

/**
 * Silencio: si no entra ningún lead en varios días, casi nunca es que nadie
 * quiera remodelar — es que algo se rompió sin avisar (el formulario, un
 * dominio, una campaña que se pausó). Días sin leads, redondeado hacia abajo.
 */
export function diasSinLeads(ultimoCreado: string | null, ahora: Date): number | null {
  if (!ultimoCreado) return null;
  const t = Date.parse(ultimoCreado);
  return Number.isFinite(t) ? Math.floor((ahora.getTime() - t) / DIA) : null;
}

/** Horas desde que entró un lead A a partir de las cuales cuenta como "se está enfriando". */
export const HORAS_A_SIN_LLAMAR = 48;

/**
 * Leads A listos para llamar que nadie movió del estado inicial después de 48 h.
 * Un lead A es el más valioso que entra, y cada día que pasa sin llamada la
 * probabilidad de cerrarlo baja: si el aviso de "lead nuevo" se pasó por alto,
 * este es el segundo aviso.
 */
export function aSinLlamar<T extends { clasificacion: string | null; apto_para_llamar: boolean | null; estado: string | null; creado: string }>(
  leads: T[],
  ahora: Date,
): T[] {
  const limite = ahora.getTime() - HORAS_A_SIN_LLAMAR * 3_600_000;
  return leads.filter(
    (l) => l.clasificacion === "A" && l.apto_para_llamar && l.estado === "contacto_inicial" && Date.parse(l.creado) <= limite,
  );
}

/** Estado del nombre visible del número de WhatsApp según Meta. */
export interface EstadoNombre {
  nombre: string; // verified_name: lo que ven hoy los clientes
  estado: string; // name_status
  nuevo: string; // new_name_status: la revisión de un cambio pendiente
}

/**
 * ¿Cambió algo del nombre desde la última revisión? Devuelve el aviso a mandar,
 * o null. La primera vez solo se guarda la base, sin avisar.
 */
export function cambioDeNombre(previo: EstadoNombre | null, actual: EstadoNombre): { titulo: string; cuerpo: string } | null {
  if (!previo) return null;
  if (previo.nombre === actual.nombre && previo.estado === actual.estado && previo.nuevo === actual.nuevo) return null;

  if (previo.nombre !== actual.nombre) {
    return {
      titulo: "Meta aprobó el nombre de WhatsApp",
      cuerpo: `Tus clientes ahora ven "${actual.nombre}" (antes "${previo.nombre}").`,
    };
  }
  if (actual.nuevo === "DECLINED" || actual.estado === "DECLINED") {
    return {
      titulo: "Meta rechazó el nombre de WhatsApp",
      cuerpo: `Se sigue mostrando "${actual.nombre}". Hay que revisar el motivo en el administrador de WhatsApp.`,
    };
  }
  return {
    titulo: "Cambió el estado del nombre de WhatsApp",
    cuerpo: `Nombre visible: "${actual.nombre}" · estado: ${actual.estado || "—"} · cambio pendiente: ${actual.nuevo || "—"}.`,
  };
}
