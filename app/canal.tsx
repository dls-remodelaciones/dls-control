import { canalVisual, type Forma } from "@/lib/canal-visual";

/**
 * La insignia de canal de una tarjeta: ícono y nombre de por dónde escribió.
 *
 * Los íconos son SVG escritos a mano, no una librería: son ocho formas simples
 * y traer un paquete de iconos para esto pesaría más que todo el panel. A 13 px
 * lo que distingue no es el detalle sino la silueta y el color — redondo verde
 * es WhatsApp, cuadrado magenta es Instagram— así que están dibujados para
 * leerse de lejos y no para parecerse al logo de la marca.
 *
 * `solo` deja el ícono sin texto, para cuando el nombre ya está dicho al lado.
 */

export default function Canal({ canal, solo = false }: { canal: string | null | undefined; solo?: boolean }) {
  const v = canalVisual(canal);
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 align-middle"
      style={{ color: v.color }}
      title={`Entró por ${v.nombre}`}
    >
      <Icono forma={v.forma} />
      {solo ? (
        <span className="sr-only">{v.nombre}</span>
      ) : (
        <span className="text-[11px] font-semibold tracking-[0.02em] whitespace-nowrap">{v.nombre}</span>
      )}
    </span>
  );
}

function Icono({ forma }: { forma: Forma }) {
  const comun = {
    width: 13,
    height: 13,
    viewBox: "0 0 16 16",
    "aria-hidden": true,
    style: { display: "block", flexShrink: 0 },
  } as const;
  const trazo = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (forma) {
    // Redondo y macizo: la burbuja de WhatsApp con el auricular adentro.
    case "whatsapp":
      return (
        <svg {...comun}>
          <circle cx="8" cy="8" r="6.6" fill="currentColor" />
          <path
            d="M5.7 5.6c0 3 1.7 4.7 4.7 4.7l.4-1.4-1.5-.5-.5.5a4.3 4.3 0 0 1-1.7-1.7l.5-.5-.5-1.5z"
            fill="var(--color-surface)"
          />
        </svg>
      );
    // Cuadrado con lente: la cámara de Instagram.
    case "instagram":
      return (
        <svg {...comun}>
          <rect x="2.2" y="2.2" width="11.6" height="11.6" rx="3.4" {...trazo} />
          <circle cx="8" cy="8" r="2.9" {...trazo} />
          <circle cx="11.4" cy="4.6" r="0.95" fill="currentColor" />
        </svg>
      );
    // Burbuja con el rayo de Messenger.
    case "messenger":
      return (
        <svg {...comun}>
          <circle cx="8" cy="8" r="6.6" fill="currentColor" />
          <path d="M4.4 9.3 7.6 6l1.7 1.5L11.6 5 8.4 10 6.7 8.5z" fill="var(--color-surface)" />
        </svg>
      );
    // Sobre cerrado.
    case "correo":
      return (
        <svg {...comun}>
          <rect x="1.9" y="3.4" width="12.2" height="9.2" rx="1.2" {...trazo} />
          <path d="M2.4 4.4 8 8.7l5.6-4.3" {...trazo} />
        </svg>
      );
    // Calculadora: el cotizador del sitio.
    case "cotizador":
      return (
        <svg {...comun}>
          <rect x="3.2" y="1.9" width="9.6" height="12.2" rx="1.3" {...trazo} />
          <path d="M5.4 4.6h5.2" {...trazo} />
          <circle cx="5.9" cy="8" r="0.8" fill="currentColor" />
          <circle cx="8" cy="8" r="0.8" fill="currentColor" />
          <circle cx="10.1" cy="8" r="0.8" fill="currentColor" />
          <circle cx="5.9" cy="11" r="0.8" fill="currentColor" />
          <circle cx="8" cy="11" r="0.8" fill="currentColor" />
          <circle cx="10.1" cy="11" r="0.8" fill="currentColor" />
        </svg>
      );
    // Burbuja cuadrada con los tres puntos de "escribiendo".
    case "chatbot":
      return (
        <svg {...comun}>
          <path d="M2.2 4.1A1.6 1.6 0 0 1 3.8 2.5h8.4a1.6 1.6 0 0 1 1.6 1.6v5.2a1.6 1.6 0 0 1-1.6 1.6H6.6L3.4 13.4v-2.5h-.6a.6.6 0 0 1-.6-.6z" {...trazo} />
          <circle cx="5.8" cy="6.7" r="0.8" fill="currentColor" />
          <circle cx="8" cy="6.7" r="0.8" fill="currentColor" />
          <circle cx="10.2" cy="6.7" r="0.8" fill="currentColor" />
        </svg>
      );
    // Formulario del sitio: hoja con campos.
    case "formulario":
      return (
        <svg {...comun}>
          <rect x="2.6" y="1.9" width="10.8" height="12.2" rx="1.3" {...trazo} />
          <path d="M5 5.2h6M5 8h6M5 10.8h3.4" {...trazo} />
        </svg>
      );
    // Anotado a mano: el lápiz.
    case "mano":
      return (
        <svg {...comun}>
          <path d="M2.8 13.2l.9-2.8 6.8-6.8 1.9 1.9-6.8 6.8z" {...trazo} />
          <path d="M9.9 2.9l1.4-1.4 1.9 1.9-1.4 1.4" {...trazo} />
        </svg>
      );
  }
}
