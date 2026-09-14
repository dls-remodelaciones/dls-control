"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { telHref, waHref, config } from "@/lib/negocio";
import { comoResponder } from "@/lib/canales";
import Conversacion from "./conversacion";
import FichaDetalle from "./ficha";
import { CLASE_COLOR, type Fila } from "./tipos";

/**
 * La tarjeta de un lead en la lista: quién es, qué pidió, y las tres acciones
 * que se pueden hacer sin abrir nada más (llamar, WhatsApp, ver ficha).
 *
 * Vive aparte de la pantalla de inicio porque es la pieza más grande de todas y
 * la que más cambia: mezclada con la carga de datos, cualquier retoque visual
 * obligaba a leer 800 líneas para encontrar dónde tocar.
 */

/** "hace 3 h", "hace 12 min". Para decir cuánto lleva esperando una respuesta. */
export function hace(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}

export default function Ficha({
  f,
  esperaDesde,
  recargar,
  enfocado = false,
}: {
  f: Fila;
  esperaDesde?: string;
  recargar: () => void;
  /** Viene de un aviso del celular: se lleva a la vista y se abre. */
  enfocado?: boolean;
}) {
  // La conversación se carga solo cuando se abre: son decenas de fichas en
  // pantalla y no tiene sentido pedirle a la base el historial de todas.
  // Si está esperando respuesta, se abre sola: para eso está ahí.
  const [conversando, setConversando] = useState(Boolean(esperaDesde) || (enfocado && Boolean(f.telefono)));
  const [viendoFicha, setViendoFicha] = useState(enfocado && !f.telefono);
  const tarjeta = useRef<HTMLLIElement>(null);
  // Cambios escritos en la ficha y no guardados: cerrarla sin querer los perdía.
  const fichaSucia = useRef(false);
  const marcarSucia = useCallback((s: boolean) => {
    fichaSucia.current = s;
  }, []);
  function alternarFicha() {
    if (viendoFicha && fichaSucia.current && !window.confirm("Tienes cambios sin guardar en la ficha. ¿Cerrarla igual y perderlos?")) return;
    if (viendoFicha) fichaSucia.current = false;
    setViendoFicha((v) => !v);
  }
  useEffect(() => {
    if (enfocado) tarjeta.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [enfocado]);

  /**
   * Tocar "Llamar" deja rastro en la actividad del lead. Así el aviso de "leads
   * A sin llamar" no insiste con alguien a quien ya se llamó, y el historial de
   * la ficha muestra cuándo. No espera la respuesta: la llamada sale igual.
   */
  function registrarLlamada() {
    void supabase?.from("actividad").insert({ lead_id: f.id, tipo: "llamada", quien: "panel" }).then(({ error }) => {
      if (error) console.warn("No se pudo registrar la llamada:", error.message);
    });
  }
  const tipo = f.tipo_proyecto ? config().tipos[f.tipo_proyecto]?.label : "";
  const sub = [tipo, f.superficie_m2 ? `${f.superficie_m2} m²` : "", f.rango_presupuesto]
    .filter(Boolean)
    .join(" · ");
  // El proyecto principal ya se muestra arriba; estos son los demas que pidio.
  const otros = (f.proyectos ?? []).filter(
    (p) => !(p.tipo === f.tipo_proyecto && p.comuna === f.comuna && p.m2 === f.superficie_m2),
  );
  const color = CLASE_COLOR[f.clasificacion] ?? "var(--color-c)";
  // Sin teléfono, pero escribió por una red donde sí se le puede contestar.
  const responder = f.telefono ? null : comoResponder(f.canal);

  return (
    <li
      ref={tarjeta}
      className="scroll-mt-20 border"
      style={{
        background: "var(--color-surface)",
        borderColor: "var(--color-line)",
        borderLeft: `3px solid ${color}`,
        boxShadow: enfocado ? "0 0 0 2px var(--color-brand)" : undefined,
      }}
    >
      <div className="flex items-start gap-2.5 px-3.5 py-3">
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold tracking-[-0.01em] break-words">
            {f.nombre}
            {f.comuna && (
              <span className="font-light" style={{ color: "var(--color-muted)" }}>
                {" · "}
                {f.comuna}
              </span>
            )}
          </div>
          {sub && (
            <div className="mt-0.5 text-[12.5px] break-words" style={{ color: "var(--color-muted)" }}>
              {sub}
            </div>
          )}
          {/* Una persona puede pedir varias cosas. Arriba va la principal — la de
              mayor presupuesto — y aquí las demás, para no llamar a medias. */}
          {otros.length > 0 && (
            <div className="mt-1.5 text-[12px]" style={{ color: "var(--color-muted)" }}>
              <span style={{ color: "var(--color-b)" }}>
                También pidió {otros.length === 1 ? "otro proyecto" : `otros ${otros.length} proyectos`}:
              </span>{" "}
              {otros
                .map((p) =>
                  [
                    p.tipo ? config().tipos[p.tipo as keyof ReturnType<typeof config>["tipos"]]?.label ?? p.tipo : "",
                    p.m2 ? `${p.m2} m²` : "",
                    p.comuna,
                  ]
                    .filter(Boolean)
                    .join(" "),
                )
                .join(" · ")}
            </div>
          )}
        </div>
        <div className="shrink-0 text-right">
          <span
            className="tabular rounded-[2px] px-1.5 py-0.5 text-[12px] font-bold"
            style={{ fontFamily: "var(--font-space-mono)", color }}
          >
            {f.clasificacion} {f.score}
          </span>
          {esperaDesde ? (
            <div className="mt-0.5 pr-1.5 text-[11px]" style={{ color: "var(--color-a)" }}>
              {hace(esperaDesde)}
            </div>
          ) : (
            // Antigüedad: un A de hace 5 días no es lo mismo que uno de hace una hora.
            f.creado && (
              <div className="mt-0.5 pr-1.5 text-[11px]" style={{ color: "var(--color-muted)" }}>
                entró {hace(f.creado)}
              </div>
            )
          )}
          {f.fecha_proxima_accion && (
            <div className="mt-0.5 pr-1.5 text-[11px]" style={{ color: "var(--color-b)" }}>
              {new Date(f.fecha_proxima_accion).toLocaleString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
            </div>
          )}
        </div>
      </div>

      {/* Máximo 3 acciones. Todo lo demás, detrás de Ver ficha. */}
      <div className="flex border-t" style={{ borderColor: "var(--color-linesoft)" }}>
        {f.telefono ? (
          <a
            href={telHref(f)}
            onClick={registrarLlamada}
            className="flex-1 border-r py-2.5 text-center text-[12.5px] font-medium"
            style={{ borderColor: "var(--color-linesoft)" }}
          >
            Llamar
          </a>
        ) : responder ? (
          // Escribió por Instagram o Messenger y no dejó teléfono: la
          // conversación existe, pero en la aplicación de Meta. Se lleva allá
          // en vez de dejar un botón muerto.
          <a
            href={responder.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 border-r py-2.5 text-center text-[12.5px] font-medium"
            style={{ borderColor: "var(--color-linesoft)" }}
          >
            {responder.texto}
          </a>
        ) : (
          <span
            className="flex-1 border-r py-2.5 text-center text-[12.5px]"
            style={{ borderColor: "var(--color-linesoft)", color: "var(--color-muted)" }}
          >
            Sin teléfono
          </span>
        )}
        {f.telefono && (
          <button
            onClick={() => setConversando((v) => !v)}
            className="flex-1 cursor-pointer border-r py-2.5 text-center text-[12.5px] font-medium"
            style={{
              borderColor: "var(--color-linesoft)",
              color: conversando ? "var(--color-a)" : undefined,
            }}
          >
            {conversando ? "Cerrar chat" : "WhatsApp"}
          </button>
        )}
        <button
          onClick={alternarFicha}
          className="flex-1 cursor-pointer py-2.5 text-center text-[12.5px] font-medium"
          style={{ color: viendoFicha ? "var(--color-a)" : undefined }}
        >
          {viendoFicha ? "Cerrar ficha" : "Ver ficha"}
        </button>
      </div>

      {conversando && f.telefono && (
        <Conversacion
          leadId={f.id}
          telefono={f.telefono}
          alternativa={waHref(f)}
          esperando={Boolean(esperaDesde)}
          alAtender={() => {
            setConversando(false);
            recargar();
          }}
        />
      )}

      {viendoFicha && <FichaDetalle f={f} alGuardar={recargar} alCambiar={marcarSucia} />}
    </li>
  );
}
