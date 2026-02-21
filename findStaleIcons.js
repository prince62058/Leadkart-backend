const mongoose = require("mongoose");
require("dotenv").config();
const businessCategoryModel = require("./src/models/businessCategoryModel.js");

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const docs = await businessCategoryModel.find({ icon: /linodeobjects/ });
  console.log(`Found ${docs.length} documents with linodeobjects icons.`);
  if (docs.length > 0) {
    console.log("Samples:");
    docs
      .slice(0, 5)
      .forEach((d) => console.log(`Title: ${d.title}, Icon: ${d.icon}`));
  }
  process.exit(0);
}
check();
