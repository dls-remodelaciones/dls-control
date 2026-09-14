"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { pedirJson } from "@/lib/pedir";
import { ventanaAbierta } from "@/lib/ventana";

/**
 * Contestar un DM de Instagram o Messenger sin salir de la ficha del lead.
 *
 * Antes la única salida era un enlace a la bandeja de la aplicación: había que
 * salir del panel, buscar la conversación entre todas y volver. Acá se escribe
 * y se manda, y la respuesta queda guardada en el historial del lead.
 *
 * Meta solo deja responder dentro de las 24 horas siguientes al último mensaje
 * de la persona. Pasado ese plazo el servidor lo rechaza y lo dice con todas sus
 * letras, en vez de dejar creer que el mensaje salió.
 */

export default function ResponderDM({
  leadId,
  canal,
  esperaDesde,
  alEnviar,
}: {
  leadId: string;
  /** "Instagram" o "Messenger", para hablarle a Daniel de lo que ve. */
  canal: string;
  /** Último mensaje de la persona, para saber si la ventana sigue abierta. */
  esperaDesde?: string;
  alEnviar: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  // Se sabe acá y no recién al enviar: escribir una respuesta completa para que
  // después aparezca que Meta ya no la acepta es la peor forma de enterarse.
  // Sin fecha del último mensaje no se asume nada; el servidor valida igual.
  const ventana = esperaDesde ? ventanaAbierta(esperaDesde) : null;
  const cerrada = ventana !== null && !ventana.abierta;

  async function enviar() {
    const cuerpo = texto.trim();
    if (!cuerpo || enviando) return;
    setEnviando(true);
    setAviso(null);

    const sb = supabase;
    const { data } = sb ? await sb.auth.getSession() : { data: { session: null } };
    const jwt = data.session?.access_token ?? "";
    if (!jwt) {
      setEnviando(false);
      return setAviso("Tu sesión expiró. Vuelve a entrar.");
    }

    const j = await pedirJson("/api/dm/enviar", {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
      body: JSON.stringify({ lead_id: leadId, texto: cuerpo }),
    });
    setEnviando(false);

    if (!j.ok) return setAviso(j.detalle ?? j.error ?? "No se pudo enviar.");
    setTexto("");
    setListo(true);
    // Que se note que salió, sin robar la atención: se apaga solo.
    setTimeout(() => setListo(false), 2500);
    alEnviar();
  }

  if (cerrada) {
    return (
      <div className="border-t px-3.5 py-3 text-[13px]" style={{ borderColor: "var(--color-linesoft)" }}>
        Pasaron más de 24 horas desde su mensaje, así que {canal} ya no deja responder desde acá.
        Hay que escribirle desde la aplicación; cuando conteste, la ventana se abre de nuevo.
      </div>
    );
  }

  return (
    <div className="border-t px-3.5 py-3" style={{ borderColor: "var(--color-linesoft)" }}>
      {ventana && ventana.horas_restantes <= 4 && (
        <p className="mb-2 text-[12.5px]" style={{ color: "var(--color-a)" }}>
          Queda{ventana.horas_restantes === 1 ? "" : "n"} {ventana.horas_restantes} h para responderle
          por {canal}.
        </p>
      )}
      <label htmlFor={`dm-${leadId}`} className="sr-only">
        Responder por {canal}
      </label>
      <textarea
        id={`dm-${leadId}`}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={3}
        placeholder={`Responder por ${canal}…`}
        disabled={enviando}
        className="block w-full border px-3 py-2 text-[16px]"
        style={{
          background: "var(--color-bg)",
          borderColor: "var(--color-line)",
          color: "var(--color-ink)",
          resize: "vertical",
        }}
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-[12px]" style={{ color: listo ? "var(--color-a)" : "var(--color-muted)" }}>
          {listo ? "Enviado." : `${texto.trim().length}/1000`}
        </span>
        <button
          onClick={() => void enviar()}
          disabled={enviando || !texto.trim()}
          className="cursor-pointer border px-3.5 py-1.5 text-[12.5px] font-medium disabled:cursor-not-allowed disabled:opacity-50"
          style={{ borderColor: "var(--color-line)" }}
        >
          {enviando ? "Enviando…" : "Enviar"}
        </button>
      </div>
      {aviso && (
        <p className="mt-2 text-[12.5px]" style={{ color: "var(--color-a)" }}>
          {aviso}
        </p>
      )}
    </div>
  );
}
