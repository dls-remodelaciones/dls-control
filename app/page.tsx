"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, configurado } from "@/lib/supabase";
import { telHref, waHref, config, type Clase, type Lead } from "@/lib/negocio";

type Proyecto = {
  tipo: string;
  comuna: string;
  m2: number;
  presupuesto: string;
  tier: string;
  fecha: string;
};

type Fila = Lead & {
  id: string;
  clasificacion: Clase;
  score: number;
  apto_para_llamar: boolean;
  estado: string;
  creado: string;
  proyectos?: Proyecto[];
};

type Tab = "hoy" | "bandeja" | "pipeline";

const CLASE_COLOR: Record<Clase, string> = {
  A: "var(--color-a)",
  B: "var(--color-b)",
  C: "var(--color-c)",
  D: "var(--color-line)",
};

export default function Pagina() {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("hoy");
  const [filtro, setFiltro] = useState<Clase | null>(null);
  const [sesion, setSesion] = useState<"revisando" | "dentro" | "fuera">("revisando");

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

  const cargar = useCallback(async () => {
    if (!supabase) {
      setCargando(false);
      return;
    }
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("score", { ascending: false })
      .order("creado", { ascending: false })
      .limit(200);
    if (error) setError(error.message);
    else setFilas((data ?? []) as Fila[]);
    setCargando(false);
  }, []);

  useEffect(() => {
    if (sesion !== "dentro") return;
    void cargar();
    const sb = supabase;
    if (!sb) return;
    // Realtime: cuando entra un lead por el webhook, la lista se actualiza sola.
    const canal = sb
      .channel("leads-vivo")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => void cargar())
      .subscribe();
    return () => {
      void sb.removeChannel(canal);
    };
  }, [cargar, sesion]);

  const conteos = useMemo(() => {
    const listaA = filas.filter(
      (f) => f.clasificacion === "A" && f.apto_para_llamar && f.estado === "contacto_inicial",
    );
    const b = filas.filter((f) => f.clasificacion === "B").length;
    const c = filas.filter(
      (f) =>
        f.clasificacion === "C" ||
        f.clasificacion === "D" ||
        (f.clasificacion === "A" && !f.apto_para_llamar),
    ).length;
    return { a: listaA.length, b, c, listaA };
  }, [filas]);

  const visibles = useMemo(() => {
    let v = filas;
    if (tab === "hoy") v = conteos.listaA;
    if (tab === "pipeline") v = filas.filter((f) => f.estado !== "contacto_inicial");
    if (filtro) v = v.filter((f) => f.clasificacion === filtro);
    return v;
  }, [filas, tab, filtro, conteos.listaA]);

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
    <Marco>
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
                ? conteos.a === 0
                  ? "Hoy no tienes llamadas pendientes"
                  : `Hoy debes hacer ${conteos.a} ${conteos.a === 1 ? "cosa" : "cosas"}`
                : tab === "bandeja"
                  ? "Bandeja"
                  : "Pipeline"}
          </h1>
          {tab === "hoy" && conteos.a > 0 && (
            <p className="mt-1.5 text-[13px]" style={{ color: "var(--color-muted)" }}>
              Todos ya pasaron el filtro: tienen presupuesto, plazo, comuna y teléfono.
            </p>
          )}
        </div>

        {error && <Aviso titulo="No se pudieron leer los leads" detalle={error} />}

        {cargando ? (
          <div className="space-y-2.5">
            <div className="h-[74px] animate-pulse" style={{ background: "var(--color-surface)" }} />
            <div className="h-[74px] animate-pulse" style={{ background: "var(--color-surface)" }} />
          </div>
        ) : visibles.length === 0 ? (
          <Vacia tab={tab} enNutricion={conteos.b} />
        ) : (
          <ul className="space-y-2.5">
            {visibles.map((f) => (
              <Ficha key={f.id} f={f} />
            ))}
          </ul>
        )}
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

/* ── Piezas ─────────────────────────────────────────────────────────────── */

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[560px]">
      <header
        className="sticky top-0 z-20 border-b"
        style={{ background: "var(--color-bg)", borderColor: "var(--color-line)" }}
      >
        <div className="flex h-14 items-center px-4">
          <span className="text-base font-semibold tracking-[-0.02em]">
            DLS{" "}
            <span className="font-light" style={{ color: "var(--color-muted)" }}>
              Control
            </span>
          </span>
        </div>
      </header>
      {children}
    </div>
  );
}

function Ficha({ f }: { f: Fila }) {
  const tipo = f.tipo_proyecto ? config().tipos[f.tipo_proyecto]?.label : "";
  const sub = [tipo, f.superficie_m2 ? `${f.superficie_m2} m²` : "", f.rango_presupuesto]
    .filter(Boolean)
    .join(" · ");
  // El proyecto principal ya se muestra arriba; estos son los demas que pidio.
  const otros = (f.proyectos ?? []).filter(
    (p) => !(p.tipo === f.tipo_proyecto && p.comuna === f.comuna && p.m2 === f.superficie_m2),
  );
  const color = CLASE_COLOR[f.clasificacion] ?? "var(--color-c)";

  return (
    <li
      className="border"
      style={{
        background: "var(--color-surface)",
        borderColor: "var(--color-line)",
        borderLeft: `3px solid ${color}`,
      }}
    >
      <div className="flex items-start gap-2.5 px-3.5 py-3">
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold tracking-[-0.01em] break-words">
            {f.nombre}
            {f.comuna && (
              <span className="font-light" style={{ color: "var(--color-muted)" }}>
                {" · "}
                {f.comuna}
              </span>
            )}
          </div>
          {sub && (
            <div className="mt-0.5 text-[12.5px] break-words" style={{ color: "var(--color-muted)" }}>
              {sub}
            </div>
          )}
          {/* Una persona puede pedir varias cosas. Arriba va la principal — la de
              mayor presupuesto — y aquí las demás, para no llamar a medias. */}
          {otros.length > 0 && (
            <div className="mt-1.5 text-[12px]" style={{ color: "var(--color-muted)" }}>
              <span style={{ color: "var(--color-b)" }}>
                También pidió {otros.length === 1 ? "otro proyecto" : `otros ${otros.length} proyectos`}:
              </span>{" "}
              {otros
                .map((p) =>
                  [
                    p.tipo ? config().tipos[p.tipo as keyof ReturnType<typeof config>["tipos"]]?.label ?? p.tipo : "",
                    p.m2 ? `${p.m2} m²` : "",
                    p.comuna,
                  ]
                    .filter(Boolean)
                    .join(" "),
                )
                .join(" · ")}
            </div>
          )}
        </div>
        <span
          className="tabular shrink-0 rounded-[2px] px-1.5 py-0.5 text-[12px] font-bold"
          style={{ fontFamily: "var(--font-space-mono)", color }}
        >
          {f.clasificacion} {f.score}
        </span>
      </div>

      {/* Máximo 3 acciones. Todo lo demás, detrás de Ver ficha. */}
      <div className="flex border-t" style={{ borderColor: "var(--color-linesoft)" }}>
        {f.telefono ? (
          <a
            href={telHref(f)}
            className="flex-1 border-r py-2.5 text-center text-[12.5px] font-medium"
            style={{ borderColor: "var(--color-linesoft)" }}
          >
            Llamar
          </a>
        ) : (
          <span
            className="flex-1 border-r py-2.5 text-center text-[12.5px]"
            style={{ borderColor: "var(--color-linesoft)", color: "var(--color-muted)" }}
          >
            Sin teléfono
          </span>
        )}
        {f.telefono && (
          <a
            href={waHref(f)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 border-r py-2.5 text-center text-[12.5px] font-medium"
            style={{ borderColor: "var(--color-linesoft)" }}
          >
            WhatsApp
          </a>
        )}
        <button className="flex-1 cursor-pointer py-2.5 text-center text-[12.5px] font-medium">
          Ver ficha
        </button>
      </div>
    </li>
  );
}

function Vacia({ tab, enNutricion }: { tab: Tab; enNutricion: number }) {
  const marco = {
    borderColor: "var(--color-line)",
    background: "var(--color-surface)",
  };
  if (tab === "hoy") {
    return (
      <div className="border border-dashed px-5 py-8 text-center" style={marco}>
        <h2 className="text-[15px] font-semibold">Nadie califica para llamar hoy</h2>
        <p className="mt-2 text-[13px]" style={{ color: "var(--color-muted)" }}>
          No es un error: es que ningún lead llegó a 75 puntos con teléfono válido.
        </p>
        <ul className="mt-3 space-y-1.5 text-left text-[13px]" style={{ color: "var(--color-muted)" }}>
          {enNutricion > 0 && <li>· Tienes {enNutricion} en nutrición a pocos puntos de A.</li>}
          <li>· Publica una obra terminada con el link del embudo en la bio.</li>
          <li>· Reactiva por WhatsApp a los que quedaron en “explorando”.</li>
        </ul>
      </div>
    );
  }
  return (
    <div className="border border-dashed px-5 py-8 text-center" style={marco}>
      <h2 className="text-[15px] font-semibold">
        {tab === "pipeline" ? "Nada en el pipeline todavía" : "Sin leads todavía"}
      </h2>
      <p className="mt-2 text-[13px]" style={{ color: "var(--color-muted)" }}>
        {tab === "pipeline"
          ? "Cuando muevas un lead a contactado o visita, aparece acá."
          : "Los leads del cotizador, el chatbot y el correo aparecen aquí solos."}
      </p>
    </div>
  );
}

function Aviso({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <div
      className="mx-4 my-4 border px-3.5 py-3 text-[13px]"
      style={{
        borderColor: "var(--color-a)",
        background: "color-mix(in srgb, var(--color-a) 10%, transparent)",
      }}
    >
      <b className="font-semibold">{titulo}</b>
      <p className="mt-1" style={{ color: "var(--color-muted)" }}>
        {detalle}
      </p>
    </div>
  );
}
