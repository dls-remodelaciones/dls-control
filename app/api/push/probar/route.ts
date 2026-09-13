import { NextRequest, NextResponse } from "next/server";
import { usuarioDeLaPeticion } from "@/lib/sesion";
import { avisar, avisosConfigurados } from "@/lib/avisos";

/**
 * Manda un aviso de prueba a todos los dispositivos suscritos.
 *
 * Sin esto, la única forma de saber si los avisos funcionan sería esperar a que
 * entre un lead real — y descubrir que no llegó justo con ese lead.
 */
export async function POST(req: NextRequest) {
  const quien = await usuarioDeLaPeticion(req);
  if (!quien.ok) return NextResponse.json({ ok: false, error: quien.error }, { status: quien.status });

  if (!avisosConfigurados()) {
    return NextResponse.json(
      { ok: false, error: "sin_claves_vapid", detalle: "Faltan las claves de avisos en el servidor." },
      { status: 500 },
    );
  }
  const r = await avisar({
    titulo: "Avisos activos",
    cuerpo: "Así te va a llegar cada lead nuevo y cada WhatsApp.",
    url: "/",
    tag: "prueba",
  });
  return NextResponse.json({ ok: !r.error && r.enviados > 0, ...r });
}
