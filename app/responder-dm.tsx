"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { pedirJson } from "@/lib/pedir";

/**
 * La conversación de Instagram o Messenger de un lead, y el cuadro para
 * responderla, sin salir de la ficha.
 *
 * Antes esto era solo un cuadro de texto: se escribía a ciegas, sin ver lo que
 * la persona había dicho, y había que ir a la aplicación de Meta a leerlo.
 *
 * Meta solo deja responder dentro de las 24 horas siguientes al último mensaje
 * de la persona. Ese plazo lo calcula el servidor con el mensaje real, y si ya
 * venció no se ofrece el cuadro: escribir una respuesta completa para que recién
 * al enviarla aparezca que no se puede es la peor forma de enterarse.
 */

interface Mensaje {
  direccion: string;
  cuerpo: string | null;
  creado: string;
}

const hora = (iso: string) =>
  new Date(iso).toLocaleString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

async function conSesion(): Promise<string> {
  const sb = supabase;
  if (!sb) return "";
  const { data } = await sb.auth.getSession();
  return data.session?.access_token ?? "";
}

export default function ResponderDM({
  leadId,
  canal,
  alEnviar,
}: {
  leadId: string;
  /** "Instagram" o "Messenger", para hablarle a Daniel de lo que ve. */
  canal: string;
  alEnviar: () => void;
}) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [ventana, setVentana] = useState<{ abierta: boolean; horas_restantes: number } | null>(null);
  const [cargando, setCargando] = useState(true);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  const cargar = useCallback(async () => {
    const jwt = await conSesion();
    if (!jwt) {
      setCargando(false);
      return setAviso("Tu sesión expiró. Vuelve a entrar.");
    }
    const j = await pedirJson(`/api/dm/conversacion?lead_id=${encodeURIComponent(leadId)}`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    setCargando(false);
    if (!j.ok) return setAviso(j.detalle ?? j.error ?? "No se pudo cargar la conversación.");
    setAviso(null);
    setMensajes((j.mensajes ?? []) as Mensaje[]);
    setVentana(j.ventana as { abierta: boolean; horas_restantes: number });
  }, [leadId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function enviar() {
    const cuerpo = texto.trim();
    if (!cuerpo || enviando) return;
    setEnviando(true);
    setAviso(null);

    const jwt = await conSesion();
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
    setTimeout(() => setListo(false), 2500);
    void cargar();
    alEnviar();
  }

  const borde = { borderColor: "var(--color-linesoft)" };

  return (
    <div className="border-t" style={borde}>
      {/* La conversación. Lo de la persona a la izquierda, lo nuestro a la derecha. */}
      <div className="max-h-64 overflow-y-auto px-3.5 py-3">
        {cargando ? (
          <p className="text-[13px]" style={{ color: "var(--color-muted)" }}>
            Cargando la conversación…
          </p>
        ) : mensajes.length === 0 ? (
          <p className="text-[13px]" style={{ color: "var(--color-muted)" }}>
            Todavía no hay mensajes guardados de esta conversación.
          </p>
        ) : (
          <ul className="space-y-2">
            {mensajes.map((m, i) => {
              const mio = m.direccion === "saliente";
              return (
                <li key={`${m.creado}-${i}`} className={mio ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className="max-w-[85%] border px-3 py-2"
                    style={{
                      background: mio ? "var(--color-warm)" : "var(--color-bg)",
                      borderColor: "var(--color-line)",
                    }}
                  >
                    <div className="text-[13.5px] break-words whitespace-pre-wrap">{m.cuerpo}</div>
                    <div className="mt-1 text-[11px]" style={{ color: "var(--color-muted)" }}>
                      {mio ? "Tú · " : ""}
                      {hora(m.creado)}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Responder, solo si Meta todavía lo permite. */}
      {!cargando && ventana && !ventana.abierta ? (
        <div className="border-t px-3.5 py-3 text-[13px]" style={borde}>
          Pasaron más de 24 horas desde su mensaje, así que {canal} ya no deja responder desde acá.
          Hay que escribirle desde la aplicación; cuando conteste, la ventana se abre de nuevo.
        </div>
      ) : (
        !cargando && (
          <div className="border-t px-3.5 py-3" style={borde}>
            {ventana && ventana.horas_restantes <= 4 && (
              <p className="mb-2 text-[12.5px]" style={{ color: "var(--color-a)" }}>
                Queda{ventana.horas_restantes === 1 ? "" : "n"} {ventana.horas_restantes} h para
                responderle por {canal}.
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
          </div>
        )
      )}

      {aviso && (
        <p className="px-3.5 pb-3 text-[12.5px]" style={{ color: "var(--color-a)" }}>
          {aviso}
        </p>
      )}
    </div>
  );
}
