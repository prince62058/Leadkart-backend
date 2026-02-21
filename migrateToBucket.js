const mongoose = require("mongoose");
require("dotenv").config();

const advertisementModel = require("./src/models/advertisementModel.js");
const RecentAdsDesignModel = require("./src/models/recentAdsDesignByLeadkarModel.js");
const simpleVideoModel = require("./src/models/simpleVideoModel.js");
const ugcModel = require("./src/models/ugcModel.js");
const voiceOverVideoModel = require("./src/models/voiceOverVideoModel.js");
const businessCategoryModel = require("./src/models/businessCategoryModel.js");
const homepageModel = require("./src/models/homepageModel.js");
const stateModel = require("./src/models/stateModel.js");
const countryModel = require("./src/models/countryModel.js");
const cityModel = require("./src/models/cityModel.js");
const commpanyModelV2 = require("./src/models/commpanyModelV2.js");
const notificationModel = require("./src/models/notificationModel.js");
const internalCampiagnModel = require("./src/models/internalCampiagnModel.js");
const offeringsModel = require("./src/models/offeringsModel.js");
const ImageBusinessModel = require("./src/models/ImageBusinessModel.js");

const MONGO_URI = process.env.MONGO_URI;
const BUCKET = process.env.LINODE_OBJECT_BUCKET || "satyakabir-bucket";
const ENDPOINT =
  process.env.LINODE_OBJECT_STORAGE_ENDPOINT || "sgp1.digitaloceanspaces.com";

const NEW_BASE_URL = `https://${BUCKET}.${ENDPOINT}/`;

async function migrate() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");

    const updateDocuments = async (Model, fields) => {
      try {
        const docs = await Model.find();
        console.log(
          `Processing ${docs.length} documents in ${Model.modelName || Model.collection.collectionName}`,
        );
        for (let doc of docs) {
          let update = {};
          let changed = false;
          for (let field of fields) {
            if (doc[field]) {
              let urlSuffix = null;
              if (doc[field].includes("linodeobjects.com/")) {
                urlSuffix = doc[field].split("linodeobjects.com/")[1];
              } else if (doc[field].includes("digitaloceanspaces.com/")) {
                urlSuffix = doc[field].split("digitaloceanspaces.com/")[1];
              } else if (doc[field].includes(".com/")) {
                urlSuffix = doc[field].split(".com/")[1];
              } else if (doc[field].includes("/videos/")) {
                urlSuffix = "LEADKART/VIDEO/" + doc[field].split("/videos/")[1];
              }

              if (urlSuffix) {
                update[field] = NEW_BASE_URL + urlSuffix;
                changed = true;
              }
            }
          }
          if (changed) {
            await Model.updateOne(
              { _id: doc._id },
              { $set: update },
              { runValidators: false },
            );
          }
        }
        console.log(
          `Finished ${Model.modelName || Model.collection.collectionName}`,
        );
      } catch (err) {
        console.error(
          `Error processing ${Model.modelName || Model.collection.collectionName}:`,
          err.message,
        );
      }
    };

    // Original Models
    await updateDocuments(advertisementModel, ["image"]);
    await updateDocuments(RecentAdsDesignModel, ["img"]);
    await updateDocuments(simpleVideoModel, ["thumbnail", "video"]);
    await updateDocuments(ugcModel, ["thumbnail", "video"]);
    await updateDocuments(voiceOverVideoModel, ["thumbnail", "video"]);

    // Business Category & Hierarchy
    await updateDocuments(businessCategoryModel, ["icon"]);
    await updateDocuments(stateModel, ["icon"]);
    await updateDocuments(countryModel, ["icon"]);
    await updateDocuments(cityModel, ["icon"]);

    // Additional Models with assets
    await updateDocuments(homepageModel, ["icon", "image"]);
    await updateDocuments(commpanyModelV2, ["icon"]);
    await updateDocuments(notificationModel, ["image"]);
    await updateDocuments(internalCampiagnModel, ["image"]);
    await updateDocuments(offeringsModel, ["image"]);
    await updateDocuments(ImageBusinessModel, ["image"]);

    console.log("Migration completed successfully");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

migrate();
