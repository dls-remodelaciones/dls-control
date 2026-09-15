"use client";

import { useState } from "react";
import type { GrupoCanal } from "@/lib/agrupar-canal";
import Canal from "./canal";
import Ficha from "./ficha-tarjeta";
import type { Fila } from "./tipos";

/**
 * La bandeja partida en secciones, una por canal.
 *
 * Cada sección se puede cerrar: con veinticuatro cotizaciones del sitio y tres
 * Instagram esperando, lo que hay que poder hacer es doblar el bulto y quedarse
 * con lo que importa. El orden de las secciones y de las tarjetas lo decide
 * `lib/agrupar-canal.ts`; acá solo se dibuja.
 *
 * El cierre no se guarda entre visitas a propósito: leerlo del navegador al
 * primer render hace que el servidor y el cliente pinten cosas distintas, y ese
 * parpadeo cuesta más de lo que vale recordar una sección doblada.
 */

export default function BandejaCanales({
  grupos,
  sinResponder,
  recargar,
  enfoque,
}: {
  grupos: GrupoCanal<Fila>[];
  sinResponder: Map<string, string>;
  recargar: () => void;
  enfoque?: string | null;
}) {
  const [cerrados, setCerrados] = useState<Record<string, boolean>>({});

  return (
    <div className="space-y-5">
      {grupos.map((g) => {
        const cerrado = Boolean(cerrados[g.clave]);
        return (
          <section key={g.clave}>
            <button
              onClick={() => setCerrados((c) => ({ ...c, [g.clave]: !cerrado }))}
              aria-expanded={!cerrado}
              className="flex w-full cursor-pointer items-center gap-2 border-b py-2 text-left"
              style={{ borderColor: "var(--color-line)" }}
            >
              {/* El ícono del canal, más grande que en la tarjeta: es el rótulo
                  de la sección y tiene que reconocerse antes de leer. */}
              <span style={{ color: g.visual.color }} className="flex shrink-0 items-center">
                <Marca clave={g.clave} color={g.visual.color} />
              </span>
              <span className="text-[13.5px] font-semibold tracking-[-0.01em]" style={{ color: g.visual.color }}>
                {g.visual.nombre}
              </span>
              <span className="tabular-nums text-[12px]" style={{ color: "var(--color-muted)" }}>
                {g.leads.length}
              </span>
              {g.esperando > 0 && (
                <span
                  className="tabular-nums rounded-[2px] px-1.5 py-0.5 text-[10.5px] font-bold tracking-[0.04em] uppercase"
                  style={{ background: "var(--color-a)", color: "var(--color-surface)" }}
                >
                  {g.esperando} esperando
                </span>
              )}
              <span
                className="ml-auto shrink-0 text-[11px] font-medium"
                style={{ color: "var(--color-muted)" }}
                aria-hidden
              >
                {cerrado ? "Mostrar" : "Ocultar"}
              </span>
            </button>

            {!cerrado && (
              <ul className="mt-2.5 space-y-2.5">
                {g.leads.map((f) => (
                  <Ficha
                    key={f.id}
                    f={f}
                    esperaDesde={sinResponder.get(f.id)}
                    recargar={recargar}
                    enfocado={f.id === enfoque}
                  />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

/**
 * El mismo ícono de la tarjeta, más grande.
 *
 * Reusa la insignia en modo "solo ícono" en vez de redibujarla: dos copias del
 * mismo SVG se desincronizan al primer retoque.
 */
function Marca({ clave, color }: { clave: string; color: string }) {
  return (
    <span style={{ color, transform: "scale(1.3)", transformOrigin: "left center", display: "inline-flex" }}>
      <Canal canal={clave} solo />
    </span>
  );
}
