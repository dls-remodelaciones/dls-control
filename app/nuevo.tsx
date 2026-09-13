"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { config, type TipoProyecto } from "@/lib/negocio";

/**
 * Alta manual de un lead.
 *
 * Para la gente que llega por fuera del formulario: una llamada, un mensaje de
 * Instagram, un referido. Antes esa persona no entraba a ninguna parte y se
 * perdía entera — con su comuna, su presupuesto y su urgencia.
 *
 * Pide lo mínimo indispensable y deja lo demás en blanco a propósito: un lead
 * anotado a medias vale mucho más que uno no anotado, y la ficha se completa
 * después. Es la misma regla de "nada se pierde" aplicada al teléfono.
 */

const PLAZOS: [string, string][] = [
  ["", "Sin dato"],
  ["inmediato", "Inmediato"],
  ["1-3_meses", "1 a 3 meses"],
  ["3-6_meses", "3 a 6 meses"],
  ["explorando", "Explorando"],
];

const PROPIEDADES: [string, string][] = [
  ["", "Sin dato"],
  ["propia", "Propia"],
  ["por_comprar", "Por comprar"],
  ["arriendo", "Arriendo"],
];

const ORIGENES = [
  "Llamada telefónica",
  "Instagram",
  "Referido",
  "Visita a obra",
  "Otro",
];

export default function NuevoLead({ alCerrar, alCrear }: { alCerrar: () => void; alCrear: () => void }) {
  const [d, setD] = useState({
    nombre: "",
    telefono: "",
    email: "",
    tipo_proyecto: "",
    comuna: "",
    superficie_m2: "",
    rango_presupuesto: "",
    plazo: "",
    propiedad: "",
    fuente_original: "Llamada telefónica",
    mensaje: "",
  });
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [hecho, setHecho] = useState<{ clasificacion: string; score: number; creado: boolean } | null>(null);

  const tipos = Object.entries(config().tipos) as [TipoProyecto, { label: string; rangos: string[] }][];
  const tramos = d.tipo_proyecto ? config().tipos[d.tipo_proyecto as TipoProyecto]?.rangos ?? [] : [];

  const set = (k: keyof typeof d) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setD({ ...d, [k]: e.target.value });

  async function crear() {
    if (guardando) return;
    if (!d.nombre.trim() && !d.telefono.trim() && !d.email.trim()) {
      setAviso("Pon al menos un nombre o una forma de contacto.");
      return;
    }
    setGuardando(true);
    setAviso(null);
    const sb = supabase;
    const jwt = sb ? (await sb.auth.getSession()).data.session?.access_token : "";
    const r = await fetch("/api/leads/crear", {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
      body: JSON.stringify(d),
    });
    const j = await r.json();
    setGuardando(false);
    if (!j.ok) {
      setAviso(j.detalle ?? j.error ?? "No se pudo crear.");
      return;
    }
    setHecho({ clasificacion: j.clasificacion, score: j.score, creado: j.creado });
    alCrear();
  }

  const campo = { background: "var(--color-surface)", borderColor: "var(--color-line)", color: "var(--color-ink)" };
  const clase = "w-full border px-2.5 py-2 text-[13px]";
  const etq = "text-[11px]";

  if (hecho) {
    return (
      <div className="border-b px-4 py-4" style={{ borderColor: "var(--color-line)", background: "var(--color-surface)" }}>
        <b className="text-[14px] font-semibold">
          {hecho.creado ? "Lead creado" : "Ya existía y se completó"}
        </b>
        <p className="mt-1 text-[13px]" style={{ color: "var(--color-muted)" }}>
          {hecho.creado
            ? "Quedó guardado como "
            : "Esta persona ya estaba en la base con ese teléfono o correo, así que se fusionó con su ficha en vez de duplicarla. Quedó como "}
          <b style={{ color: "var(--color-a)" }}>
            {hecho.clasificacion} {hecho.score}
          </b>
          .
        </p>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => {
              setHecho(null);
              setD({ ...d, nombre: "", telefono: "", email: "", comuna: "", superficie_m2: "", mensaje: "" });
            }}
            className="cursor-pointer border px-3 py-1.5 text-[12.5px]"
            style={{ borderColor: "var(--color-line)" }}
          >
            Anotar otro
          </button>
          <button
            onClick={alCerrar}
            className="cursor-pointer px-3.5 py-1.5 text-[12.5px] font-semibold"
            style={{ background: "var(--color-ink)", color: "var(--color-bg)" }}
          >
            Listo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b px-4 py-4" style={{ borderColor: "var(--color-line)", background: "var(--color-surface)" }}>
      <div className="mb-2.5 flex items-center justify-between">
        <b className="text-[14px] font-semibold">Anotar un lead</b>
        <button onClick={alCerrar} className="cursor-pointer text-[13px] underline" style={{ color: "var(--color-muted)" }}>
          Cancelar
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <label className={"col-span-2 " + etq} style={{ color: "var(--color-muted)" }}>
          ¿De dónde llegó?
          <select className={clase} style={campo} value={d.fuente_original} onChange={set("fuente_original")}>
            {ORIGENES.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>

        <label className={"col-span-2 " + etq} style={{ color: "var(--color-muted)" }}>
          Nombre
          <input className={clase} style={campo} value={d.nombre} onChange={set("nombre")} autoFocus />
        </label>

        <label className={etq} style={{ color: "var(--color-muted)" }}>
          Teléfono
          <input className={clase} style={campo} value={d.telefono} onChange={set("telefono")} inputMode="tel" placeholder="+56 9 ..." />
        </label>
        <label className={etq} style={{ color: "var(--color-muted)" }}>
          Correo
          <input className={clase} style={campo} value={d.email} onChange={set("email")} inputMode="email" />
        </label>

        <label className={etq} style={{ color: "var(--color-muted)" }}>
          Proyecto
          <select
            className={clase}
            style={campo}
            value={d.tipo_proyecto}
            onChange={(e) => setD({ ...d, tipo_proyecto: e.target.value, rango_presupuesto: "" })}
          >
            <option value="">Sin definir</option>
            {tipos.map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
        <label className={etq} style={{ color: "var(--color-muted)" }}>
          Superficie (m²)
          <input className={clase} style={campo} value={d.superficie_m2} onChange={set("superficie_m2")} inputMode="numeric" />
        </label>

        <label className={etq} style={{ color: "var(--color-muted)" }}>
          Comuna
          <input className={clase} style={campo} value={d.comuna} onChange={set("comuna")} />
        </label>
        <label className={etq} style={{ color: "var(--color-muted)" }}>
          Presupuesto
          <select className={clase} style={campo} value={d.rango_presupuesto} onChange={set("rango_presupuesto")}>
            <option value="">Sin declarar</option>
            {tramos.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <label className={etq} style={{ color: "var(--color-muted)" }}>
          Plazo
          <select className={clase} style={campo} value={d.plazo} onChange={set("plazo")}>
            {PLAZOS.map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className={etq} style={{ color: "var(--color-muted)" }}>
          Propiedad
          <select className={clase} style={campo} value={d.propiedad} onChange={set("propiedad")}>
            {PROPIEDADES.map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>

        <label className={"col-span-2 " + etq} style={{ color: "var(--color-muted)" }}>
          Qué te dijo
          <textarea
            className={clase + " resize-y"}
            style={campo}
            rows={2}
            value={d.mensaje}
            onChange={set("mensaje")}
            placeholder="Lo que contó en la llamada"
          />
        </label>
      </div>

      {aviso && (
        <p className="mt-2 text-[12px]" style={{ color: "var(--color-c)" }}>
          {aviso}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between">
        <span className="text-[11.5px]" style={{ color: "var(--color-muted)" }}>
          Basta el nombre o un contacto; lo demás se completa después
        </span>
        <button
          onClick={() => void crear()}
          disabled={guardando}
          className="cursor-pointer rounded-[3px] px-3.5 py-1.5 text-[12.5px] font-semibold disabled:opacity-40"
          style={{ background: "var(--color-ink)", color: "var(--color-bg)" }}
        >
          {guardando ? "Guardando…" : "Guardar lead"}
        </button>
      </div>
    </div>
  );
}
