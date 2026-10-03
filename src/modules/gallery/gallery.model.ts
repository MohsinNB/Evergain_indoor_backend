import mongoose, { Schema } from "mongoose";
import { IGallery } from "./gallery.interface";

const gallerySchema = new Schema<IGallery>(
  {
    imageUrl: {
      type: String,
      required: [true, "Media URL is required"],
      trim: true,
    },
    mediaType: {
      type: String,
      enum: ["image", "video"],
      default: "image",
      required: true,
    },
    cloudinaryPublicId: {
      type: String,
      required: [true, "Cloudinary Public ID is required"],
      trim: true,
    },
    caption: {
      type: String,
      trim: true,
      maxlength: [300, "Caption cannot exceed 300 characters"],
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

gallerySchema.index({ displayOrder: 1, uploadedAt: -1 });

const Gallery = mongoose.model<IGallery>("Gallery", gallerySchema);

export default Gallery;
