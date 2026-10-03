"use strict";

import mongoose from "mongoose";

// One collection for everything a site publishes: notes (blog posts) and
// work entries (project write-ups). `type` tells them apart; the work-only
// fields are simply unused on notes.
const contentSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    type: { type: String, enum: ["note", "work"], required: true },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9-]+$/, "Slug may only contain a-z, 0-9 and hyphens"],
      maxlength: 120,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    summary: { type: String, default: "", trim: true, maxlength: 500 },
    // MDX source. Only admins can write it; the reader app compiles it.
    body: { type: String, default: "", maxlength: 200_000 },
    tags: { type: [String], default: [] },
    date: { type: Date, default: Date.now },
    published: { type: Boolean, default: false },

    // Work-only fields.
    order: { type: Number, default: 99 },
    status: { type: String, default: "", maxlength: 40 },
    year: { type: String, default: "", maxlength: 10 },
    cover: { type: String, default: "", maxlength: 300 },
    url: { type: String, default: "", maxlength: 300 },
    source: { type: String, default: "", maxlength: 300 },
    flow: { type: [String], default: [] },
  },
  { timestamps: true },
);

// A slug is unique per project and type, so a note and a work entry
// can share one.
contentSchema.index({ project: 1, type: 1, slug: 1 }, { unique: true });
contentSchema.index({ project: 1, type: 1, published: 1, date: -1 });

export default mongoose.model("Content", contentSchema);
