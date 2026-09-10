"use client";

import { useState } from "react";
import { supabase, configurado } from "@/lib/supabase";

/**
 * Ingreso por magic link. Sin contraseña que recordar ni que se pueda filtrar:
 * Daniel pone su correo, recibe un enlace y con eso queda dentro.
 *
 * Quién puede entrar no lo decide esta pantalla: lo decide Supabase, que tiene
 * los registros nuevos deshabilitados. Si un correo no está dado de alta, pide
 * el enlace y simplemente no le llega nada.
 */
export default function Login() {
  const [correo, setCorreo] = useState("");
  const [estado, setEstado] = useState<"listo" | "enviando" | "enviado" | "error">("listo");
  const [detalle, setDetalle] = useState("");

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setEstado("enviando");
    const { error } = await supabase.auth.signInWithOtp({
      email: correo.trim().toLowerCase(),
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) {
      setEstado("error");
      setDetalle(error.message);
    } else {
      setEstado("enviado");
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-[420px] flex-col justify-center px-6">
      <div className="mb-8">
        <div className="text-xl font-semibold tracking-[-0.02em]">
          DLS{" "}
          <span className="font-light" style={{ color: "var(--color-muted)" }}>
            Control
          </span>
        </div>
        <p className="mt-2 text-[13px]" style={{ color: "var(--color-muted)" }}>
          Tus leads, calificados y listos para llamar.
        </p>
      </div>

      {!configurado ? (
        <p className="text-[13px]" style={{ color: "var(--color-a)" }}>
          Falta conectar la base de datos.
        </p>
      ) : estado === "enviado" ? (
        <div
          className="border px-4 py-4 text-[14px]"
          style={{ background: "var(--color-surface)", borderColor: "var(--color-line)" }}
        >
          <b className="font-semibold">Revisa tu correo.</b>
          <p className="mt-1.5" style={{ color: "var(--color-muted)" }}>
            Te mandamos un enlace a <b>{correo}</b>. Ábrelo desde este mismo teléfono y quedas
            dentro — no hay contraseña que recordar.
          </p>
          <button
            onClick={() => setEstado("listo")}
            className="mt-3 cursor-pointer text-[13px] underline"
            style={{ color: "var(--color-muted)" }}
          >
            Usar otro correo
          </button>
        </div>
      ) : (
        <form onSubmit={enviar} className="flex flex-col gap-3">
          <label htmlFor="correo" className="text-[13px]" style={{ color: "var(--color-muted)" }}>
            Tu correo
          </label>
          <input
            id="correo"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            placeholder="dls.lehmann@gmail.com"
            className="border px-3.5 py-3 text-[15px]"
            style={{
              background: "var(--color-surface)",
              borderColor: "var(--color-line)",
              color: "var(--color-ink)",
            }}
          />
          <button
            type="submit"
            disabled={estado === "enviando"}
            className="cursor-pointer px-4 py-3 text-[14px] font-medium disabled:opacity-50"
            style={{ background: "var(--color-ink)", color: "var(--color-bg)" }}
          >
            {estado === "enviando" ? "Enviando…" : "Enviar enlace de ingreso"}
          </button>
          {estado === "error" && (
            <p className="text-[13px]" style={{ color: "var(--color-a)" }}>
              {detalle}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
