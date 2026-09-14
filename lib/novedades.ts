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
