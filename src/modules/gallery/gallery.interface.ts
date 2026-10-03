import { Document, Types } from "mongoose";

export type MediaType = "image" | "video";

export interface IGallery extends Document {
  _id: Types.ObjectId;
  imageUrl: string;
  mediaType: MediaType;
  cloudinaryPublicId: string;
  caption?: string | undefined;
  displayOrder: number;
  uploadedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type UploadGalleryInput = {
  caption?: string | undefined;
  displayOrder?: number | undefined;
};

export type ReorderGalleryInput = {
  orders: Array<{
    id: string;
    displayOrder: number;
  }>;
};
