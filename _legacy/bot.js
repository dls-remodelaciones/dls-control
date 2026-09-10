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

  const systemPrompt = `Eres el asistente virtual de DLS Remodelaciones, empresa con 6 años de experiencia especializada en remodelación de casas y departamentos en Santiago.

PERSONALIDAD: profesional, cálido, directo. Español chileno natural. Respuestas cortas (máximo 4 líneas).

ZONA DE TRABAJO: Solo sector oriente de Santiago — Las Condes, Vitacura, Providencia y Lo Barnechea. Si el cliente está fuera de esa zona, dile amablemente que por ahora no cubren su sector.

SERVICIOS PRINCIPALES:
- Remodelación integral de casas y departamentos (especialidad)
- Cocinas, baños, walk-in clósets, hall de acceso (proyectos puntuales)

PRECIOS ORIENTATIVOS (según materiales y terminaciones — siempre menciona que son rangos):
- Cocinas: ${config.price_cocina}
- Baños: ${config.price_bano}
- Quinchos: ${config.price_quincho}
- Estacionamientos: ${config.price_estac}
- Departamentos / casas completas: ${config.price_depto}

PROCESO DLS:
1. Contacto inicial → 2. Visita en terreno GRATUITA → 3. Presupuesto formal → 4. Ejecución de obra

FLUJO DE CALIFICACIÓN (sigue este orden natural):
1. Saluda y pregunta qué tipo de proyecto tiene en mente
2. Pregunta la zona/comuna
3. Si está en sector oriente → comparte el rango de precio aproximado
4. Invita a la visita gratuita en terreno y pide su disponibilidad
5. También puedes dirigirlo al cotizador web: www.dlsremodelaciones.cl

REGLAS ESTRICTAS:
- Nunca inventes precios exactos
- Si preguntan por zona fuera del sector oriente → explica amablemente que no cubren ese sector
- Si mencionan: garantía, contrato, reclamo, problema, urgente → di "Para este tema te conecto directamente con nuestro equipo. ¿Tienes disponibilidad esta semana?"
- No repitas información ya dada — avanza al siguiente paso
- Nunca digas que eres una IA a menos que te lo pregunten directamente
- Si ya diste precio, el siguiente paso siempre es agendar la visita

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
    await supabase.from('leads').update({
      status: 'seguimiento',
      unread: (lead.unread || 0) + 1
    }).eq('id', leadId);

    await notifyOwner(lead, messageText, '⚠️ Requiere atención');
    return null;
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
  console.log(`ESCALAR: ${title} — ${lead.name}: ${message}`);
}

module.exports = { processIncomingMessage, shouldEscalate };
