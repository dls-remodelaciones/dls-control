"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { pedirJson } from "@/lib/pedir";

/**
 * Activar los avisos al celular.
 *
 * Aparece como franja arriba del panel mientras los avisos no estén activos en
 * este dispositivo, y desaparece cuando lo están: una vez encendidos no tiene
 * por qué ocupar pantalla.
 *
 * El caso que más cuesta es el iPhone: Safari solo permite avisos si el panel
 * está **instalado en la pantalla de inicio** y se abre desde ese ícono. Desde
 * una pestaña normal el botón no puede funcionar, así que en vez de fallar en
 * silencio se explica exactamente qué hacer.
 */

type Estado = "revisando" | "no_soportado" | "instalar_ios" | "bloqueado" | "apagado" | "activo" | "activando";

const CLAVE_PUBLICA = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function aBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const relleno = "=".repeat((4 - (base64url.length % 4)) % 4);
  const b64 = (base64url + relleno).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function jwt(): Promise<string> {
  const sb = supabase;
  if (!sb) return "";
  return (await sb.auth.getSession()).data.session?.access_token ?? "";
}

export default function Avisos() {
  const [estado, setEstado] = useState<Estado>("revisando");
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const soporta = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const instalada =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;

      if (esIOS && !instalada) return setEstado("instalar_ios");
      if (!soporta || !CLAVE_PUBLICA) return setEstado("no_soportado");
      if (Notification.permission === "denied") return setEstado("bloqueado");

      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.getSubscription();
      const activo = Boolean(sub && Notification.permission === "granted");
      setEstado(activo ? "activo" : "apagado");
      // Cada vez que se abre el panel se vuelve a registrar este dispositivo en
      // el servidor. Si el servidor lo había borrado (un envío fallido, un
      // cambio de suscripción del navegador), el teléfono creía tener avisos
      // activos y no le llegaba ninguno. Registrar dos veces no duplica.
      if (activo && sub) {
        void pedirJson("/api/push/suscribir", {
          method: "POST",
          headers: { Authorization: `Bearer ${await jwt()}`, "Content-Type": "application/json" },
          body: JSON.stringify(sub.toJSON()),
        });
      }
    })().catch(() => setEstado("no_soportado"));
  }, []);

  async function activar() {
    setEstado("activando");
    setAviso(null);
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") return setEstado(permiso === "denied" ? "bloqueado" : "apagado");

      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(CLAVE_PUBLICA) }));

      const j = await pedirJson("/api/push/suscribir", {
        method: "POST",
        headers: { Authorization: `Bearer ${await jwt()}`, "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!j.ok) {
        setAviso(j.detalle ?? j.error ?? "No se pudo registrar este dispositivo.");
        return setEstado("apagado");
      }
      setEstado("activo");
      await probar();
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "No se pudieron activar los avisos.");
      setEstado("apagado");
    }
  }

  async function probar() {
    const j = await pedirJson("/api/push/probar", {
      method: "POST",
      headers: { Authorization: `Bearer ${await jwt()}` },
    });
    setAviso(j.ok ? "Te mandé un aviso de prueba." : j.detalle ?? "El aviso de prueba no salió.");
  }

  if (estado === "revisando" || estado === "no_soportado") return null;

  const franja = {
    background: "var(--color-surface)",
    borderColor: "var(--color-line)",
  };

  // Activo: una línea chica con la opción de probar. Sin ella, la única forma de
  // comprobar que los avisos siguen llegando sería esperar un lead real.
  if (estado === "activo") {
    return (
      <div
        className="flex items-center justify-between gap-3 border-b px-4 py-2 text-[12px]"
        style={{ ...franja, color: "var(--color-muted)" }}
      >
        <span>{aviso ?? "Avisos activos en este dispositivo."}</span>
        <button onClick={() => void probar()} className="shrink-0 cursor-pointer underline">
          Probar aviso
        </button>
      </div>
    );
  }

  return (
    <div className="border-b px-4 py-3 text-[13px]" style={franja}>
      {estado === "instalar_ios" ? (
        <>
          <b className="font-semibold">Para que te avise al celular</b>
          <p className="mt-1" style={{ color: "var(--color-muted)" }}>
            En el iPhone los avisos solo funcionan con el panel instalado. Toca{" "}
            <b>Compartir</b> (el cuadrado con la flecha) → <b>Agregar a pantalla de inicio</b>, y abre DLS
            Control desde ese ícono. Ahí aparece el botón para activarlos.
          </p>
        </>
      ) : estado === "bloqueado" ? (
        <>
          <b className="font-semibold">Los avisos están bloqueados en este dispositivo</b>
          <p className="mt-1" style={{ color: "var(--color-muted)" }}>
            Se rechazó el permiso antes. Hay que habilitarlo en los ajustes de notificaciones del teléfono
            para DLS Control y volver a abrir el panel.
          </p>
        </>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <span>
            <b className="font-semibold">Recibe un aviso</b>
            <span style={{ color: "var(--color-muted)" }}> cuando entre un lead o te escriban por WhatsApp.</span>
          </span>
          <button
            onClick={() => void activar()}
            disabled={estado === "activando"}
            className="shrink-0 cursor-pointer px-3 py-1.5 text-[12.5px] font-semibold disabled:opacity-50"
            style={{ background: "var(--color-ink)", color: "var(--color-bg)" }}
          >
            {estado === "activando" ? "Activando…" : "Activar avisos"}
          </button>
        </div>
      )}
      {aviso && (
        <p className="mt-2 text-[12px]" style={{ color: "var(--color-c-texto)" }}>
          {aviso}
        </p>
      )}
    </div>
  );
}
