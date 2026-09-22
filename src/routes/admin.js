"use strict";

import { adminOnly } from "../middleware/auth.js";
import { success } from "../utils/response.js";
import { cache, TTL } from "../config/redis.js";
import User from "../models/User.js";

export default async function adminRoutes(app) {
  app.addHook("preHandler", adminOnly);

  // GET /api/v1/admin/stats
  // Cheap, project-scoped snapshot of the user base. Cached briefly since
  // it's a dashboard read, not something that needs to be real-time.
  app.get("/stats", async (request, reply) => {
    const projectId = request.project._id;
    const cacheKey = `admin:stats:${projectId}`;

    const cached = await cache.get(cacheKey);
    if (cached) {
      return success(reply, JSON.parse(cached), "Stats fetched");
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [totalUsers, activeUsers, newUsersLast7Days, verifiedUsers, topCountries] =
      await Promise.all([
        User.countDocuments({ project: projectId }),
        User.countDocuments({ project: projectId, isActive: true }),
        User.countDocuments({
          project: projectId,
          createdAt: { $gte: sevenDaysAgo },
        }),
        User.countDocuments({ project: projectId, isEmailVerified: true }),
        User.aggregate([
          { $match: { project: projectId, country: { $ne: null } } },
          { $group: { _id: "$country", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 5 },
        ]),
      ]);

    const stats = {
      totalUsers,
      activeUsers,
      newUsersLast7Days,
      verifiedUsers,
      topCountries: topCountries.map((c) => ({
        country: c._id,
        count: c.count,
      })),
    };

    await cache.set(cacheKey, JSON.stringify(stats), TTL.SEARCH);

    return success(reply, stats, "Stats fetched");
  });
}
