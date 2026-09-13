import { NextRequest, NextResponse } from "next/server";
import { usuarioDeLaPeticion } from "@/lib/sesion";
import { registrarLead, type EntradaLead } from "@/lib/registrar-lead";

/**
 * Alta manual de un lead, desde el panel.
 *
 * Existía un hueco grande: solo entraban los leads que llegaban por la web o
 * por WhatsApp. A quien llamaba por teléfono, escribía por Instagram o venía
 * recomendado **no había dónde ponerlo** — esa persona simplemente no existía
 * en el sistema, no se calificaba y no entraba en ningún seguimiento.
 *
 * Usa el MISMO motor que el webhook (`registrarLead`), así que hereda gratis
 * dos cosas que importan: el dedupe —si esa persona ya había escrito antes, se
 * fusiona con su ficha en vez de crear una segunda— y el puntaje calculado con
 * la misma vara que todos los demás.
 */
export async function POST(req: NextRequest) {
  const quien = await usuarioDeLaPeticion(req);
  if (!quien.ok) return NextResponse.json({ ok: false, error: quien.error }, { status: quien.status });

  let body: EntradaLead;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "json_invalido" }, { status: 400 });
  }

  // El canal queda como "manual" siempre: saber que este lead lo anotó una
  // persona, y no un formulario, cambia cómo se lee su ficha después.
  const r = await registrarLead({
    ...body,
    canal: "manual",
    fuente_original: body.fuente_original ? String(body.fuente_original) : "alta manual desde el panel",
    // Sin sesión de navegador no hay sesion_id; el dedupe se apoya en teléfono
    // y correo, que es justo lo que se pide en el formulario.
  });

  if (!r.ok) {
    return NextResponse.json({ ok: false, error: r.error, detalle: r.detalle }, { status: r.status });
  }
  return NextResponse.json(r);
}
