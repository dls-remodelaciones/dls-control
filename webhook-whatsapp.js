// ============================================================
// DLS Control — Webhook WhatsApp (Meta Cloud API)
// ============================================================

const { createClient } = require('@supabase/supabase-js');
const { processIncomingMessage } = require('./bot');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const VERIFY_TOKEN = process.env.WA_VERIFY_TOKEN; // definir en Vercel

module.exports = async function handler(req, res) {

  // ── VERIFICACIÓN del webhook (GET) ────────────────────────
  if (req.method === 'GET') {
    const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).json({ error: 'Forbidden' });
  }

  // ── MENSAJE ENTRANTE (POST) ───────────────────────────────
  if (req.method === 'POST') {
    try {
      const body = req.body;
      const entry = body?.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;
      const messages = value?.messages;

      if (!messages?.length) return res.status(200).json({ ok: true });

      for (const msg of messages) {
        if (msg.type !== 'text') continue;

        const phone = msg.from;           // número del cliente
        const text  = msg.text?.body;
        const msgId = msg.id;
        const contact = value?.contacts?.[0];
        const name  = contact?.profile?.name || phone;

        // 1. Buscar o crear lead
        let { data: lead } = await supabase
          .from('leads')
          .select('id, bot_active')
          .eq('phone', phone)
          .eq('channel', 'wa')
          .single();

        if (!lead) {
          const { data: newLead } = await supabase
            .from('leads')
            .insert({ name, phone, channel: 'wa', status: 'nuevo' })
            .select()
            .single();
          lead = newLead;
        }

        // 2. Guardar mensaje entrante
        await supabase.from('messages').insert({
          lead_id:   lead.id,
          channel:   'wa',
          direction: 'in',
          text,
          meta: { message_id: msgId }
        });

        // 3. Bot responde
        const botReply = await processIncomingMessage(lead.id, text, 'wa');

        // 4. Si hay respuesta del bot, enviar por WhatsApp
        if (botReply) {
          await sendWhatsAppMessage(phone, botReply);
        }
      }

      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('WA webhook error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};

async function sendWhatsAppMessage(to, text) {
  const resp = await fetch(
    `https://graph.facebook.com/v19.0/${process.env.WA_PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.WA_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text }
      })
    }
  );
  if (!resp.ok) {
    console.error('Error enviando WA:', await resp.text());
  }
}
