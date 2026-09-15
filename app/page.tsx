"use client";

import { useEffect, useState } from "react";
import { supabase, configurado } from "@/lib/supabase";
import type { Clase } from "@/lib/negocio";
import NuevoLead from "./nuevo";
import Avisos from "./avisos";
import Estado from "./estado";
import Ficha from "./ficha-tarjeta";
import BandejaCanales from "./bandeja-canales";
import { Marco, Vacia, SinConexion, Aviso } from "./piezas";
import { useLeads, TOPE_LEADS } from "./use-leads";
import { leadsVisibles } from "@/lib/visibles";
import { agruparPorCanal } from "@/lib/agrupar-canal";
import { agruparPorEtapa } from "@/lib/etapas";
import { sinPruebas } from "@/lib/prueba";
import type { Fila, Tab } from "./tipos";
import { aCsv } from "@/lib/exportar";

export default function Pagina() {
  const [tab, setTab] = useState<Tab>("hoy");
  /**
   * Lead que pidió abrir un aviso del celular (/?lead=<id>). Antes todos los
   * avisos abrían la pantalla de inicio y había que buscar al cliente a mano.
   */
  const [enfoque, setEnfoque] = useState<string | null>(null);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("lead");
    if (!id) return;
    setEnfoque(id);
    setTab("bandeja");
    // Se limpia la dirección: recargar no debería volver a saltar al mismo lead.
    window.history.replaceState(null, "", window.location.pathname);
  }, []);
  const [filtro, setFiltro] = useState<Clase | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [sesion, setSesion] = useState<"revisando" | "dentro" | "fuera">("revisando");
  const [anotando, setAnotando] = useState(false);

  // La base no le muestra nada a quien no tiene sesión (Row Level Security),
  // así que sin ingresar no tiene sentido ni intentar leer.
  useEffect(() => {
    const sb = supabase;
    if (!sb) {
      setSesion("fuera");
      return;
    }
    void sb.auth.getSession().then(({ data }) => {
      setSesion(data.session ? "dentro" : "fuera");
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => {
      setSesion(s ? "dentro" : "fuera");
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (sesion === "fuera") window.location.replace("/login");
  }, [sesion]);

  const { filas, cargando, error, sinResponder, actualizado, cargar, conteos, esperando, paraHoy, totalHoy, dePrueba } =
    useLeads(sesion === "dentro");

  // Lo pendiente de hoy también afuera del panel: como número en el ícono de la
  // app instalada y en el título de la pestaña. Así se ve sin abrirla.
  useEffect(() => {
    if (cargando) return;
    document.title = totalHoy > 0 ? `(${totalHoy}) DLS Control` : "DLS Control";
    const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (totalHoy > 0) void nav.setAppBadge?.(totalHoy).catch(() => undefined);
    else void nav.clearAppBadge?.().catch(() => undefined);
  }, [totalHoy, cargando]);

  const visibles = leadsVisibles({
    filas,
    tab,
    filtro,
    busqueda,
    listaA: conteos.listaA,
    sinResponder,
    paraHoy,
    dePrueba,
  });

  /* Mientras se resuelve la sesión, la pantalla no parpadea con datos vacíos. */
  if (sesion !== "dentro") {
    return (
      <Marco>
        <p className="px-4 py-8 text-[13px]" style={{ color: "var(--color-muted)" }}>
          {sesion === "revisando" ? "Verificando tu sesión…" : "Llevándote al ingreso…"}
        </p>
      </Marco>
    );
  }

  /* Sin configurar: decirlo, no fingir que funciona. */
  if (!configurado) {
    return (
      <Marco>
        <Aviso
          titulo="Falta conectar la base de datos"
          detalle="No están NEXT_PUBLIC_SUPABASE_URL ni NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. En local van en .env.local; en producción, en las variables de entorno de Vercel."
        />
      </Marco>
    );
  }

  return (
    <Marco alAnotar={() => setAnotando((v) => !v)}>
      <SinConexion />
      <Avisos />

      {anotando && (
        <NuevoLead
          alCerrar={() => setAnotando(false)}
          alCrear={() => void cargar()}
        />
      )}

      {/* Tres cifras — cada una es un filtro, no un adorno */}
      <div className="grid grid-cols-3 border-b" style={{ borderColor: "var(--color-line)" }}>
        {(
          [
            ["A", conteos.a, "Llamar hoy", "var(--color-a)"],
            ["B", conteos.b, "En nutrición", "var(--color-b)"],
            ["C", conteos.c, "Pendientes", "var(--color-c)"],
          ] as const
        ).map(([clase, n, etiqueta, color]) => (
          <button
            key={clase}
            onClick={() => {
              const nuevo = filtro === clase ? null : (clase as Clase);
              setFiltro(nuevo);
              if (nuevo) setTab("bandeja");
            }}
            aria-pressed={filtro === clase}
            className="cursor-pointer border-r py-4 text-center last:border-r-0"
            style={{
              borderColor: "var(--color-linesoft)",
              background: filtro === clase ? "var(--color-warm)" : "transparent",
            }}
          >
            <span
              className="tabular block text-3xl leading-none font-bold"
              style={{ fontFamily: "var(--font-space-mono)", color }}
            >
              {cargando ? "—" : n}
            </span>
            <span
              className="mt-2 block text-[9.5px] font-medium tracking-[0.14em] uppercase"
              style={{ color: "var(--color-muted)" }}
            >
              {etiqueta}
            </span>
          </button>
        ))}
      </div>

      <main className="px-4">
        <div className="pt-6 pb-3">
          <h1 className="text-[17px] font-semibold tracking-[-0.02em] text-balance">
            {cargando
              ? "Cargando leads…"
              : tab === "hoy"
                ? totalHoy === 0
                  ? "Hoy no tienes nada pendiente"
                  : `Hoy debes hacer ${totalHoy} ${totalHoy === 1 ? "cosa" : "cosas"}`
                : tab === "bandeja"
                  ? "Bandeja"
                  : "Pipeline"}
          </h1>
          {tab === "hoy" && (conteos.a > 0 || esperando.length > 0 || paraHoy.length > 0) && (
            <p className="mt-1.5 text-[13px]" style={{ color: "var(--color-muted)" }}>
              {esperando.length > 0 && conteos.a > 0
                ? "Primero los que te escribieron; después los que pasaron el filtro completo."
                : esperando.length > 0
                  ? "Te escribieron y todavía no les respondes."
                  : "Todos ya pasaron el filtro: tienen presupuesto, plazo, comuna y teléfono."}
            </p>
          )}
          {/* Cuándo se leyó la base por última vez, y cómo pedirlo ya. La lista se
              refresca sola cada 45 s, pero sin la hora no hay cómo saberlo. */}
          {actualizado && (
            <p className="mt-1 text-[11.5px] tabular-nums" style={{ color: "var(--color-muted)" }}>
              Actualizado a las{" "}
              {actualizado.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })} ·{" "}
              <button onClick={() => void cargar()} className="cursor-pointer underline underline-offset-2">
                Actualizar ahora
              </button>
            </p>
          )}
          {/* El renglón de conteos por etapa se fue: ahora cada etapa es una
              sección con su propio título y su cuenta, y repetirlo arriba era
              decir dos veces lo mismo. */}
          {tab === "bandeja" && !cargando && filas.length > 0 && (
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, teléfono o comuna"
              aria-label="Buscar leads"
              className="mt-3 block w-full border px-3 py-2.5 text-[16px]"
              style={{ background: "var(--color-surface)", borderColor: "var(--color-line)", color: "var(--color-ink)" }}
            />
          )}
          {tab === "bandeja" && !cargando && filas.length > 0 && (
            <button
              onClick={() => descargarExcel(filas)}
              className="mt-1.5 cursor-pointer text-[13px] underline underline-offset-2"
              style={{ color: "var(--color-muted)" }}
            >
              Descargar los {filas.length} leads en Excel
            </button>
          )}
          {/* Si se llegó al tope, decirlo. Un lead que no se ve es un lead perdido. */}
          {filas.length >= TOPE_LEADS && (
            <p className="mt-1.5 text-[13px]" style={{ color: "var(--color-a)" }}>
              Estás viendo {TOPE_LEADS} leads y hay más en la base. Avísame para ampliar la
              lista — ninguno se borró.
            </p>
          )}
        </div>

        {error && <Aviso titulo="No se pudieron leer los leads" detalle={error} />}

        {/* Recordatorios anotados en la ficha para hoy o atrasados. El aviso al
            celular llega una vez; esto los deja a la vista hasta que se resuelvan. */}
        {!cargando && tab === "hoy" && paraHoy.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-2 text-[11px] font-semibold tracking-[0.12em] uppercase" style={{ color: "var(--color-b)" }}>
              Para hoy · {paraHoy.length}
            </h2>
            {/* Acá el orden lo pone la hora del recordatorio, no la de entrada:
                lo que ya venció va arriba. */}
            <BandejaCanales
              grupos={agruparPorCanal(paraHoy, sinResponder, { ascPor: (f) => f.fecha_proxima_accion })}
              sinResponder={sinResponder}
              recargar={cargar}
              compacto
              prefijo="hoy-"
            />
          </section>
        )}

        {/* Te escribieron y siguen esperando. Va antes que todo lo demás: es lo
            único de esta pantalla con un plazo corriendo en contra. */}
        {!cargando && tab === "hoy" && esperando.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-2 text-[11px] font-semibold tracking-[0.12em] uppercase" style={{ color: "var(--color-a)" }}>
              Te escribieron · {esperando.length}
            </h2>
            <BandejaCanales
              grupos={agruparPorCanal(esperando, sinResponder)}
              sinResponder={sinResponder}
              recargar={cargar}
              compacto
              prefijo="esp-"
            />
          </section>
        )}

        {cargando ? (
          <div className="space-y-2.5">
            <div className="h-[74px] animate-pulse" style={{ background: "var(--color-surface)" }} />
            <div className="h-[74px] animate-pulse" style={{ background: "var(--color-surface)" }} />
          </div>
        ) : visibles.length === 0 ? (
          esperando.length > 0 && tab === "hoy" ? null : tab === "bandeja" && busqueda.trim() ? (
            // Sin esto, una búsqueda sin resultados decía "Sin leads todavía".
            <p className="px-1 py-6 text-[13px]" style={{ color: "var(--color-muted)" }}>
              Ningún lead coincide con “{busqueda.trim()}”.
            </p>
          ) : (
            <Vacia tab={tab} enNutricion={conteos.b} />
          )
        ) : tab === "bandeja" ? (
          /* Partida por canal: con cinco entradas al mismo buzón, una sola
             lista no deja ver de dónde viene cada cliente ni cuál llegó antes. */
          <BandejaCanales
            grupos={agruparPorCanal(visibles, sinResponder)}
            sinResponder={sinResponder}
            recargar={cargar}
            enfoque={enfoque}
            dePrueba={dePrueba}
          />
        ) : tab === "hoy" ? (
          /* Los que pasaron el filtro completo, también por canal. Van con
             título propio para que las tres secciones de Hoy se lean igual:
             primero por qué están acá, después de dónde vienen. */
          <section>
            <h2 className="mb-2 text-[11px] font-semibold tracking-[0.12em] uppercase" style={{ color: "var(--color-a)" }}>
              Listos para llamar · {visibles.length}
            </h2>
            <BandejaCanales
              grupos={agruparPorCanal(visibles, sinResponder)}
              sinResponder={sinResponder}
              recargar={cargar}
              enfoque={enfoque}
              compacto
              prefijo="a-"
            />
          </section>
        ) : (
          /* El pipeline, por etapa. Mezcladas en una lista no se veía lo único
             que un pipeline sirve para ver: dónde se está quedando la gente.
             Va SIN los leads de prueba: es la vista del negocio, y una prueba
             parada en "Presupuesto enviado" distorsiona justo lo que se viene a
             mirar. En la Bandeja siguen apareciendo, con su insignia. */
          <div className="space-y-6">
            {agruparPorEtapa(sinPruebas(visibles, dePrueba)).map(({ etapa, leads }) => (
              <section key={etapa.clave}>
                <h2
                  className="mb-1 text-[11px] font-semibold tracking-[0.12em] uppercase"
                  style={{ color: etapa.color }}
                >
                  {etapa.nombre} · {leads.length}
                </h2>
                <p className="mb-2.5 text-[12px]" style={{ color: "var(--color-muted)" }}>
                  {etapa.pendiente}
                </p>
                <ul className="space-y-2.5">
                  {leads.map((f) => (
                    <Ficha key={f.id} f={f} recargar={cargar} enfocado={f.id === enfoque} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
        {tab === "hoy" && !cargando && <Estado />}
      </main>

      {/* Pestañas inferiores — la navegación en celular */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t"
        style={{
          background: "var(--color-surface)",
          borderColor: "var(--color-line)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div className="mx-auto flex max-w-[560px]">
          {(
            [
              ["hoy", "Hoy"],
              ["bandeja", "Bandeja"],
              ["pipeline", "Pipeline"],
            ] as const
          ).map(([id, etiqueta]) => (
            <button
              key={id}
              onClick={() => {
                setTab(id);
                setFiltro(null);
              }}
              aria-current={tab === id}
              className="flex-1 cursor-pointer py-3.5 text-[11px] font-medium tracking-[0.06em] uppercase"
              style={{ color: tab === id ? "var(--color-ink)" : "var(--color-muted)" }}
            >
              {etiqueta}
            </button>
          ))}
        </div>
      </nav>
    </Marco>
  );
}

/** Arma el CSV en el navegador y lo descarga. En el iPhone abre la hoja de compartir. */
function descargarExcel(filas: Fila[]) {
  const csv = aCsv(filas as unknown as Record<string, unknown>[]);
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `leads-dls-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
