"use strict";

import "dotenv/config";
import mongoose from "mongoose";
import User from "../src/models/User.js";

async function main() {
  const email = process.argv[2];
  const projectId = process.argv[3]; // optional — only needed if you run more than one project

  if (!email) {
    console.error(
      'Usage: node scripts/makeAdmin.js "user@example.com" [projectId]',
    );
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  const filter = { email: email.toLowerCase() };
  if (projectId) filter.project = projectId;

  const user = await User.findOneAndUpdate(
    filter,
    { role: "admin" },
    { new: true },
  );

  if (!user) {
    console.error(
      `No user found with email: ${email}` +
        (projectId ? ` in project ${projectId}` : ""),
    );
    process.exit(1);
  }

  console.log(`\n${user.username} (${user.email}) is now an admin.\n`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Failed to promote user:", err.message);
  process.exit(1);
});
