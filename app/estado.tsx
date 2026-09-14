"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * "Estado del sistema": los mismos chequeos de la revisión diaria, a pedido.
 *
 * La revisión de cada mañana solo avisa cuando algo falla. Esto es para cuando
 * Daniel quiere confirmarlo él — antes de una campaña, o si un cliente dice que
 * el cotizador no le funcionó. Mirar no manda avisos.
 */

type Chequeo = { nombre: string; ok: boolean; detalle: string };

export default function Estado() {
  const [abierto, setAbierto] = useState(false);
  const [chequeos, setChequeos] = useState<Chequeo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revisando, setRevisando] = useState(false);

  async function revisar() {
    setAbierto(true);
    setRevisando(true);
    setError(null);
    try {
      const jwt = supabase ? (await supabase.auth.getSession()).data.session?.access_token : "";
      const r = await fetch("/api/salud", { headers: { Authorization: `Bearer ${jwt}` } });
      const j = await r.json();
      if (!Array.isArray(j.chequeos)) throw new Error(j.detalle ?? j.error ?? "Respuesta inesperada");
      setChequeos(j.chequeos);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo revisar.");
    } finally {
      setRevisando(false);
    }
  }

  const fallas = chequeos?.filter((c) => !c.ok).length ?? 0;

  return (
    <section className="mt-8 mb-4 border-t pt-4" style={{ borderColor: "var(--color-line)" }}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[11px] font-semibold tracking-[0.12em] uppercase" style={{ color: "var(--color-muted)" }}>
          Estado del sistema
        </h2>
        <button
          onClick={() => (abierto && !revisando ? setAbierto(false) : void revisar())}
          disabled={revisando}
          className="cursor-pointer text-[12.5px] underline underline-offset-2 disabled:opacity-50"
          style={{ color: "var(--color-muted)" }}
        >
          {revisando ? "Revisando…" : abierto ? "Ocultar" : "Revisar ahora"}
        </button>
      </div>

      {abierto && !revisando && error && (
        <p className="mt-2 text-[13px]" style={{ color: "var(--color-a)" }}>
          {error}
        </p>
      )}

      {abierto && !revisando && chequeos && (
        <>
          <p className="mt-2 text-[13px] font-medium" style={{ color: fallas ? "var(--color-a)" : "var(--color-ink)" }}>
            {fallas === 0 ? `Todo funciona (${chequeos.length} chequeos).` : `${fallas} de ${chequeos.length} chequeos con problemas.`}
          </p>
          <ul className="mt-2 space-y-1.5">
            {[...chequeos]
              .sort((a, b) => Number(a.ok) - Number(b.ok))
              .map((c) => (
                <li key={c.nombre} className="text-[12.5px] leading-snug">
                  <span className="font-semibold" style={{ color: c.ok ? "var(--color-ink)" : "var(--color-a)" }}>
                    {c.ok ? "✓" : "✕"} {c.nombre}
                  </span>
                  <span style={{ color: "var(--color-muted)" }}> — {c.detalle}</span>
                </li>
              ))}
          </ul>
        </>
      )}
    </section>
  );
}
