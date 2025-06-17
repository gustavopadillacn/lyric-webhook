export default async function handler(req, res) {
  const AUTH_TOKEN = 'REMOTE_MD_CALLBACK_SECRET'; // Puedes cambiarlo si querés

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');

  if (token !== AUTH_TOKEN) {
    console.log('❌ Unauthorized webhook attempt');
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const payload = req.body;

  console.log('✅ Webhook received from Lyric:');
  console.log(JSON.stringify(payload, null, 2));

  return res.status(200).json({ success: true });
}
