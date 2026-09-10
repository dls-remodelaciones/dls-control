import type { MetadataRoute } from "next";

/**
 * Manifest de la PWA. Next genera los PNG desde `icon.tsx` y los referencia acá,
 * así que no hay data-URI de SVG como en el intento anterior.
 *
 * `display: "standalone"` es lo que hace que abra a pantalla completa, sin la
 * barra de Safari — condición para que iOS permita notificaciones push.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DLS Control",
    short_name: "DLS Control",
    description: "Los leads de DLS Remodelaciones, calificados y listos para llamar.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#EFEAE1",
    theme_color: "#1D1C21",
    lang: "es-CL",
    icons: [
      { src: "/icon", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  };
}
