const mongoose = require("mongoose");
require("dotenv").config();
const businessCategoryModel = require("./src/models/businessCategoryModel.js");

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const docs = await businessCategoryModel.find().limit(5);
  console.log("Database Samples:");
  docs.forEach((d) => console.log(`Title: ${d.title}, Icon: ${d.icon}`));
  process.exit(0);
}
check();
