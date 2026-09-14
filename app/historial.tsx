"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { CAMPOS_HISTORIAL } from "@/lib/edicion";
import { config, type TipoProyecto } from "@/lib/negocio";

/**
 * Historial de un lead: ediciones, cambios de puntaje, llamadas, WhatsApp que no
 * llegaron y recuperaciones.
 *
 * La tabla `actividad` se llenaba desde el principio y no se mostraba en ninguna
 * parte: para saber cuándo se llamó a alguien o por qué cambió de clase había
 * que entrar a la base. Se carga solo al abrirlo.
 */

type Actividad = {
  id: string;
  tipo: string;
  antes: Record<string, unknown> | null;
  despues: Record<string, unknown> | null;
  quien: string | null;
  creado: string;
};

const ESTADO: Record<string, string> = {
  contacto_inicial: "contacto inicial",
  cotizador_web: "cotizó en la web",
  visita_terreno: "visita a terreno",
  presupuesto_enviado: "presupuesto enviado",
  cerrado: "cerrado",
  no_prospero: "no prosperó",
};

function valorLegible(campo: string, v: unknown): string {
  if (v == null || v === "") return "vacío";
  if (campo === "fecha_proxima_accion") {
    const t = new Date(String(v));
    return Number.isNaN(t.getTime())
      ? String(v)
      : t.toLocaleString("es-CL", { timeZone: "America/Santiago", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  }
  if (campo === "tipo_proyecto") return config().tipos[v as TipoProyecto]?.label ?? String(v);
  if (campo === "superficie_m2") return `${v} m²`;
  return String(v);
}

export function describir(a: Pick<Actividad, "tipo" | "antes" | "despues">): string {
  const antes = a.antes ?? {};
  const despues = a.despues ?? {};
  const puntaje = () =>
    antes.score !== undefined && (antes.score !== despues.score || antes.clasificacion !== despues.clasificacion)
      ? ` · ${antes.clasificacion} ${antes.score} → ${despues.clasificacion} ${despues.score}`
      : "";
  switch (a.tipo) {
    case "llamada":
      return "Llamada desde el panel";
    case "edicion": {
      const estado =
        antes.estado !== despues.estado && despues.estado
          ? ` · estado: ${ESTADO[String(antes.estado)] ?? antes.estado} → ${ESTADO[String(despues.estado)] ?? despues.estado}`
          : "";
      // Qué datos cambiaron (se registra desde el 14-sep-2026; las ediciones anteriores no lo traen).
      const datos = Object.entries(CAMPOS_HISTORIAL)
        .filter(([k]) => k in despues)
        .map(([k, etiqueta]) =>
          k === "nota_interna"
            ? "nota actualizada"
            : `${etiqueta}: ${valorLegible(k, antes[k])} → ${valorLegible(k, despues[k])}`,
        );
      return `Ficha editada${estado}${datos.length ? ` · ${datos.join(" · ")}` : ""}${puntaje()}`;
    }
    case "wa_atendido":
      return "WhatsApp marcado como atendido";
    case "score":
      return antes.score === undefined
        ? `Entró como ${despues.clasificacion} ${despues.score}`
        : `Nuevo envío${puntaje() || " · sin cambio de puntaje"}`;
    case "whatsapp_no_entregado":
      return `WhatsApp no entregado · ${despues.motivo ?? "sin motivo"}`;
    case "recuperacion":
      return `Datos recuperados del historial${despues.fuente_original ? " · fuente original" : ""}${despues.score !== undefined ? ` · puntaje ${antes.score} → ${despues.score}` : ""}`;
    default:
      return a.tipo;
  }
}

export default function Historial({ leadId }: { leadId: string }) {
  const [abierto, setAbierto] = useState(false);
  const [items, setItems] = useState<Actividad[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto || items || !supabase) return;
    void supabase
      .from("actividad")
      .select("id, tipo, antes, despues, quien, creado")
      .eq("lead_id", leadId)
      .order("creado", { ascending: false })
      .limit(40)
      .then(({ data, error: e }) => {
        if (e) setError(e.message);
        else setItems((data ?? []) as Actividad[]);
      });
  }, [abierto, items, leadId]);

  return (
    <div className="mt-3 border-t pt-2.5" style={{ borderColor: "var(--color-linesoft)" }}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="cursor-pointer text-[12px] underline underline-offset-2"
        style={{ color: "var(--color-muted)" }}
      >
        {abierto ? "Ocultar historial" : "Ver historial"}
      </button>
      {abierto && error && (
        <p className="mt-1.5 text-[12px]" style={{ color: "var(--color-c)" }}>
          No se pudo leer el historial: {error}
        </p>
      )}
      {abierto && !error && !items && (
        <p className="mt-1.5 text-[12px]" style={{ color: "var(--color-muted)" }}>
          Cargando…
        </p>
      )}
      {abierto && items && (
        <ul className="mt-1.5 space-y-1">
          {items.length === 0 && (
            <li className="text-[12px]" style={{ color: "var(--color-muted)" }}>
              Todavía no hay actividad.
            </li>
          )}
          {items.map((a) => (
            <li key={a.id} className="flex gap-2 text-[12px] leading-snug">
              <span className="tabular shrink-0" style={{ color: "var(--color-muted)", fontFamily: "var(--font-space-mono)" }}>
                {new Date(a.creado).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </span>
              <span>{describir(a)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
