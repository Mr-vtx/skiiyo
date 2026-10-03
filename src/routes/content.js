"use strict";

import Content from "../models/Content.js";
import { success, error } from "../utils/response.js";

const TYPE_PARAM = {
  type: "object",
  required: ["type"],
  properties: { type: { type: "string", enum: ["note", "work"] } },
};

// Public, read-only. Drafts are never returned here.
export default async function contentRoutes(app) {
  // GET /api/v1/content/:type — list. Bodies are included so readers can
  // compute reading time without N extra requests; fine at blog scale.
  app.get("/:type", { schema: { params: TYPE_PARAM } }, async (request, reply) => {
    const items = await Content.find({
      project: request.project._id,
      type: request.params.type,
      published: true,
    })
      .select("-project -__v")
      .sort(request.params.type === "work" ? { order: 1 } : { date: -1 })
      .lean();

    return success(reply, { items }, "Content fetched");
  });

  // GET /api/v1/content/:type/:slug — one entry, with body
  app.get(
    "/:type/:slug",
    {
      schema: {
        params: {
          ...TYPE_PARAM,
          required: ["type", "slug"],
          properties: {
            ...TYPE_PARAM.properties,
            slug: { type: "string", pattern: "^[a-z0-9-]+$", maxLength: 120 },
          },
        },
      },
    },
    async (request, reply) => {
      const item = await Content.findOne({
        project: request.project._id,
        type: request.params.type,
        slug: request.params.slug,
        published: true,
      })
        .select("-project -__v")
        .lean();

      if (!item) return error(reply, "Not found", 404);
      return success(reply, { item }, "Content fetched");
    },
  );
}
