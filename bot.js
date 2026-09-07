// ============================================================
// DLS Control — Motor del Bot con IA (Claude)
// Decide si responde automáticamente o escala al dueño
// ============================================================

const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Palabras que hacen escalar al dueño (10%)
const ESCALATE_KEYWORDS = [
  'precio final', 'contrato', 'garantía', 'garantia',
  'problema', 'reclamo', 'queja', 'mal trabajo',
  'devolución', 'devolucion', 'urgente', 'accidente'
];

function shouldEscalate(text) {
  const lower = text.toLowerCase();
  return ESCALATE_KEYWORDS.some(kw => lower.includes(kw));
}

async function getBotConfig() {
  const { data } = await supabase.from('bot_config').select('key,value');
  return Object.fromEntries((data || []).map(r => [r.key, r.value]));
}

async function getLeadHistory(leadId, limit = 10) {
  const { data } = await supabase
    .from('messages')
    .select('direction, text, created_at')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data || []).reverse();
}

async function generateBotReply(lead, newMessage, history, config) {
  const historyText = history
    .map(m => `${m.direction === 'in' ? 'Cliente' : 'DLS'}: ${m.text}`)
    .join('\n');

  const systemPrompt = `Eres el asistente virtual de ${config.company_name}, empresa especializada en remodelaciones en Chile con 6 años de experiencia.

Tu personalidad: profesional, cálido, directo. Respondes en español chileno natural (sin ser demasiado informal).

PRECIOS APROXIMADOS (siempre di que son rangos según materiales y terminaciones):
- Cocinas: ${config.price_cocina}
- Baños: ${config.price_bano}
- Quinchos: ${config.price_quincho}
- Estacionamientos: ${config.price_estac}
- Departamentos completos: ${config.price_depto}

PROCESO DLS:
1. Contacto inicial → 2. Visita en terreno (SIN COSTO) → 3. Presupuesto formal → 4. Proyecto

OBJETIVO DE CADA CONVERSACIÓN:
- Dar información del rango de precio si preguntan
- Invitar a una visita en terreno sin costo
- Pedir disponibilidad para la visita
- Si ya hay visita agendada: hacer seguimiento amable

REGLAS:
- Respuestas cortas (máximo 4 líneas)
- No inventes precios exactos
- Si preguntan por garantía, contrato o hay un reclamo → responde: "Para este tema te comunico directamente con nuestro equipo. ¿Me das tu disponibilidad?"
- Si ya respondiste sobre precios, no repitas, avanza al siguiente paso (agendar visita)
- Nunca digas que eres una IA a menos que te lo pregunten directamente

INFO DEL LEAD:
- Nombre: ${lead.name}
- Tipo de proyecto: ${lead.tipo || 'por definir'}
- Metros cuadrados: ${lead.m2 ? lead.m2 + 'm²' : 'por definir'}
- Zona: ${lead.zona || 'por definir'}
- Estado pipeline: ${['Contacto inicial','Cotizador web','Visita en terreno','Presupuesto enviado','Proyecto cerrado'][lead.pipe_step] || 'Contacto inicial'}`;

  const userContent = historyText
    ? `Historial:\n${historyText}\n\nNuevo mensaje del cliente: ${newMessage}`
    : `Primer mensaje del cliente: ${newMessage}`;

  const response = await claude.messages.create({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 300,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }]
  });

  return response.content[0].text;
}

async function processIncomingMessage(leadId, messageText, channel) {
  // 1. Obtener lead
  const { data: lead } = await supabase
    .from('leads').select('*').eq('id', leadId).single();

  if (!lead || !lead.bot_active) return null;

  // 2. Verificar si escalar
  if (shouldEscalate(messageText)) {
    // Marcar como sin responder para que el dueño lo vea
    await supabase.from('leads').update({
      status: 'seguimiento',
      unread: (lead.unread || 0) + 1
    }).eq('id', leadId);

    // Notificar al dueño (push notification)
    await notifyOwner(lead, messageText, '⚠️ Requiere atención');
    return null; // No responde el bot
  }

  // 3. Obtener historial y config
  const [history, config] = await Promise.all([
    getLeadHistory(leadId),
    getBotConfig()
  ]);

  // 4. Generar respuesta con IA
  const botReply = await generateBotReply(lead, messageText, history, config);

  // 5. Guardar respuesta en DB
  await supabase.from('messages').insert({
    lead_id: leadId,
    channel,
    direction: 'bot',
    text: botReply
  });

  // 6. Actualizar lead
  await supabase.from('leads').update({
    last_msg_at: new Date().toISOString(),
    unread: (lead.unread || 0) + 1
  }).eq('id', leadId);

  return botReply;
}

async function notifyOwner(lead, message, title) {
  // Aquí se enviaría push notification al dueño
  // Se implementa con Supabase Edge Functions o un servicio de push
  console.log(`ESCALAR: ${title} — ${lead.name}: ${message}`);
}

module.exports = { processIncomingMessage, shouldEscalate };
