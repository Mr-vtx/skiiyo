"use strict";

import User from "../models/User.js";
import { Notification } from "../models/Notification.js";
import { cache, TTL } from "../config/redis.js";
import { sanitize } from "../utils/validate.js";
import { uploadImageBuffer, deleteImage } from "../config/cloudinary.js";

export const userService = {
  async getProfile(userId, project) {
    const user = await User.findOne({ _id: userId, project });
    if (!user)
      throw Object.assign(new Error("User not found"), { statusCode: 404 });
    return user.toSafeObject();
  },

  async updateProfile(userId, project, updates) {
    // "avatar" is deliberately not editable here — it's only ever set via
    // updateAvatar(), so it always points at a real Cloudinary upload
    // rather than an arbitrary, unvalidated URL string.
    const allowed = ["username", "bio", "dateOfBirth", "city", "lat", "lng"];
    const clean = {};
    for (const key of allowed) {
      if (updates[key] !== undefined) {
        clean[key] =
          typeof updates[key] === "string"
            ? sanitize(updates[key])
            : updates[key];
      }
    }

    if (clean.username) {
      const exists = await User.findOne({
        project,
        username: clean.username,
        _id: { $ne: userId },
      });
      if (exists)
        throw Object.assign(new Error("Username already taken"), {
          statusCode: 409,
        });
    }

    const user = await User.findOneAndUpdate(
      { _id: userId, project },
      clean,
      { new: true, runValidators: true },
    );
    if (!user)
      throw Object.assign(new Error("User not found"), { statusCode: 404 });
    return user.toSafeObject();
  },

  async updateAvatar(userId, project, buffer) {
    const user = await User.findOne({ _id: userId, project }).select(
      "+avatarPublicId",
    );
    if (!user)
      throw Object.assign(new Error("User not found"), { statusCode: 404 });

    const result = await uploadImageBuffer(buffer, `avatars/${project}`);
    if (!result) {
      throw Object.assign(
        new Error("Image uploads are not configured on this server"),
        { statusCode: 503 },
      );
    }

    const oldPublicId = user.avatarPublicId;
    user.avatar = result.secure_url;
    user.avatarPublicId = result.public_id;
    await user.save({ validateBeforeSave: false });

    // Best-effort cleanup — don't fail the request if this fails.
    if (oldPublicId) deleteImage(oldPublicId).catch(() => {});

    return user.toSafeObject();
  },

  async updateSettings(userId, project, settings) {
    const user = await User.findOneAndUpdate(
      { _id: userId, project },
      { $set: { settings } },
      { new: true, runValidators: true },
    );
    return user.toSafeObject();
  },

  async getNotifications(userId, { page, limit, skip }) {
    const [items, total, unread] = await Promise.all([
      Notification.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Notification.countDocuments({ userId }),
      Notification.countDocuments({ userId, isRead: false }),
    ]);
    return { items, total, unread };
  },

  async markNotificationsRead(userId, notificationIds) {
    const query = notificationIds?.length
      ? { userId, _id: { $in: notificationIds } }
      : { userId };
    await Notification.updateMany(query, { isRead: true, readAt: new Date() });
  },

  async deleteNotification(userId, notificationId) {
    await Notification.findOneAndDelete({ _id: notificationId, userId });
  },

  async registerFCMToken(userId, project, token) {
    await User.findOneAndUpdate(
      { _id: userId, project },
      { $addToSet: { fcmTokens: token } },
    );
  },
};
