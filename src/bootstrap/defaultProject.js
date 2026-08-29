"use strict";

import Project from "../models/Project.js";
import { generateApiKey } from "../utils/crypto.js";

// Runs once at startup, after the DB connects. Idempotent - if a default
// project already exists (every boot after the first), this is a no-op.
export async function ensureDefaultProject(logger) {
  const existing = await Project.findOne({ isDefault: true });
  if (existing) return existing;

  const { key, hash, prefix } = generateApiKey();

  const project = await Project.create({
    name: "Default",
    apiKeyHash: hash,
    apiKeyPrefix: prefix,
    isDefault: true,
  });

   logger.info(
    { apiKey: key },
    "Created default Skiiyo project. This API key is shown only once - " +
      "self-hosted single-project use doesn't need it (requests with no " +
      "X-API-Key header use this project automatically), but save it if " +
      "you plan to call this project via a hosted-style API key.",
  );

  return project;
}
