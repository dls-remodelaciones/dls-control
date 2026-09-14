"use client";

import { useEffect, useState } from "react";
import { supabase, configurado } from "@/lib/supabase";

/**
 * Ingreso por correo, sin contraseña que recordar ni que se pueda filtrar:
 * Daniel pone su correo y recibe un enlace y un código; cualquiera de los dos
 * lo deja dentro.
 *
 * Quién puede entrar no lo decide esta pantalla. Hay tres capas: los registros
 * nuevos apagados en Supabase, `shouldCreateUser: false` acá, y — la que de
 * verdad protege los datos — la lista de correos del panel en la base
 * (`es_del_panel()`, migración 007) y en las rutas (`lib/sesion.ts`).
 * OJO: hasta el 13-sep-2026 este comentario decía que los registros estaban
 * apagados y no lo estaban. Verificarlo en Supabase, no creerle al comentario.
 */

/**
 * Largo del código del correo. Es el "Email OTP length" de Supabase (Auth →
 * Providers → Email), verificado el 14-sep-2026: 8 dígitos. Si se cambia allá,
 * cambiarlo acá.
 */
const LARGO_CODIGO = 8;

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
  const [codigo, setCodigo] = useState("");
  const [verificando, setVerificando] = useState(false);

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
      // shouldCreateUser: false — pedir un código nunca crea una cuenta nueva.
      options: { emailRedirectTo: window.location.origin, shouldCreateUser: false },
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

  /**
   * Ingreso con el código del mismo correo. Existe por el panel instalado en el
   * iPhone: iOS abre los enlaces del correo en Safari y nunca dentro de la app
   * instalada, así que con solo el enlace la sesión quedaba en el lugar
   * equivocado — y sin sesión ahí no hay avisos al celular.
   */
  async function verificar(e: React.FormEvent) {
    e.preventDefault();
    await verificarCodigo(codigo);
  }

  async function verificarCodigo(valor: string) {
    if (!supabase || valor.length < 6 || verificando) return;
    setVerificando(true);
    setDetalle("");
    const { error } = await supabase.auth.verifyOtp({
      email: correo.trim().toLowerCase(),
      token: valor,
      type: "email",
    });
    if (error) {
      setVerificando(false);
      const m = error.message.toLowerCase();
      setDetalle(
        m.includes("expired") || m.includes("invalid")
          ? "Ese código no sirve: está mal escrito o ya venció. Revisa el último correo que llegó."
          : enCristiano(error.message),
      );
      return;
    }
    window.location.href = "/";
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
            Te mandamos un correo a <b>{correo}</b> con un enlace y un código. Abre el enlace, o escribe el
            código acá abajo.
          </p>
          <form onSubmit={verificar} className="mt-3 flex gap-2">
            <input
              aria-label="Código del correo"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={LARGO_CODIGO}
              autoFocus
              value={codigo}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, LARGO_CODIGO);
                setCodigo(v);
                // Al completar el código (o pegarlo entero) entra solo: un toque menos en el celular.
                if (v.length === LARGO_CODIGO) void verificarCodigo(v);
              }}
              placeholder={`Código de ${LARGO_CODIGO} dígitos`}
              className="min-w-0 flex-1 border px-3 py-2.5 text-[16px] tracking-[0.2em]"
              style={{ background: "var(--color-bg)", borderColor: "var(--color-line)", color: "var(--color-ink)" }}
            />
            <button
              type="submit"
              disabled={codigo.length < 6 || verificando}
              className="shrink-0 cursor-pointer px-4 text-[14px] font-medium disabled:cursor-default disabled:opacity-50"
              style={{ background: "var(--color-ink)", color: "var(--color-bg)" }}
            >
              {verificando ? "Entrando…" : "Entrar"}
            </button>
          </form>
          {detalle && (
            <p className="mt-2 text-[13px]" style={{ color: "var(--color-a)" }}>
              {detalle}
            </p>
          )}
          <p className="mt-2 text-[12.5px]" style={{ color: "var(--color-muted)" }}>
            Con el panel instalado en el iPhone usa el código: el enlace se abre en el navegador, no en el
            panel. Si no llega, mira en spam.
          </p>
          <button
            onClick={() => {
              setEstado("listo");
              setDetalle("");
              setCodigo("");
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
