const cron = require("node-cron");
const axios = require("axios");
const leadModel = require("../models/leadModel");
const leadFormsModel = require("../models/leadFormsModel");
const internalCampiagnModel = require("../models/internalCampiagnModel");
const business = require("../models/businessModel");
const userModel = require("../models/userModel");
const { sendNotificationToMultipleToken } = require("./notificationController");

// ✅ Prevent multiple schedulers from starting

// ⏱ Run every hour at 20th minute (e.g., 1:20, 2:20, etc.)
cron.schedule("10 * * * *", async () => {
  console.log("🚀 Scheduler started");


  try {
    const businessData = await internalCampiagnModel
      .find({
        addTypeId:"676bd7b708acbc4f1ca6a8b6",
        status: "ACTIVE",
      })
      .populate("businessId", "pageId pageAccessToken lastSchedulerRunTime metaAdsetId mainAdId userId")
      .sort({ createdAt: -1 });

    for (const busines of businessData) {
      const pageAccessToken = busines?.businessId?.pageAccessToken;
      const lastSchedulerRunTime = busines?.businessId?.lastSchedulerRunTime;
      const pageId = busines?.businessId?.pageId;
      // console.log(`📅 Processing business: ${busines._id} - Page ID: ${pageId}  ===. ${pageAccessToken}`);
      try {
        const fbLeads = await fetchLeadsFromMetaAPI(pageId, pageAccessToken, lastSchedulerRunTime);

        if (fbLeads.length > 0) {
          await saveLeadsIfNotExist(fbLeads, busines);
        }
      } catch (error) {
        console.error("❌ Error fetching leads from Meta API:", error.message);
      }
    }
  } catch (error) {
    console.error("❌ Error in scheduler main try block:", error.message);
  }

  console.log("✅ Scheduler finished");
});

// -------------------------------------------
// 🔁 HELPER FUNCTIONS BELOW
// -------------------------------------------

async function fetchLeadsFromMetaAPI(pageId, pageAccessToken) {
  try {
    const forms = await fetchLeadForms(pageId, pageAccessToken);
    let leads = [];
    let f = [forms[0]]
    for (const form of f) {
      const formId = form.id;
      const leadsForForm = await fetchLeads(formId, pageAccessToken);
      const formData = await leadFormsModel.findOne({ formId }).select("internalCampiagnId");
      // const filteredLeads = leadsForForm.filter((lead) => {
      //   const createdTime = new Date(lead.created_time).getTime();
      //   return !lastSchedulerRunTime || createdTime > new Date(lastSchedulerRunTime * 1000).getTime();
      // });

      const enrichedLeads = leadsForForm.map((lead) => ({
        ...lead,
        internalCampiagnId: formData?.internalCampiagnId || null,
      }));

      leads.push(...enrichedLeads);
    }

    return leads;
  } catch (error) {
    console.error("❌ Error in fetchLeadsFromMetaAPI:", error.message);
    return [];
  }
}

async function saveLeadsIfNotExist(leads, busines) {
  let newLeadsCount = 0;
  console.log(`📊 Saving ${leads.length} leads for business: ${busines._id}`);
  for (const lead of leads) {
    try {
      if (!lead?.id) continue;

      const result = await leadModel.updateOne(
        { leadgenId: lead.id },
        {
          $setOnInsert: {
            businessId: busines.businessId,
            adsetId: busines.metaAdsetId || null,
            internalCampiagnId: lead?.internalCampiagnId || null,
            adId: busines.mainAdId || null,
            pageId: busines.pageId,
            leadgenId: lead.id,
            createdTime: lead.created_time,
            leadSource: "META",
            leadStatus: "NEW",
            userContactNumber: lead?.phone_number,
            name: lead?.full_name,
            email: lead?.email,
            whatsappNumber: lead?.whatsapp_number,
          },
        },
        { upsert: true }
      );

      if (result.upsertedCount > 0) {
        console.log("✅ New Lead saved:", lead.id);
        newLeadsCount++;
      }
    } catch (err) {
      console.error("❌ Error saving lead:", err.message);
    }
  }

  if (newLeadsCount > 0) {
    const notification = {
      title: "New Lead Received",
      description: `You have ${newLeadsCount} new lead(s) from your ads`,
      customData: "default",
    };
    await sendPushNotification(busines, notification, newLeadsCount);
  }
}

async function fetchLeadForms(pageId, accessToken) {
  const url = `https://graph.facebook.com/v19.0/${pageId}/leadgen_forms`;
  const response = await axios.get(url, {
    params: { access_token: accessToken },
  });
  return response.data.data || [];
}

async function fetchLeads(formId, accessToken, afterCursor = null) {
  const leads = [];
  let nextCursor = afterCursor;

  do {
    const response = await axios.get(`https://graph.facebook.com/v21.0/${formId}/leads`, {
      params: {
        access_token: accessToken,
        limit: 500,
        after: nextCursor,
      },
    });

    for (const lead of response.data.data) {
      const entry = { id: lead.id, created_time: lead.created_time };
      if (lead.field_data) {
        lead.field_data.forEach((field) => {
          entry[field?.name] = field?.values?.join(", ");
        });
      }
      leads.push(entry);
    }

    nextCursor = response.data.paging?.cursors?.after || null;
  } while (nextCursor);

  return leads;
}

async function sendPushNotification(campaign, notification, newLeadsCount) {
  try {
    const busines = await business.findById(campaign._id);
    const user = await userModel.findById(busines?.businessId?.userId).select("fcm").lean();

    if (user?.fcm) {
      await sendNotificationToMultipleToken([user.fcm], notification, newLeadsCount);
    } else {
      console.warn(`⚠️ No FCM token found for user ${busines?.businessId?.userId}`);
    }
  } catch (err) {
    console.error("❌ Error sending notification:", err.message);
  }
}
