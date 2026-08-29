"use strict";


import "dotenv/config";
import mongoose from "mongoose";
import Project from "../src/models/Project.js";
import { generateApiKey } from "../src/utils/crypto.js";

async function main() {
  const name = process.argv[2];
  if (!name) {
    console.error('Usage: node scripts/createProject.js "My Project Name"');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  const { key, hash, prefix } = generateApiKey();

  const project = await Project.create({
    name,
    apiKeyHash: hash,
    apiKeyPrefix: prefix,
  });

  console.log(`\nProject created: ${project.name} (${project._id})`);
  console.log(`\nAPI key (save this now — it will not be shown again):\n`);
  console.log(`  ${key}\n`);
  console.log(`Send it as:  X-API-Key: ${key}\n`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Failed to create project:", err.message);
  process.exit(1);
});
