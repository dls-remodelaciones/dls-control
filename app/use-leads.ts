"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { CANALES_CONVERSACION } from "@/lib/canales";
import type { Fila } from "./tipos";

/**
 * Los leads y todo lo que se deduce de ellos para la pantalla de inicio.
 *
 * Vive aparte del componente porque son dos cosas distintas: de dónde salen los
 * datos y cómo se ven. Mezcladas, la pantalla tenía 800 líneas y no se podía
 * mirar la lógica de "quién espera respuesta" sin pasar por encima del JSX.
 *
 * El nombre va en inglés (`useLeads`, no `usarLeads`) aunque el resto del
 * proyecto esté en español: React exige el prefijo `use` para reconocer un hook
 * propio, y sin él ni el linter ni el compilador lo tratan como tal.
 */

/**
 * Tope de leads que se traen de una vez.
 *
 * Estaba en 200, y como la lista viene ordenada por puntaje, al pasar ese
 * número los que se caían eran los de puntaje MÁS BAJO — justo los que Daniel
 * exige que nunca desaparezcan (regla del 2026-09-11: entra todo, se
 * clasifica, no se descarta). Con 1.000 hay años de holgura a 40 leads al mes,
 * y si algún día se llena, la pantalla lo avisa en vez de esconderlo.
 */
export const TOPE_LEADS = 1000;

export function useLeads(activo: boolean) {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** lead_id → fecha del mensaje entrante que todavía espera respuesta. */
  const [sinResponder, setSinResponder] = useState<Map<string, string>>(new Map());
  /** Última lectura buena de la base: para saber si lo que se ve es de ahora. */
  const [actualizado, setActualizado] = useState<Date | null>(null);

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
      .limit(TOPE_LEADS);
    if (error) setError(error.message);
    else {
      setError(null);
      setFilas((data ?? []) as Fila[]);
      setActualizado(new Date());
    }

    // Quién escribió y todavía no tiene respuesta. Va aparte del puntaje a
    // propósito: alguien que te acaba de escribir es una obligación, no una
    // clasificación. Un WhatsApp recién llegado no trae comuna ni presupuesto,
    // así que puntúa bajo y quedaría enterrado junto a formularios abandonados
    // hace semanas — siendo que es el lead más caliente que existe.
    const { data: msg } = await supabase
      .from("mensajes")
      .select("lead_id, direccion, creado")
      .in("canal", [...CANALES_CONVERSACION])
      .order("creado", { ascending: false })
      .limit(500);

    const ultimo = new Map<string, { direccion: string; creado: string }>();
    for (const m of (msg ?? []) as { lead_id: string; direccion: string; creado: string }[]) {
      // Vienen del más nuevo al más viejo: el primero de cada lead es el último.
      if (m.lead_id && !ultimo.has(m.lead_id)) ultimo.set(m.lead_id, m);
    }
    // "Marcar como atendido": un cliente que escribió "gracias" no necesita respuesta,
    // y sin esto quedaba para siempre arriba en "Te escribieron".
    const { data: atendidos } = await supabase
      .from("actividad")
      .select("lead_id, creado")
      .eq("tipo", "wa_atendido")
      .order("creado", { ascending: false })
      .limit(500);
    const atendidoEn = new Map<string, string>();
    for (const a of (atendidos ?? []) as { lead_id: string; creado: string }[]) {
      if (!atendidoEn.has(a.lead_id)) atendidoEn.set(a.lead_id, a.creado);
    }

    const pendientes = new Map<string, string>();
    for (const [id, m] of ultimo) {
      const atendido = atendidoEn.get(id);
      if (m.direccion === "entrante" && !(atendido && Date.parse(atendido) >= Date.parse(m.creado))) {
        pendientes.set(id, m.creado);
      }
    }
    setSinResponder(pendientes);

    setCargando(false);
  }, []);

  useEffect(() => {
    if (!activo) return;
    void cargar();
    const sb = supabase;
    if (!sb) return;
    // Realtime: cuando entra un lead por el webhook, la lista se actualiza sola.
    const canal = sb
      .channel("leads-vivo")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => void cargar())
      .subscribe();
    // Respaldo con consulta periódica. Revisado el 14-sep-2026: la publicación de
    // Realtime de Supabase no incluía ninguna tabla, así que el canal de arriba
    // nunca avisó nada y la lista NO se actualizaba sola, aunque lo pareciera.
    // Cada 45 s con la pantalla a la vista, y al volver a la app.
    const refrescar = () => {
      if (document.visibilityState === "visible") void cargar();
    };
    const t = setInterval(refrescar, 45_000);
    document.addEventListener("visibilitychange", refrescar);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", refrescar);
      void sb.removeChannel(canal);
    };
  }, [cargar, activo]);

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

  // Los que escribieron y esperan. Primero el que lleva más rato esperando:
  // es a quien peor le queda el silencio, y a quien primero se le cierra la
  // ventana de 24 horas de WhatsApp.
  const esperando = useMemo(
    () =>
      filas
        .filter((f) => sinResponder.has(f.id))
        .sort((a, b) => Date.parse(sinResponder.get(a.id)!) - Date.parse(sinResponder.get(b.id)!)),
    [filas, sinResponder],
  );

  // Recordatorios de la ficha que vencen hoy o ya vencieron, de leads todavía abiertos.
  const paraHoy = useMemo(() => {
    const finDeHoy = new Date();
    finDeHoy.setHours(23, 59, 59, 999);
    return filas
      .filter(
        (f) =>
          f.fecha_proxima_accion &&
          Date.parse(f.fecha_proxima_accion) <= finDeHoy.getTime() &&
          f.estado !== "cerrado" &&
          f.estado !== "no_prospero" &&
          !sinResponder.has(f.id),
      )
      .sort((a, b) => Date.parse(a.fecha_proxima_accion!) - Date.parse(b.fecha_proxima_accion!));
  }, [filas, sinResponder]);

  // Cosas de hoy sin contar dos veces a quien está en más de una sección.
  const totalHoy = useMemo(
    () =>
      new Set([...esperando.map((f) => f.id), ...paraHoy.map((f) => f.id), ...conteos.listaA.map((f) => f.id)]).size,
    [esperando, paraHoy, conteos.listaA],
  );

  return { filas, cargando, error, sinResponder, actualizado, cargar, conteos, esperando, paraHoy, totalHoy };
}
