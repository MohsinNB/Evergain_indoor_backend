import mongoose from "mongoose";
import { VideoModel } from "../src/modules/video/video.models";
import { CategoryWordModel } from "../src/modules/categoryword/categoryword.models";
import config from "../src/config";

async function checkVideos() {
  await mongoose.connect(config.database_url as string);
  console.log("Connected to DB");

  const categories = await CategoryWordModel.find({});
  console.log("Categories found:", categories.map(c => ({ id: c._id, name: c.name })));

  const videos = await VideoModel.find({}).populate("category");
  console.log("Videos found:", videos.map(v => ({
    title: v.title,
    category: (v.category as any)?.name,
    url: v.cloudinaryUrl,
    isActive: v.isActive
  })));

  await mongoose.disconnect();
}

checkVideos().catch(console.error);
