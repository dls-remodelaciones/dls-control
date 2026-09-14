"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import Historial from "./historial";
import { config, type Senal, type TipoProyecto } from "@/lib/negocio";

/**
 * La ficha del lead, editable.
 *
 * Casi todo lo que de verdad se sabe de un cliente se averigua **llamando**, y
 * hasta ahora eso no tenía dónde ir: el lead se quedaba con los datos
 * incompletos del formulario y su puntaje reflejaba esa incompletitud para
 * siempre, aunque Daniel supiera la comuna y el presupuesto desde la primera
 * conversación. El botón "Ver ficha" existía y no hacía nada.
 *
 * El puntaje no se calcula acá: se manda al servidor, que usa el mismo motor
 * del webhook. Un lead editado a mano y uno que entró solo se miden con la
 * misma vara.
 */

const ESTADOS: [string, string][] = [
  ["contacto_inicial", "Contacto inicial"],
  ["cotizador_web", "Cotizó en la web"],
  ["visita_terreno", "Visita a terreno"],
  ["presupuesto_enviado", "Presupuesto enviado"],
  ["cerrado", "Cerrado"],
  ["no_prospero", "No prosperó"],
];

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

export type DatosFicha = {
  id: string;
  nombre?: string;
  telefono?: string | null;
  email?: string | null;
  tipo_proyecto?: string;
  comuna?: string;
  superficie_m2?: number;
  rango_presupuesto?: string;
  plazo?: string;
  propiedad?: string;
  estado?: string;
  nota_interna?: string | null;
  proxima_accion?: string | null;
  fecha_proxima_accion?: string | null;
  score?: number;
  clasificacion?: string;
  desglose?: Senal[];
};

/** ISO guardado → valor de <input type="datetime-local"> en la hora del teléfono. */
function aLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}T${p(t.getHours())}:${p(t.getMinutes())}`;
}

export default function Ficha({ f, alGuardar }: { f: DatosFicha; alGuardar: () => void }) {
  const [d, setD] = useState({
    nombre: f.nombre ?? "",
    telefono: f.telefono ?? "",
    email: f.email ?? "",
    tipo_proyecto: f.tipo_proyecto ?? "",
    comuna: f.comuna ?? "",
    superficie_m2: f.superficie_m2 ? String(f.superficie_m2) : "",
    rango_presupuesto: f.rango_presupuesto ?? "",
    plazo: f.plazo ?? "",
    propiedad: f.propiedad ?? "",
    estado: f.estado ?? "contacto_inicial",
    nota_interna: f.nota_interna ?? "",
    proxima_accion: f.proxima_accion ?? "",
    fecha_proxima_accion: aLocal(f.fecha_proxima_accion),
  });
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ score: number; clasificacion: string } | null>(null);
  const [desglose, setDesglose] = useState<Senal[]>(Array.isArray(f.desglose) ? f.desglose : []);
  const [viendoPorque, setViendoPorque] = useState(false);

  const tipos = Object.entries(config().tipos) as [TipoProyecto, { label: string; rangos: string[] }][];
  // Los tramos dependen del tipo: ofrecer los de otro proyecto sería ofrecer
  // una opción que el motor después no sabe interpretar.
  const tramos = d.tipo_proyecto ? config().tipos[d.tipo_proyecto as TipoProyecto]?.rangos ?? [] : [];

  const set = (k: keyof typeof d) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setD({ ...d, [k]: e.target.value });

  async function guardar() {
    if (guardando) return;
    setGuardando(true);
    setAviso(null);
    const sb = supabase;
    const jwt = sb ? (await sb.auth.getSession()).data.session?.access_token : "";
    const r = await fetch("/api/leads/actualizar", {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
      // La fecha viaja en ISO: el input da hora local sin zona, y el servidor la guardaría corrida.
      body: JSON.stringify({
        id: f.id,
        ...d,
        fecha_proxima_accion: d.fecha_proxima_accion ? new Date(d.fecha_proxima_accion).toISOString() : "",
      }),
    });
    const j = await r.json();
    setGuardando(false);
    if (!j.ok) {
      setAviso(j.detalle ?? j.error ?? "No se pudo guardar.");
      return;
    }
    setResultado({ score: j.score, clasificacion: j.clasificacion });
    if (Array.isArray(j.desglose)) setDesglose(j.desglose);
    alGuardar();
  }

  const campo = {
    background: "var(--color-surface)",
    borderColor: "var(--color-line)",
    color: "var(--color-ink)",
  };
  const clase = "w-full border px-2.5 py-2 text-[13px]";

  return (
    <div className="border-t px-3.5 py-3" style={{ borderColor: "var(--color-linesoft)" }}>
      <div className="grid grid-cols-2 gap-2.5">
        <label className="col-span-2 text-[11px]" style={{ color: "var(--color-muted)" }}>
          Nombre
          <input className={clase} style={campo} value={d.nombre} onChange={set("nombre")} />
        </label>

        <label className="text-[11px]" style={{ color: "var(--color-muted)" }}>
          Teléfono
          <input className={clase} style={campo} value={d.telefono} onChange={set("telefono")} inputMode="tel" />
        </label>
        <label className="text-[11px]" style={{ color: "var(--color-muted)" }}>
          Correo
          <input className={clase} style={campo} value={d.email} onChange={set("email")} inputMode="email" />
        </label>

        <label className="text-[11px]" style={{ color: "var(--color-muted)" }}>
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
        <label className="text-[11px]" style={{ color: "var(--color-muted)" }}>
          Superficie (m²)
          <input className={clase} style={campo} value={d.superficie_m2} onChange={set("superficie_m2")} inputMode="numeric" />
        </label>

        <label className="text-[11px]" style={{ color: "var(--color-muted)" }}>
          Comuna
          <input className={clase} style={campo} value={d.comuna} onChange={set("comuna")} />
        </label>
        <label className="text-[11px]" style={{ color: "var(--color-muted)" }}>
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

        <label className="text-[11px]" style={{ color: "var(--color-muted)" }}>
          Plazo
          <select className={clase} style={campo} value={d.plazo} onChange={set("plazo")}>
            {PLAZOS.map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[11px]" style={{ color: "var(--color-muted)" }}>
          Propiedad
          <select className={clase} style={campo} value={d.propiedad} onChange={set("propiedad")}>
            {PROPIEDADES.map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>

        <label className="col-span-2 text-[11px]" style={{ color: "var(--color-muted)" }}>
          Estado
          <select className={clase} style={campo} value={d.estado} onChange={set("estado")}>
            {ESTADOS.map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>

        <label className="col-span-2 text-[11px]" style={{ color: "var(--color-muted)" }}>
          Próxima acción
          <input
            className={clase}
            style={campo}
            value={d.proxima_accion}
            onChange={set("proxima_accion")}
            placeholder="Ej: llamar para coordinar la visita"
          />
        </label>

        <label className="col-span-2 text-[11px]" style={{ color: "var(--color-muted)" }}>
          Recordármelo el
          <input
            type="datetime-local"
            className={clase}
            style={campo}
            value={d.fecha_proxima_accion}
            onChange={set("fecha_proxima_accion")}
          />
          <span className="mt-0.5 block">Te llega un aviso al celular hasta una hora antes.</span>
        </label>

        <label className="col-span-2 text-[11px]" style={{ color: "var(--color-muted)" }}>
          Nota interna
          <textarea
            className={clase + " resize-y"}
            style={campo}
            rows={2}
            value={d.nota_interna}
            onChange={set("nota_interna")}
            placeholder="Lo que averiguaste llamando"
          />
        </label>
      </div>

      {aviso && (
        <p className="mt-2 text-[12px]" style={{ color: "var(--color-c)" }}>
          {aviso}
        </p>
      )}

      {/* Por qué puntúa lo que puntúa. El desglose ya se guardaba en la base y
          no se mostraba en ninguna parte: con él a la vista se entiende de dónde
          salió la clase y, sobre todo, qué falta para subirla. */}
      {desglose.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setViendoPorque((v) => !v)}
            className="cursor-pointer text-[12px] underline underline-offset-2"
            style={{ color: "var(--color-muted)" }}
          >
            {viendoPorque ? "Ocultar el detalle del puntaje" : "¿Por qué tiene este puntaje?"}
          </button>

          {viendoPorque && (
            <ul className="mt-2 border" style={{ borderColor: "var(--color-linesoft)" }}>
              {desglose.map((s, i) => {
                const falta = s.max - s.puntos;
                return (
                  <li
                    key={i}
                    className="flex items-baseline justify-between gap-3 border-b px-2.5 py-1.5 text-[12px] last:border-b-0"
                    style={{ borderColor: "var(--color-linesoft)" }}
                  >
                    <span>
                      <b className="font-semibold">{s.senal}</b>
                      <span style={{ color: "var(--color-muted)" }}> · {s.detalle}</span>
                    </span>
                    <span
                      className="tabular shrink-0"
                      style={{
                        fontFamily: "var(--font-space-mono)",
                        color: falta > 0 ? "var(--color-muted)" : "var(--color-a)",
                      }}
                    >
                      {s.puntos}/{s.max}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}


      <div className="mt-3 flex items-center justify-between">
        <span className="text-[11.5px]" style={{ color: "var(--color-muted)" }}>
          {resultado ? (
            <>
              Guardado · ahora es{" "}
              <b style={{ color: "var(--color-a)" }}>
                {resultado.clasificacion} {resultado.score}
              </b>
            </>
          ) : (
            "Al guardar, el puntaje se recalcula solo"
          )}
        </span>
        <button
          onClick={() => void guardar()}
          disabled={guardando}
          className="cursor-pointer rounded-[3px] px-3.5 py-1.5 text-[12.5px] font-semibold disabled:opacity-40"
          style={{ background: "var(--color-ink)", color: "var(--color-bg)" }}
        >
          {guardando ? "Guardando…" : "Guardar"}
        </button>
      </div>

      <Historial leadId={f.id} />
    </div>
  );
}
