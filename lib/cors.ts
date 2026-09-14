/** Orígenes del sitio que pueden llamar a las rutas públicas del panel. */
export const ORIGENES = [
  "https://dlsremodelaciones.cl",
  "https://www.dlsremodelaciones.cl",
  "http://localhost:3000",
  "http://localhost:8765",
  "http://localhost:8766",
];

export function cors(origen: string | null) {
  const permitido = origen && ORIGENES.includes(origen) ? origen : ORIGENES[0];
  return {
    "Access-Control-Allow-Origin": permitido,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-DLS-Token",
    "Access-Control-Max-Age": "86400",
  };
}
