import { Client } from "@hubspot/api-client";

export default async function handler(req, res) {
  console.log("🚀 Webhook function reached!");

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const AUTH_HEADER = req.headers.authorization || "";
  const TOKEN = "REMOTE_MD_CALLBACK_SECRET"; // hardcoded as agreed with Lyric

  if (AUTH_HEADER !== `Bearer ${TOKEN}`) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const event = req.body;
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
        "firstname", "lastname", "dependent_status_id", "address", "address2", "city",
        "state_id", "zip_code", "dob", "timezone_id", "relationship_id"
      ],
      limit: 1,
    });

    const match = searchResp.results?.[0];
    if (!match) throw new Error(`❌ No contact found with dependent_user_id ${dependentUserId}`);

    const contactId = match.id;
    const existing = match.properties;
    let updatePayload = {};

    const toUpdate = {
      firstname: dependent.first_name || dependent.firstName,
      lastname: dependent.last_name || dependent.lastName,
      dependent_status_id: dependent.status_id,
      address: dependent.address,
      address2: dependent.address2,
      city: dependent.city,
      state_id: `${dependent.state_id}`,
      zip_code: dependent.zipCode || dependent.zipcode,
      timezone_id: `${dependent.timezone_id}`,
      dob: formatDate(dependent.dob),
      relationship_id: `${dependent.relationship_id || dependent.relationshipId}`,
    };

    for (const [field, newValue] of Object.entries(toUpdate)) {
      if (
        newValue &&
        newValue !== "" &&
        newValue !== existing[field]
      ) {
        updatePayload[field] = newValue;
      }
    }

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

function formatDate(input) {
  if (!input) return undefined;
  try {
    if (typeof input === "number") {
      const d = new Date(input);
      return d.toISOString().split("T")[0];
    }
    if (typeof input === "string" && input.includes("/")) {
      const [mm, dd, yyyy] = input.split("/");
      return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
    }
    return input; // Assume already in yyyy-mm-dd
  } catch {
    return undefined;
  }
}



