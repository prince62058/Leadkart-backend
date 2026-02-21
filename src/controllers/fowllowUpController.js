const leadModel = require("../models/leadModel");
const {
  sendNotificationToMultipleToken,
  sendNotificationToMultipleTokens,
} = require("../controllers/notificationController");

const notifiedBeforeSet = new Set();
const notifiedAtTimeSet = new Set();

setInterval(() => {
  // console.log("Running follow-up check...");
  const now = new Date();

  const day = now.getDate();
  const month = now.toLocaleString("default", { month: "short" }).toUpperCase(); // e.g. "JAN", "FEB", "JUN"
  const year = now.getFullYear();
  const todayStr = `${day} ${month} ${year}`; // e.g. 18 JUN 2025
  leadModel
    .find()
    .then((leads) => {
      leads.forEach((lead) => {
        
        const dateStr = lead.followUpDate?.trim().toUpperCase();
        const rawTimeStr = lead.followUpTime?.trim();
        // console.log("Raw time string:", rawTimeStr);

        if (dateStr != todayStr) return;
        // Normalize time (e.g., 01:10pm -> 01:10 PM)
        const timeStr = rawTimeStr
          .replace(/([0-9])([aApP][mM])$/, "$1 $2")
          .toUpperCase();
        const parts = timeStr.split(/[: ]/);
        if (parts.length < 3) return;
        let [hour, minute, ampm] = parts;
        hour = parseInt(hour);
        minute = parseInt(minute);

        if (isNaN(hour) || isNaN(minute)) return;

        if (ampm === "PM" && hour !== 12) hour += 12;
        if (ampm === "AM" && hour === 12) hour = 0;

        const targetTime = new Date(year, now.getMonth(), day, hour, minute);
        const diff = Math.round((targetTime - now) / 60000); // difference in minutes

        leadModel
          .findById(lead._id)
          .populate({
            path: "businessId",
            populate: { path: "userId" },
          })
          .then((populated) => {
            const token = populated?.businessId?.userId?.fcm;

            if (!token) {
              console.log(`No FCM token for lead ${lead._id}`);
              return;
            }

            const id = lead._id.toString();

            if (diff === 10 && !notifiedBeforeSet.has(id)) {
              let notificationPayload = {
                customKey:  "default",
                type: "FollowUp",
                title: "Follow Up Reminder",
                description: "You have a pending follow-up reminder In 10 min",
              };
              console.log("Sending 10-minute reminder to:", token);
              let arr = [token];
              sendNotificationToMultipleToken(
                arr,
                notificationPayload
              );
              notifiedBeforeSet.add(id);
            }

            if (diff === 0 && !notifiedAtTimeSet.has(id)) {
              console.log("Sending ON-TIME reminder to:", token);
              let arr = [token];
                let notificationPayload = {
                customKey:  "default",
                type: "FollowUp",
                title: "Follow Up Reminder",
                description: "🔔 It's time for your follow-up!",
              };
              sendNotificationToMultipleToken(
                arr,
                notificationPayload
              );
              notifiedAtTimeSet.add(id);
            }
          })
          .catch((err) => {
            console.error("Populate error:", err);
          });
      });
    })
    .catch((err) => {
      console.error("Lead find error:", err);
    });
}, 1000); // Every second

