const { createClient } = require('@supabase/supabase-js');
const { generateBotResponse } = require('./bot');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === process.env.WA_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Forbidden');
  }

  if (req.method === 'POST') {
    try {
      const body = req.body;
      if (!body.object || body.object !== 'whatsapp_business_account') {
        return res.status(200).send('OK');
      }
      const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      if (!message || !message.text?.body) {
        return res.status(200).send('OK');
      }
      const from = message.from;
      const text = message.text.body;
      const phoneNumberId = process.env.WA_PHONE_NUMBER_ID;
      const accessToken = process.env.WA_ACCESS_TOKEN;

      await supabase.from('messages').insert({
        phone: from,
        message: text,
        direction: 'inbound',
        channel: 'whatsapp',
        created_at: new Date().toISOString()
      });

      const botReply = await generateBotResponse(text, from);

      await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: from,
          type: 'text',
          text: { body: botReply }
        })
      });

      await supabase.from('messages').insert({
        phone: from,
        message: botReply,
        direction: 'outbound',
        channel: 'whatsapp',
        created_at: new Date().toISOString()
      });

      return res.status(200).send('OK');
    } catch (error) {
      console.error('Error:', error);
      return res.status(200).send('OK');
    }
  }

  return res.status(405).send('Method Not Allowed');
};
