import { ImageResponse } from "next/og";

/**
 * Ícono de la app, generado como PNG real.
 *
 * El intento anterior declaraba los íconos como SVG en data-URI y iOS los ignora:
 * por eso "DLS Control" salía como un cuadro gris vacío en la pantalla de inicio
 * del iPhone de Daniel. `ImageResponse` los entrega en PNG, que sí entiende.
 */
export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#1D1C21",
          color: "#FBF9F5",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 46,
          fontWeight: 600,
          letterSpacing: 4,
        }}
      >
        D.L.S
      </div>
    ),
    size,
  );
}
