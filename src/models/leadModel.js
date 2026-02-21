const mongoose = require("mongoose");
const ObjectId = mongoose.Schema.Types.ObjectId;

const leadModel = new mongoose.Schema(
  {
    businessId: {
      type: ObjectId,
      ref: "business",
    },
    adsetId: { type: String, default: null },
    internalCampiagnId: {
      type: ObjectId,
      ref: "internalCampiagnModel",
    },
    adId: { type: String, default: null },
    pageId: { type: String, default: null },
    leadgenId: { type: String, default: null },
    formId: { type: String, default: null },
    createdTime: { type: String, default: null },
    leadSource: { type: String, default: "META", enum: ["META", "GOOGLE"] },
    userContactNumber: { type: String, default: null },
    name: { type: String, default: null },
    email: { type: String, default: null },
    whatsappNumber: { type: String, default: null },
    note: String,
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "userModel",
    },
    followUpDate: String,
    followUpTime: String,
    followUpNote: { type: String},
    seen: { type: Boolean, default: false },
    leadStatus: {
      type: String,
      default: "NEW",
      enum: [
        "NEW",
        "INTERESTED",
        "NOT_INTERESTED",
        "CONVERTED",
        "LOST",
        "VISITED",
        "NOT_ANSWERED",
        "IN_PROGRESS",
        "UNQUALIFIED",
        "NOT_CONNECTED",
      ],
    },
	document:[String],
    rescentActivity: [{ activity: String, date: String }], // activity: "call/whatsapp/email/meeting", date: "yyyy-mm-dd"
    //"new/ interested/not interested/ converted/lost/ visited/ not answered/ in progress"
  },
  { timestamps: true }
);

module.exports = mongoose.model("leadModel", leadModel);
