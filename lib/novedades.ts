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

/**
 * Días que puede estar un presupuesto enviado sin que nadie lo mueva.
 *
 * Siete: una semana es el plazo en que una decisión de remodelación se enfría
 * sola. Antes de eso, insistir molesta; después, el cliente ya pidió otro
 * presupuesto.
 */
export const DIAS_PRESUPUESTO_DORMIDO = 7;

/**
 * Presupuestos enviados que llevan una semana sin movimiento.
 *
 * Es el dinero más cercano que hay en el panel y nadie lo vigilaba: el aviso
 * diario miraba solo los leads A sin llamar —los del principio del embudo— y el
 * pipeline mostraba el presupuesto ahí parado sin decir desde cuándo. Un
 * presupuesto de tres semanas sin seguimiento no es un cliente lento: es una
 * venta que se está perdiendo en silencio, después de haber hecho todo el
 * trabajo de cotizarla.
 *
 * Se mide por `ultima_actividad` y no por `creado`: lo que importa es cuánto
 * lleva quieto, no cuándo entró. Si alguien lo editó, llamó o le escribió ayer,
 * no está dormido.
 */
export function presupuestosDormidos<T extends { estado: string | null; ultima_actividad?: string | null; creado: string }>(
  leads: T[],
  ahora: Date,
  dias = DIAS_PRESUPUESTO_DORMIDO,
): T[] {
  const limite = ahora.getTime() - dias * 86_400_000;
  return leads
    .filter((l) => {
      if (l.estado !== "presupuesto_enviado") return false;
      const t = Date.parse(l.ultima_actividad || l.creado);
      return Number.isFinite(t) && t <= limite;
    })
    .sort((a, b) => {
      // El que lleva más tiempo quieto, primero: es el que está más frío.
      const ta = Date.parse(a.ultima_actividad || a.creado);
      const tb = Date.parse(b.ultima_actividad || b.creado);
      return ta - tb;
    });
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
