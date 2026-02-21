const mongoose = require("mongoose");
require("dotenv").config();

const simpleVideoModel = require("./src/models/simpleVideoModel");
const ugcModel = require("./src/models/ugcModel");
const voiceOverVideoModel = require("./src/models/voiceOverVideoModel");

const MONGO_URI = process.env.MONGO_URI;
const LOCAL_IP = "172.20.10.2";
const PORT = process.env.PORT || 9898;
const BASE_URL = `http://${LOCAL_IP}:${PORT}/videos/`;

const videos = [
  "1761371997880_1761371952057-f51cb8.mp4",
  "temp_video_1746094163110.mp4",
  "temp_video_1746094298958.mp4",
  "temp_video_1746094882236.mp4",
  "temp_video_1746094933119.mp4",
  "temp_video_1746094970112.mp4",
  "temp_video_1746095922208.mp4",
  "temp_video_1746096376235.mp4",
  "temp_video_1746098864470.mp4",
];

async function updateVideos() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");

    const updateModel = async (Model, name) => {
      const docs = await Model.find();
      console.log(`Updating ${docs.length} documents in ${name}`);
      for (let i = 0; i < docs.length; i++) {
        const videoName = videos[i % videos.length];
        docs[i].video = BASE_URL + videoName;
        await docs[i].save();
      }
      console.log(`Updated ${name}`);
    };

    await updateModel(simpleVideoModel, "simpleVideoModel");
    await updateModel(ugcModel, "ugcModel");
    await updateModel(voiceOverVideoModel, "voiceOverVideoModel");

    console.log("All videos updated successfully");
    process.exit(0);
  } catch (error) {
    console.error("Error updating videos:", error);
    process.exit(1);
  }
}

updateVideos();
