// /api/lyric-dependent-webhook.js
export default async function handler(req, res) {
  const secret = req.headers.authorization;

  if (secret !== 'Bearer REMOTE_MD_CALLBACK_SECRET') {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const event = req.body?.event_type;
  const dependentId = req.body?.dependent_user_id;

  if (!event || !dependentId) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  console.log(`📩 Webhook received: ${event}, Dependent ID: ${dependentId}`);

  // Aquí va la lógica para enviar a HubSpot
  // Por ahora solo confirmamos recepción
  return res.status(200).json({ success: true });
}
