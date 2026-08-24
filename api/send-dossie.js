const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!token || !supabaseUrl || !supabaseKey) return res.status(401).json({ error: 'Sessão inválida.' });
  const auth = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: supabaseKey, Authorization: `Bearer ${token}` } });
  if (!auth.ok) return res.status(401).json({ error: 'Sessão expirada.' });
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) return res.status(503).json({ error: 'O envio automático ainda precisa da chave e do remetente Resend na Vercel.' });
  const { to, subject, text } = req.body || {};
  if (!EMAIL_RE.test(String(to || '')) || !subject || !text || String(text).length > 50000) return res.status(400).json({ error: 'Dados do e-mail inválidos.' });
  const envio = await fetch('https://api.resend.com/emails', { method:'POST', headers:{ Authorization:`Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type':'application/json' }, body:JSON.stringify({ from:process.env.RESEND_FROM_EMAIL, to:[to], subject:String(subject).slice(0,180), text:String(text) }) });
  const retorno = await envio.json().catch(() => ({}));
  if (!envio.ok) return res.status(502).json({ error: retorno.message || 'Falha no provedor de e-mail.' });
  return res.status(200).json({ ok:true, id:retorno.id });
}
