"use strict";

import Content from "../models/Content.js";
import { adminOnly } from "../middleware/auth.js";
import { success, error } from "../utils/response.js";
import { sanitize, isValidId } from "../utils/validate.js";

const FIELDS = {
  type: { type: "string", enum: ["note", "work"] },
  slug: { type: "string", pattern: "^[a-z0-9-]+$", minLength: 1, maxLength: 120 },
  title: { type: "string", minLength: 1, maxLength: 200 },
  summary: { type: "string", maxLength: 500 },
  body: { type: "string", maxLength: 200000 },
  tags: { type: "array", items: { type: "string", maxLength: 40 }, maxItems: 10 },
  date: { type: "string" },
  published: { type: "boolean" },
  order: { type: "number" },
  status: { type: "string", maxLength: 40 },
  year: { type: "string", maxLength: 10 },
  cover: { type: "string", maxLength: 300 },
  url: { type: "string", maxLength: 300 },
  source: { type: "string", maxLength: 300 },
  flow: { type: "array", items: { type: "string", maxLength: 60 }, maxItems: 12 },
};

// Plain-text fields get HTML stripped. `body` is deliberately left alone:
// it is MDX, and this route is admin-only.
function clean(input) {
  const out = { ...input };
  for (const k of ["title", "summary", "status", "year", "cover", "url", "source"]) {
    if (typeof out[k] === "string") out[k] = sanitize(out[k]);
  }
  if (Array.isArray(out.tags)) out.tags = out.tags.map(sanitize).filter(Boolean);
  if (Array.isArray(out.flow)) out.flow = out.flow.map(sanitize).filter(Boolean);
  if (out.date) {
    const d = new Date(out.date);
    if (Number.isNaN(d.getTime())) delete out.date;
    else out.date = d;
  }
  return out;
}

function duplicate(reply, err) {
  if (err?.code === 11000) {
    return error(reply, "That slug is already used for this type", 409);
  }
  throw err;
}

// Admin CRUD. Registered under /api/v1/admin/content.
export default async function adminContentRoutes(app) {
  app.addHook("preHandler", adminOnly);

  // GET / — everything including drafts, no bodies
  app.get(
    "/",
    {
      schema: {
        querystring: {
          type: "object",
          properties: { type: { type: "string", enum: ["note", "work"] } },
        },
      },
    },
    async (request, reply) => {
      const filter = { project: request.project._id };
      if (request.query.type) filter.type = request.query.type;

      const items = await Content.find(filter)
        .select("-body -project -__v")
        .sort({ type: 1, order: 1, date: -1 })
        .lean();

      return success(reply, { items }, "Content fetched");
    },
  );

  // GET /:id — one entry with body, for the editor
  app.get("/:id", async (request, reply) => {
    if (!isValidId(request.params.id)) return error(reply, "Invalid id", 400);

    const item = await Content.findOne({
      _id: request.params.id,
      project: request.project._id,
    })
      .select("-project -__v")
      .lean();

    if (!item) return error(reply, "Not found", 404);
    return success(reply, { item }, "Content fetched");
  });

  // POST / — create
  app.post(
    "/",
    {
      schema: {
        body: {
          type: "object",
          required: ["type", "slug", "title"],
          properties: FIELDS,
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      try {
        const item = await Content.create({
          ...clean(request.body),
          project: request.project._id,
        });
        return success(reply, { item }, "Created", 201);
      } catch (err) {
        return duplicate(reply, err);
      }
    },
  );

  // PATCH /:id — partial update. `type` can't change after creation.
  const { type: _type, ...EDITABLE } = FIELDS;
  app.patch(
    "/:id",
    {
      schema: {
        body: {
          type: "object",
          properties: EDITABLE,
          additionalProperties: false,
          minProperties: 1,
        },
      },
    },
    async (request, reply) => {
      if (!isValidId(request.params.id)) return error(reply, "Invalid id", 400);

      try {
        const item = await Content.findOneAndUpdate(
          { _id: request.params.id, project: request.project._id },
          { $set: clean(request.body) },
          { new: true, runValidators: true },
        )
          .select("-project -__v")
          .lean();

        if (!item) return error(reply, "Not found", 404);
        return success(reply, { item }, "Updated");
      } catch (err) {
        return duplicate(reply, err);
      }
    },
  );

  // DELETE /:id
  app.delete("/:id", async (request, reply) => {
    if (!isValidId(request.params.id)) return error(reply, "Invalid id", 400);

    const res = await Content.deleteOne({
      _id: request.params.id,
      project: request.project._id,
    });

    if (res.deletedCount === 0) return error(reply, "Not found", 404);
    return success(reply, {}, "Deleted");
  });
}
