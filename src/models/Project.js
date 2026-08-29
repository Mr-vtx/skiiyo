"use strict";

import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Project name is required"],
      trim: true,
      maxlength: 60,
    },
    // Only the hash is ever stored — the raw key is shown once, at creation.
    apiKeyHash: {
      type: String,
      required: true,
      select: false,
    },
    // Safe to display/log — helps identify a key without exposing it.
    apiKeyPrefix: {
      type: String,
      required: true,
    },
    // The single auto-created project a self-hosted instance falls back to
    // when no X-API-Key header is sent. Self-hosters never need to think
    // about projects/keys unless they deliberately create more.
    isDefault: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

projectSchema.index({ apiKeyPrefix: 1 });

export default mongoose.model("Project", projectSchema);
