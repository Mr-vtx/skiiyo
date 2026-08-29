"use strict";

import { adminOnly } from "../middleware/auth.js";
import { success, paginated } from "../utils/response.js";
import { getPagination, sanitize } from "../utils/validate.js";
import { cache } from "../config/redis.js";
import cloudinary, { uploadImage, deleteImage } from "../config/cloudinary.js";

export default async function adminRoutes(app) {
  app.addHook("preHandler", adminOnly);

  // GET /api/v1/admin/stats
  app.get("/stats", async (request, reply) => {
  
  });
}
