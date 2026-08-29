"use strict";

import Project from "../models/Project.js";
import { hashToken } from "../utils/crypto.js";

// The default project is looked up on nearly every request. It changes
// essentially never, so we cache it in memory rather than hit Mongo each
// time. Keyed lookups (real API keys) always go to the DB — those are rare
// relative to self-host traffic and must never be served stale.
let cachedDefaultProject = null;

export function clearDefaultProjectCache() {
  cachedDefaultProject = null;
}

async function getDefaultProject() {
  if (cachedDefaultProject) return cachedDefaultProject;

  const project = await Project.findOne({ isDefault: true, isActive: true });
  if (project) cachedDefaultProject = project;
  return project;
}

// onRequest hook — must run before rate-limiting and before auth, since
// both need to know which project a request belongs to.
export async function resolveProject(request, reply) {
  const apiKey = request.headers["x-api-key"];

  if (!apiKey) {
    const project = await getDefaultProject();
    if (!project) {
      return reply.code(500).send({
        statusCode: 500,
        error: "Server Error",
        message:
          "No default project configured — this is a server setup issue, not something a client can fix",
      });
    }
    request.project = project;
    return;
  }

  const project = await Project.findOne({
    apiKeyHash: hashToken(apiKey),
    isActive: true,
  }).select("+apiKeyHash");

  if (!project) {
    return reply.code(401).send({
      statusCode: 401,
      error: "Unauthorized",
      message: "Invalid API key",
    });
  }

  request.project = project;
}
