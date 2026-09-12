"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Responder un WhatsApp sin salir de la ficha del lead.
 *
 * Por qué esto tuvo que existir: el número del negocio está conectado a la API
 * de Meta, y un número conectado a la API **no aparece en ninguna aplicación de
 * WhatsApp**. No hay un teléfono donde leer la conversación ni donde contestar.
 * Si no se responde desde acá, no se responde.
 *
 * La regla de las 24 horas se muestra de frente en vez de esconderla: cuando el
 * plazo se cierra, WhatsApp deja de aceptar texto libre, y es mejor que eso se
 * vea antes de escribir el mensaje que después de perderlo.
 */

type Mensaje = {
  id: string;
  direccion: string;
  cuerpo: string | null;
  enviado_por: string | null;
  creado: string;
};

type Estado = {
  puede_escribir: boolean;
  configurado: boolean;
  ventana: { abierta: boolean; horas_restantes: number; ultimo_mensaje_del_cliente: string | null };
  mensajes: Mensaje[];
};

const hora = (iso: string) =>
  new Date(iso).toLocaleString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

async function conSesion(): Promise<string> {
  const sb = supabase;
  if (!sb) return "";
  const { data } = await sb.auth.getSession();
  return data.session?.access_token ?? "";
}

export default function Conversacion({
  leadId,
  telefono,
  alternativa,
}: {
  leadId: string;
  telefono: string | null;
  /** Enlace wa.me, para cuando la ventana está cerrada y hay que usar el celular. */
  alternativa: string;
}) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const caja = useRef<HTMLTextAreaElement>(null);

  const cargar = useCallback(async () => {
    const jwt = await conSesion();
    if (!jwt) return setAviso("Tu sesión expiró. Vuelve a entrar.");
    const r = await fetch(`/api/whatsapp/conversacion?lead_id=${encodeURIComponent(leadId)}`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    const j = await r.json();
    if (!j.ok) return setAviso(j.detalle ?? j.error ?? "No se pudo cargar la conversación.");
    setEstado(j as Estado);
  }, [leadId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const enviar = useCallback(async () => {
    const cuerpo = texto.trim();
    if (!cuerpo || enviando) return;
    setEnviando(true);
    setAviso(null);
    const jwt = await conSesion();
    const r = await fetch("/api/whatsapp/conversacion", {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
      body: JSON.stringify({ lead_id: leadId, texto: cuerpo }),
    });
    const j = await r.json();
    setEnviando(false);
    if (!j.ok) {
      setAviso(j.detalle ?? j.error ?? "No se pudo enviar.");
      // La ventana pudo cerrarse mientras escribía: se recarga para que la
      // pantalla diga la verdad en vez de quedar ofreciendo algo imposible.
      if (j.error === "ventana_cerrada") void cargar();
      return;
    }
    setTexto("");
    void cargar();
  }, [texto, enviando, leadId, cargar]);

  const marco = { borderColor: "var(--color-linesoft)" };

  if (aviso && !estado) {
    return (
      <div className="border-t px-3.5 py-3 text-[12.5px]" style={{ ...marco, color: "var(--color-muted)" }}>
        {aviso}
      </div>
    );
  }

  if (!estado) {
    return (
      <div className="border-t px-3.5 py-3 text-[12.5px]" style={{ ...marco, color: "var(--color-muted)" }}>
        Cargando la conversación…
      </div>
    );
  }

  const { ventana, mensajes, puede_escribir, configurado } = estado;

  return (
    <div className="border-t" style={marco}>
      {/* Estado de la ventana: lo primero que hay que saber antes de escribir. */}
      <div
        className="flex items-center justify-between gap-2 px-3.5 py-2 text-[12px]"
        style={{ background: "var(--color-bg)", color: "var(--color-muted)" }}
      >
        <span>
          {ventana.abierta ? (
            <>
              Puedes escribir durante{" "}
              <b style={{ color: "var(--color-a)" }}>
                {ventana.horas_restantes < 1
                  ? `${Math.round(ventana.horas_restantes * 60)} min`
                  : `${ventana.horas_restantes} h`}
              </b>{" "}
              más
            </>
          ) : ventana.ultimo_mensaje_del_cliente ? (
            <>Pasaron más de 24 h desde su mensaje</>
          ) : (
            <>Todavía no te ha escrito por WhatsApp</>
          )}
        </span>
        <button onClick={() => void cargar()} className="cursor-pointer underline underline-offset-2">
          Actualizar
        </button>
      </div>

      {/* Historial. Solo WhatsApp: mezclar canales confunde más de lo que ayuda. */}
      {mensajes.length > 0 && (
        <div className="max-h-64 overflow-y-auto px-3.5 py-2.5">
          {mensajes.map((m) => {
            const mio = m.direccion === "saliente";
            return (
              <div key={m.id} className={`mb-2 flex ${mio ? "justify-end" : "justify-start"}`}>
                <div
                  className="max-w-[85%] rounded-[3px] px-2.5 py-1.5 text-[12.5px] whitespace-pre-wrap break-words"
                  style={{
                    background: mio ? "var(--color-a)" : "var(--color-surface)",
                    color: mio ? "#fff" : "inherit",
                    border: mio ? "none" : "1px solid var(--color-line)",
                  }}
                >
                  {m.cuerpo}
                  <div
                    className="mt-1 text-[10.5px]"
                    style={{ color: mio ? "rgba(255,255,255,.75)" : "var(--color-muted)" }}
                  >
                    {hora(m.creado)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {aviso && (
        <div className="px-3.5 pb-2 text-[12px]" style={{ color: "var(--color-c)" }}>
          {aviso}
        </div>
      )}

      {puede_escribir ? (
        <div className="px-3.5 pb-3">
          <textarea
            ref={caja}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              // Enter envía; Shift+Enter hace salto de línea. Es lo que la mano
              // ya espera después de años de mensajería.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void enviar();
              }
            }}
            rows={2}
            placeholder="Escribe tu respuesta…"
            className="w-full resize-y rounded-[3px] border px-2.5 py-2 text-[13px] outline-none"
            style={{ borderColor: "var(--color-line)", background: "var(--color-surface)" }}
          />
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-[11px]" style={{ color: "var(--color-muted)" }}>
              Sale desde el WhatsApp de la empresa
            </span>
            <button
              onClick={() => void enviar()}
              disabled={enviando || !texto.trim()}
              className="cursor-pointer rounded-[3px] px-3.5 py-1.5 text-[12.5px] font-semibold disabled:cursor-default disabled:opacity-40"
              style={{ background: "var(--color-a)", color: "#fff" }}
            >
              {enviando ? "Enviando…" : "Enviar"}
            </button>
          </div>
        </div>
      ) : (
        <div className="px-3.5 pb-3 text-[12.5px]" style={{ color: "var(--color-muted)" }}>
          {!configurado ? (
            <>El WhatsApp de la empresa no está configurado en el servidor.</>
          ) : !telefono ? (
            <>Este lead no dejó teléfono, así que no hay a dónde escribir.</>
          ) : (
            <>
              WhatsApp solo permite responder texto libre dentro de las 24 horas siguientes al mensaje
              del cliente. Para retomar la conversación ahora, escríbele{" "}
              <a
                href={alternativa}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
                style={{ color: "var(--color-a)" }}
              >
                desde tu celular
              </a>
              . Cuando él conteste, la ventana se abre de nuevo y puedes seguir desde acá.
            </>
          )}
        </div>
      )}
    </div>
  );
}
