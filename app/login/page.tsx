"use client";

import { useEffect, useState } from "react";
import { supabase, configurado } from "@/lib/supabase";

/**
 * Ingreso por magic link. Sin contraseña que recordar ni que se pueda filtrar:
 * Daniel pone su correo, recibe un enlace y con eso queda dentro.
 *
 * Quién puede entrar no lo decide esta pantalla: lo decide Supabase, que tiene
 * los registros nuevos deshabilitados. Si un correo no está dado de alta, pide
 * el enlace y simplemente no le llega nada.
 */

/** Supabase limita cuántos enlaces se piden seguidos. Este es el plazo habitual. */
const ESPERA_SEGUNDOS = 20;

/**
 * Los errores de Supabase llegan en inglés y con jerga. Quien los lee está
 * parado en la puerta sin poder entrar, casi siempre desde el celular: lo menos
 * que merece es saber qué pasó y qué hacer.
 */
function enCristiano(mensaje: string): string {
  const m = mensaje.toLowerCase();
  const segundos = mensaje.match(/after (\d+) seconds?/i)?.[1];
  if (m.includes("security purposes") || m.includes("rate limit") || m.includes("too many")) {
    return segundos
      ? `Pediste el enlace hace muy poco. Espera ${segundos} segundos y vuelve a intentar — con una sola vez basta.`
      : "Pediste el enlace hace muy poco. Espera unos segundos y vuelve a intentar.";
  }
  if (m.includes("invalid") && m.includes("email")) return "Ese correo no parece válido. Revísalo.";
  if (m.includes("signups not allowed") || m.includes("not authorized")) {
    return "Ese correo no tiene acceso al panel.";
  }
  if (m.includes("failed to fetch") || m.includes("network")) {
    return "No hay conexión con el servidor. Revisa tu señal y reintenta.";
  }
  return mensaje;
}

export default function Login() {
  const [correo, setCorreo] = useState("");
  const [estado, setEstado] = useState<"listo" | "enviando" | "enviado" | "error">("listo");
  const [detalle, setDetalle] = useState("");
  /** Segundos que faltan para poder pedir otro enlace. 0 = se puede. */
  const [espera, setEspera] = useState(0);

  // Cuenta regresiva visible. Es la mitad del arreglo: sin ella el botón queda
  // disponible, se aprieta de nuevo por impaciencia y Supabase bloquea el
  // segundo intento — que es exactamente cómo se llega a ese error.
  useEffect(() => {
    if (espera <= 0) return;
    const t = setInterval(() => setEspera((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [espera]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || espera > 0) return;
    setEstado("enviando");
    const { error } = await supabase.auth.signInWithOtp({
      email: correo.trim().toLowerCase(),
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) {
      setEstado("error");
      setDetalle(enCristiano(error.message));
      const s = Number(error.message.match(/after (\d+) seconds?/i)?.[1]);
      setEspera(Number.isFinite(s) && s > 0 ? s : ESPERA_SEGUNDOS);
    } else {
      setEstado("enviado");
      setEspera(ESPERA_SEGUNDOS);
    }
  }

  const bloqueado = estado === "enviando" || espera > 0;

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
          <p className="mt-1.5" style={{ color: "var(--color-muted)" }}>
            Puede tardar un minuto. Si no llega, mira en spam antes de volver a pedirlo.
          </p>
          <button
            onClick={() => {
              setEstado("listo");
              setDetalle("");
            }}
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
            disabled={bloqueado}
            className="cursor-pointer px-4 py-3 text-[14px] font-medium disabled:cursor-default disabled:opacity-50"
            style={{ background: "var(--color-ink)", color: "var(--color-bg)" }}
          >
            {estado === "enviando"
              ? "Enviando…"
              : espera > 0
                ? `Espera ${espera} s`
                : "Enviar enlace de ingreso"}
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
