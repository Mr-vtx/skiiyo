"use strict";

import { v2 as cloudinary } from "cloudinary";

export const isCloudinaryConfigured = () =>
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET;

if (isCloudinaryConfigured()) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export default cloudinary;

export const uploadImage = async (filePath, folder = "uploads") => {
  if (!isCloudinaryConfigured()) return null;

  return cloudinary.uploader.upload(filePath, {
    folder,
    resource_type: "image",
    transformation: [{ quality: "auto", fetch_format: "auto" }],
  });
};

export const deleteImage = async (publicId) => {
  if (!isCloudinaryConfigured()) return null;
  return cloudinary.uploader.destroy(publicId);
};

// For files received in-memory (e.g. from @fastify/multipart's toBuffer()),
// where there's no filesystem path to hand to uploadImage.
export const uploadImageBuffer = async (buffer, folder = "uploads") => {
  if (!isCloudinaryConfigured()) return null;

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        transformation: [{ quality: "auto", fetch_format: "auto" }],
      },
      (err, result) => (err ? reject(err) : resolve(result)),
    );
    stream.end(buffer);
  });
};
