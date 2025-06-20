import { Client } from "@hubspot/api-client";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const AUTH_HEADER = req.headers.authorization || "";
  const TOKEN = process.env.REMOTE_MD_CALLBACK_SECRET; // ✅ correctamente leído del entorno

  if (AUTH_HEADER !== `Bearer ${TOKEN}`) {
    return res.status(401).json({ message: "Unauthorized" });
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
    const statusId = dependent.status_id;

    if (!dependentUserId) throw new Error(`❌ Missing dependent_user_id`);
    if (!statusId) throw new Error(`❌ Missing status_id`);

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
      properties: ["dependent_status_id"],
      limit: 1
    });

    const match = searchResp.results?.[0];
    if (!match) throw new Error(`No contact found with dependent_user_id ${dependentUserId}`);

    if (eventType === "census.dependent.status.update") {
      await hs.crm.contacts.basicApi.update(match.id, {
        properties: {
          dependent_status_id: `${statusId}`
        }
      });

      console.log(`✅ Updated contact ${match.id} with status_id ${statusId}`);
    } else {
      console.log(`ℹ️ Event received but not handled: ${eventType}`);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("❌ Error handling Lyric webhook:", error);
    return res.status(500).json({ message: error.message });
  }
}


