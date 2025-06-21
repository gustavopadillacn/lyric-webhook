import { Client } from "@hubspot/api-client";

export default async function handler(req, res) {
  console.log("🚀 Webhook function reached!");

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const AUTH_HEADER = req.headers.authorization || "";
  const TOKEN = "REMOTE_MD_CALLBACK_SECRET"; // Hardcoded as per agreement

  console.log("🔐 HEADER recibido:", AUTH_HEADER);
  console.log("🔐 TOKEN esperado:", `Bearer ${TOKEN}`);

  if (AUTH_HEADER !== `Bearer ${TOKEN}`) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const event = req.body;
    console.log("📥 Incoming Lyric Webhook Event:", JSON.stringify(event, null, 2));

    const eventType = event.event_type || event.event || "";
    const dependent = event.Dependents?.[0] || event;

    if (!dependent) throw new Error("❌ No dependent info in payload");

    const dependentUserId = dependent.dependent_user_id || dependent.userId;
    if (!dependentUserId) throw new Error("❌ Missing dependent_user_id");

    const hs = new Client({ accessToken: process.env.HUBSPOT_API_KEY });

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
      properties: [
        "dependent_status_id",
        "firstname",
        "lastname",
        "address",
        "address2",
        "city",
        "state_id",
        "zipcode",
        "timezone_id",
        "dob",
        "relationshipid"
      ],
      limit: 1,
    });

    const match = searchResp.results?.[0];
    if (!match) throw new Error(`❌ No contact found with dependent_user_id ${dependentUserId}`);

    const contactId = match.id;
    const existing = match.properties;
    const updatePayload = {};

    // Format DOB before comparison
    if (dependent.dob) {
      const dobDate = new Date(dependent.dob);
      dependent.dob = dobDate.toISOString().split("T")[0]; // yyyy-mm-dd
    }

    // Map Lyric fields to HubSpot properties
    const fieldMap = {
      first_name: "firstname",
      last_name: "lastname",
      status_id: "dependent_status_id",
      address: "address",
      address2: "address2",
      city: "city",
      state_id: "state_id",
      zipCode: "zipcode",
      timezone_id: "timezone_id",
      dob: "dob",
      dependentRelationship_id: "relationshipid"
    };

    for (const [lyricField, hubspotField] of Object.entries(fieldMap)) {
      const incomingValue = dependent[lyricField];
      const existingValue = existing[hubspotField];
      if (
        incomingValue !== undefined &&
        `${incomingValue}` !== `${existingValue}`
      ) {
        updatePayload[hubspotField] = `${incomingValue}`;
      }
    }

    if (Object.keys(updatePayload).length > 0) {
      await hs.crm.contacts.basicApi.update(contactId, {
        properties: updatePayload,
      });
      console.log(`🎯 Updated contact ${contactId}:`, updatePayload);
    } else {
      console.log("ℹ️ No updates required.");
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("❌ Error handling Lyric webhook:", error);
    return res.status(500).json({ message: `❌ Error: ${error.message}` });
  }
}




