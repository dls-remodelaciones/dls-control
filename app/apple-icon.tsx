import { ImageResponse } from "next/og";

/**
 * `apple-touch-icon` — el que iOS usa de verdad para la pantalla de inicio.
 * Sin margen ni esquinas redondeadas: iOS recorta y redondea solo.
 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
          fontSize: 44,
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
