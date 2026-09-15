"use client";

import { useSyncExternalStore } from "react";
import { CLAVE_CERRADOS, VACIO, alternarCerrado, estaCerrado } from "@/lib/cerrados";

/**
 * Las secciones cerradas, recordadas entre visitas.
 *
 * Usa `useSyncExternalStore` y no un `useEffect` con `setState` por dos razones
 * concretas, aprendidas rompiéndolas:
 *
 * 1. El servidor no tiene el almacenamiento del navegador. Leerlo en el primer
 *    render haría que el servidor pinte todo abierto y el celular todo cerrado,
 *    y React se queja de que no coinciden. `useSyncExternalStore` toma justamente
 *    un valor aparte para el servidor y arregla la diferencia en silencio, sin
 *    parpadeo visible.
 * 2. El proyecto prohíbe escribir estado dentro de un efecto
 *    (`react-hooks/set-state-in-effect`), que era la otra forma de hacerlo.
 *
 * El nombre va en inglés (`useCerrados`) por lo mismo que `useLeads`: React
 * exige el prefijo `use` para reconocer un hook, aunque el resto del proyecto
 * esté en español.
 */

const oyentes = new Set<() => void>();

function avisar() {
  for (const o of oyentes) o();
}

function suscribir(alCambiar: () => void): () => void {
  oyentes.add(alCambiar);
  // Si el panel está abierto en dos pestañas, cerrar una sección en una se
  // refleja en la otra.
  window.addEventListener("storage", alCambiar);
  return () => {
    oyentes.delete(alCambiar);
    window.removeEventListener("storage", alCambiar);
  };
}

/**
 * Devuelve el texto guardado, no un objeto: dos lecturas seguidas tienen que
 * poder compararse con `===`. Si devolviera un objeto nuevo cada vez, React
 * creería que cambió siempre y repintaría en bucle.
 */
function leerDelNavegador(): string {
  try {
    return localStorage.getItem(CLAVE_CERRADOS) ?? VACIO;
  } catch {
    // Navegación privada, almacenamiento bloqueado o lleno: se sigue igual, solo
    // que sin recordar nada.
    return VACIO;
  }
}

/** En el servidor no hay nada guardado: todo abierto. */
function enElServidor(): string {
  return VACIO;
}

export function useCerrados(): {
  cerrado: (llave: string) => boolean;
  alternar: (llave: string) => void;
} {
  const crudo = useSyncExternalStore(suscribir, leerDelNavegador, enElServidor);

  return {
    cerrado: (llave: string) => estaCerrado(crudo, llave),
    alternar: (llave: string) => {
      try {
        localStorage.setItem(CLAVE_CERRADOS, alternarCerrado(leerDelNavegador(), llave));
      } catch {
        // Almacenamiento bloqueado (navegación privada, cuota llena): la
        // sección se queda como está. Es preferible a fingir que se cerró y que
        // vuelva a abrirse sola al primer repintado, que se vería como un error.
      }
      avisar();
    },
  };
}
