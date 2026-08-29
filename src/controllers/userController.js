"use strict";

import { userService } from "../services/userService.js";
import { success, paginated } from "../utils/response.js";
import { getPagination } from "../utils/validate.js";

export const userController = {
  // GET /api/v1/user/profile
  async getProfile(request, reply) {
    const user = await userService.getProfile(request.user.id, request.project._id);
    return success(reply, { user });
  },

  // PATCH /api/v1/user/profile
  async updateProfile(request, reply) {
    const user = await userService.updateProfile(
      request.user.id,
      request.project._id,
      request.body,
    );
    return success(reply, { user }, "Profile updated");
  },

  // PATCH /api/v1/user/settings
  async updateSettings(request, reply) {
    const user = await userService.updateSettings(
      request.user.id,
      request.project._id,
      request.body,
    );
    return success(reply, { user }, "Settings updated");
  },

  // GET /api/v1/user/notifications
  async getNotifications(request, reply) {
    const pagination = getPagination(request.query);
    const { items, total, unread } = await userService.getNotifications(
      request.user.id,
      pagination,
    );
    return paginated(reply, {
      data: items,
      total,
      ...pagination,
      extra: { unread },
    });
  },

  // PATCH /api/v1/user/notifications/read
  async markRead(request, reply) {
    await userService.markNotificationsRead(request.user.id, request.body.ids);
    return success(reply, {}, "Notifications marked as read");
  },

  // DELETE /api/v1/user/notifications/:id
  async deleteNotification(request, reply) {
    await userService.deleteNotification(request.user.id, request.params.id);
    return success(reply, {}, "Notification deleted");
  },

  // POST /api/v1/user/fcm-token
  async registerFCMToken(request, reply) {
    await userService.registerFCMToken(
      request.user.id,
      request.project._id,
      request.body.token,
    );
    return success(reply, {}, "Device registered for notifications");
  },
};
