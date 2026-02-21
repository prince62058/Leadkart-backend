const mongoose = require("mongoose");
require("dotenv").config();
const businessCategoryModel = require("./src/models/businessCategoryModel.js");

const BUCKET = process.env.LINODE_OBJECT_BUCKET || "satyakabir-bucket";
const ENDPOINT =
  process.env.LINODE_OBJECT_STORAGE_ENDPOINT || "sgp1.digitaloceanspaces.com";
const NEW_BASE_URL = `https://${BUCKET}.${ENDPOINT}/`;

async function migrate() {
  await mongoose.connect(process.env.MONGO_URI);
  const docs = await businessCategoryModel.find({ icon: /linodeobjects/ });
  console.log(`Migrating ${docs.length} documents...`);

  for (let doc of docs) {
    let oldIcon = doc.icon;
    let urlSuffix = null;
    if (oldIcon.includes("linodeobjects.com/")) {
      urlSuffix = oldIcon.split("linodeobjects.com/")[1];
    }

    if (urlSuffix) {
      const newIcon = NEW_BASE_URL + urlSuffix;
      await businessCategoryModel.updateOne(
        { _id: doc._id },
        { $set: { icon: newIcon } },
      );
      // console.log(`Updated ${doc.title}: ${newIcon}`);
    } else {
      console.log(`Skipped ${doc.title}: No suffix found for ${oldIcon}`);
    }
  }

  console.log("Migration finished.");
  process.exit(0);
}
migrate();
