"use client";

import { useEffect, useState } from "react";
import { config } from "@/lib/negocio";
import type { Tab } from "./tipos";

/** Piezas de presentación de la pantalla de inicio: marco, vacíos y avisos. */

export function Marco({ children, alAnotar }: { children: React.ReactNode; alAnotar?: () => void }) {
  return (
    <div className="mx-auto max-w-[560px]">
      <header
        className="sticky top-0 z-20 border-b"
        style={{ background: "var(--color-bg)", borderColor: "var(--color-line)" }}
      >
        <div className="flex h-14 items-center justify-between px-4">
          <span className="text-base font-semibold tracking-[-0.02em]">
            DLS{" "}
            <span className="font-light" style={{ color: "var(--color-muted)" }}>
              Control
            </span>
          </span>
          {/* Anotar a mano a quien llego por telefono, Instagram o recomendado:
              antes esa persona no entraba a ninguna parte. */}
          {alAnotar && (
            <button
              onClick={alAnotar}
              className="cursor-pointer border px-2.5 py-1.5 text-[12.5px] font-medium"
              style={{ borderColor: "var(--color-line)" }}
            >
              + Anotar lead
            </button>
          )}
        </div>
      </header>
      {children}
    </div>
  );
}

export function Vacia({ tab, enNutricion }: { tab: Tab; enNutricion: number }) {
  const marco = {
    borderColor: "var(--color-line)",
    background: "var(--color-surface)",
  };
  if (tab === "hoy") {
    return (
      <div className="border border-dashed px-5 py-8 text-center" style={marco}>
        <h2 className="text-[15px] font-semibold">Nadie califica para llamar hoy</h2>
        <p className="mt-2 text-[13px]" style={{ color: "var(--color-muted)" }}>
          No es un error: es que ningún lead llegó a {config().umbrales.A} puntos con teléfono válido.
        </p>
        <ul className="mt-3 space-y-1.5 text-left text-[13px]" style={{ color: "var(--color-muted)" }}>
          {enNutricion > 0 && <li>· Tienes {enNutricion} en nutrición a pocos puntos de A.</li>}
          <li>· Publica una obra terminada con el link del embudo en la bio.</li>
          <li>· Reactiva por WhatsApp a los que quedaron en “explorando”.</li>
        </ul>
      </div>
    );
  }
  return (
    <div className="border border-dashed px-5 py-8 text-center" style={marco}>
      <h2 className="text-[15px] font-semibold">
        {tab === "pipeline" ? "Nada en el pipeline todavía" : "Sin leads todavía"}
      </h2>
      <p className="mt-2 text-[13px]" style={{ color: "var(--color-muted)" }}>
        {tab === "pipeline"
          ? "Cuando muevas un lead a contactado o visita, aparece acá."
          : "Los leads del cotizador, el chatbot y el correo aparecen aquí solos."}
      </p>
    </div>
  );
}

/**
 * Franja de "sin conexión". En una obra con mala señal el panel seguía mostrando
 * la lista de hace una hora como si fuera la de ahora, y un mensaje enviado
 * fallaba sin que se entendiera por qué.
 */
export function SinConexion() {
  const [enLinea, setEnLinea] = useState(true);
  useEffect(() => {
    const actualizar = () => setEnLinea(navigator.onLine);
    actualizar();
    window.addEventListener("online", actualizar);
    window.addEventListener("offline", actualizar);
    return () => {
      window.removeEventListener("online", actualizar);
      window.removeEventListener("offline", actualizar);
    };
  }, []);
  if (enLinea) return null;
  return (
    <div className="border-b px-4 py-2 text-[12.5px] font-medium" style={{ background: "var(--color-warm)", borderColor: "var(--color-line)" }} role="status">
      Sin conexión: lo que ves puede estar desactualizado y los mensajes no van a salir hasta que vuelva la señal.
    </div>
  );
}

export function Aviso({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <div
      className="mx-4 my-4 border px-3.5 py-3 text-[13px]"
      style={{
        borderColor: "var(--color-a)",
        background: "color-mix(in srgb, var(--color-a) 10%, transparent)",
      }}
    >
      <b className="font-semibold">{titulo}</b>
      <p className="mt-1" style={{ color: "var(--color-muted)" }}>
        {detalle}
      </p>
    </div>
  );
}
