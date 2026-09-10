// ============================================================
// DLS Control — Webhook Instagram DMs (Meta Graph API)
// ============================================================

const { createClient } = require('@supabase/supabase-js');
const { processIncomingMessage } = require('./bot');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const VERIFY_TOKEN = process.env.IG_VERIFY_TOKEN;

module.exports = async function handler(req, res) {

  // ── VERIFICACIÓN ─────────────────────────────────────────
  if (req.method === 'GET') {
    const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).json({ error: 'Forbidden' });
  }

  // ── DM ENTRANTE ──────────────────────────────────────────
  if (req.method === 'POST') {
    try {
      const body = req.body;
      const entry = body?.entry?.[0];
      const messaging = entry?.messaging?.[0];

      if (!messaging?.message?.text) return res.status(200).json({ ok: true });

      const igUserId = messaging.sender.id;
      const text = messaging.message.text;
      const msgId = messaging.message.mid;

      // Obtener nombre del usuario de Instagram
      const profileResp = await fetch(
        `https://graph.facebook.com/v19.0/${igUserId}?fields=name,username&access_token=${process.env.IG_ACCESS_TOKEN}`
      );
      const profile = await profileResp.json();
      const igHandle = profile.username ? `@${profile.username}` : igUserId;
      const name = profile.name || igHandle;

      // 1. Buscar o crear lead
      let { data: lead } = await supabase
        .from('leads')
        .select('id, bot_active')
        .eq('phone', igUserId)  // usamos phone para almacenar el IG user ID
        .eq('channel', 'ig')
        .single();

      if (!lead) {
        const { data: newLead } = await supabase
          .from('leads')
          .insert({ name, phone: igUserId, ig_handle: igHandle, channel: 'ig', status: 'nuevo' })
          .select()
          .single();
        lead = newLead;
      }

      // 2. Guardar mensaje
      await supabase.from('messages').insert({
        lead_id:   lead.id,
        channel:   'ig',
        direction: 'in',
        text,
        meta: { message_id: msgId, ig_user_id: igUserId }
      });

      // 3. Bot responde
      const botReply = await processIncomingMessage(lead.id, text, 'ig');

      // 4. Enviar respuesta por Instagram
      if (botReply) {
        await sendInstagramMessage(igUserId, botReply);
      }

      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('IG webhook error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};

async function sendInstagramMessage(recipientId, text) {
  const resp = await fetch(
    `https://graph.facebook.com/v19.0/me/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.IG_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message:   { text }
      })
    }
  );
  if (!resp.ok) {
    console.error('Error enviando IG:', await resp.text());
  }
}
