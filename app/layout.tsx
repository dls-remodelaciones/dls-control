import type { Metadata, Viewport } from "next";
import { Inter, Space_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "DLS Control",
  description: "Los leads de DLS Remodelaciones, calificados y listos para llamar.",
  appleWebApp: {
    capable: true,
    title: "DLS Control",
    statusBarStyle: "default",
  },
  // La app es privada: que ningún buscador la indexe.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#1D1C21",
  width: "device-width",
  initialScale: 1,
  // Sin zoom accidental al tocar un campo, pero sin impedir el zoom manual.
  maximumScale: 5,
  // Que el contenido llegue bajo el notch, con safe-area en el CSS.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-CL" className={`${inter.variable} ${spaceMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
