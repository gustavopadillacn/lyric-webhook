// 🔔 Webhook handler for Lyric callback events
// Path: /api/lyric-dependent-webhook

import { Client } from "@hubspot/api-client";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const authHeader = req.headers['authorization'];
  if (authHeader !== 'Bearer REMOTE_MD_CALLBACK_SECRET') {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const event = req.body;
    console.log("📥 Lyric Webhook Event:", JSON.stringify(event, null, 2));

    const hs = new Client({ accessToken: process.env.HUBSPOT_API_KEY });

    // Basic routing by event type
    const eventType = event.event_type || '';
    const dependent = event.Dependents?.[0];
    if (!dependent) throw new Error('No dependent info in payload');

    const dependentUserId = dependent.dependent_user_id;
    if (!dependentUserId) throw new Error('Missing dependent_user_id');

    // Find contact by lyric dependent_user_id
    const searchResp = await hs.crm.contacts.searchApi.doSearch({
      filterGroups: [
        {
          filters: [
            {
              propertyName: "dependent_user_id",
              operator: "EQ",
              value: `${dependentUserId}`
            }
          ]
        }
      ],
      properties: ["firstname", "lastname", "dependent_status_id"],
      limit: 1
    });

    const match = searchResp.results?.[0];
    if (!match) throw new Error(`No contact found with dependent_user_id ${dependentUserId}`);

    // Handle status update
    if (eventType === 'census.dependent.status.update' && dependent.status_id) {
      await hs.crm.contacts.basicApi.update(match.id, {
        properties: {
          dependent_status_id: `${dependent.status_id}`
        }
      });

      console.log(`✅ Updated contact ${match.id} with status_id ${dependent.status_id}`);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("❌ Error handling Lyric webhook:", error);
    return res.status(500).json({ message: error.message });
  }
}
