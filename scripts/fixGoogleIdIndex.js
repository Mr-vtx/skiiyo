"use strict";

// One-off migration. Drops the old (project, googleId) sparse unique index that
// made the second password signup fail with "googleId already exists", then
// builds the partial replacement defined in src/models/User.js.
//
//   node scripts/fixGoogleIdIndex.js
import "dotenv/config";
import mongoose from "mongoose";
import User from "../src/models/User.js";

const OLD = "project_1_googleId_1";

async function main() {
  await mongoose.connect(process.env.MONGO_URI);

  const indexes = await User.collection.indexes();
  if (indexes.some((i) => i.name === OLD)) {
    await User.collection.dropIndex(OLD);
    console.log(`Dropped old index ${OLD}`);
  } else {
    console.log(`Old index ${OLD} not present (already fixed)`);
  }

  await User.createIndexes(); // builds project_googleId_partial if missing
  const names = (await User.collection.indexes()).map((i) => i.name);
  console.log("Indexes now:", names.join(", "));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
