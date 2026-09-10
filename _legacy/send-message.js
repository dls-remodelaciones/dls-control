// ============================================================
// DLS Control — Enviar mensaje manual desde el panel
// POST /api/send-message
// Body: { leadId, text }
// ============================================================

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { leadId, text } = req.body;
  if (!leadId || !text) return res.status(400).json({ error: 'leadId y text requeridos' });

  const { data: lead } = await supabase
    .from('leads').select('*').eq('id', leadId).single();

  if (!lead) return res.status(404).json({ error: 'Lead no encontrado' });

  // 1. Guardar en DB
  await supabase.from('messages').insert({
    lead_id:   leadId,
    channel:   lead.channel,
    direction: 'out',
    text
  });

  // 2. Enviar por el canal correspondiente
  let ok = false;
  if (lead.channel === 'wa') {
    ok = await sendWhatsApp(lead.phone, text);
  } else if (lead.channel === 'ig') {
    ok = await sendInstagram(lead.phone, text); // phone = ig_user_id
  } else if (lead.channel === 'em') {
    ok = await sendEmail(lead.email, lead.name, text);
  }

  // 3. Desactivar bot si el dueño interviene (opcional)
  // await supabase.from('leads').update({ bot_active: false }).eq('id', leadId);

  return res.status(200).json({ ok });
};

async function sendWhatsApp(to, text) {
  const r = await fetch(
    `https://graph.facebook.com/v19.0/${process.env.WA_PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.WA_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to, type: 'text', text: { body: text }
      })
    }
  );
  return r.ok;
}

async function sendInstagram(igUserId, text) {
  const r = await fetch('https://graph.facebook.com/v19.0/me/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.IG_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ recipient: { id: igUserId }, message: { text } })
  });
  return r.ok;
}

async function sendEmail(to, name, text) {
  // Implementar con Resend.com (gratis hasta 3000 emails/mes)
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from:    'DLS Remodelaciones <contacto@dlsremodelaciones.cl>',
      to:      [to],
      subject: `Re: Tu consulta de remodelación — DLS`,
      text
    })
  });
  return r.ok;
}
