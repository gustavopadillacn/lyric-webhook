import { Client } from "@hubspot/api-client";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const AUTH_HEADER = req.headers.authorization || "";
  const TOKEN = process.env.REMOTE_MD_CALLBACK_SECRET;

  if (AUTH_HEADER !== `Bearer ${TOKEN}`) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const event = req.body;
    console.log("📥 Incoming Lyric Webhook Event:", JSON.stringify(event, null, 2));

    const eventType = event.event_type || "";
    const dependent = event.Dependents?.[0];

    if (!dependent) throw new Error("❌ No dependent info in payload");

    const dependentUserId = dependent.dependent_user_id;
    const statusId = dependent.status_id;
    const firstName = dependent.first_name;
    const lastName = dependent.last_name;

    if (!dependentUserId) throw new Error("❌ Missing dependent_user_id");

    const hs = new Client({ accessToken: process.env.HUBSPOT_API_KEY });

    // 🔍 Buscar contacto por dependent_user_id
    const searchResp = await hs.crm.contacts.searchApi.doSearch({
      filterGroups: [
        {
          filters: [
            {
              propertyName: "dependent_user_id",
              operator: "EQ",
              value: `${dependentUserId}`,
            },
          ],
        },
      ],
      properties: ["dependent_status_id", "firstname", "lastname"],
      limit: 1,
    });

    const match = searchResp.results?.[0];
    if (!match) throw new Error(`❌ No contact found with dependent_user_id ${dependentUserId}`);

    const contactId = match.id;
    const existing = match.properties;

    let updatePayload = {};

    switch (eventType) {
      case "census.dependent.status.update":
        if (!statusId) throw new Error("❌ Missing status_id for status update");
        if (existing.dependent_status_id === `${statusId}`) {
          console.log(`⏭ No update needed. Status already ${statusId}`);
        } else {
          updatePayload.dependent_status_id = `${statusId}`;
          console.log(`✅ Will update status to ${statusId}`);
        }
        break;

      case "census.dependent.update":
      case "census.dependent.add":
        if (firstName && firstName !== existing.firstname) {
          updatePayload.firstname = firstName;
        }
        if (lastName && lastName !== existing.lastname) {
          updatePayload.lastname = lastName;
        }
        console.log(`✅ Will update name fields if needed`);
        break;

      default:
        console.log(`⚠️ Unhandled event type: ${eventType}`);
        return res.status(200).json({ message: "Unhandled event" });
    }

    // 🔃 Hacer update si hay cambios
    if (Object.keys(updatePayload).length > 0) {
      await hs.crm.contacts.basicApi.update(contactId, { properties: updatePayload });
      console.log(`🎯 Updated contact ${contactId}:`, updatePayload);
    } else {
      console.log("ℹ️ No updates required.");
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("❌ Error handling Lyric webhook:", error);
    return res.status(500).json({ message: error.message });
  }
}


