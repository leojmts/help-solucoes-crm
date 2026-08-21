// Webhook oficial do WhatsApp Cloud API (Meta)
// Vercel Serverless Function

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

    if (!verifyToken) {
      console.error('WHATSAPP_VERIFY_TOKEN não configurado no Vercel.');
      return res.status(500).send('Webhook não configurado');
    }

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('Webhook do WhatsApp verificado com sucesso.');
      return res.status(200).send(challenge);
    }

    return res.status(403).send('Token de verificação inválido');
  }

  if (req.method === 'POST') {
    // Nesta primeira etapa apenas confirmamos o recebimento.
    // Na próxima etapa vamos interpretar mensagens e salvar no Supabase.
    console.log('Evento recebido do WhatsApp:', JSON.stringify(req.body));
    return res.status(200).json({ received: true });
  }

  return res.status(405).json({ error: 'Método não permitido' });
}
