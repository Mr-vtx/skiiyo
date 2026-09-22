"use strict";

import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";
import { Notification } from "../models/Notification.js";
import { generateTokens, verifyRefreshToken } from "../middleware/auth.js";
import { emailService } from "./emailService.js";
import { cache } from "../config/redis.js";
import { hashToken } from "../utils/crypto.js";

const googleClient = process.env.GOOGLE_CLIENT_ID
  ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
  : null;

// Google gives us a display name ("John Doe"), not a handle — and the
// username schema only allows [a-zA-Z0-9_]. Derive a valid candidate from
// the email's local part instead, then disambiguate against existing users.
async function deriveUsername(email, project) {
  const base = email
    .split("@")[0]
    .replace(/[^a-zA-Z0-9_]/g, "")
    .slice(0, 26) || "user";
  const padded = base.length >= 4 ? base : `${base}user`.slice(0, 26);

  let candidate = padded;
  let suffix = 0;
  while (
    await User.exists({ project, usernameLower: candidate.toLowerCase() })
  ) {
    suffix += 1;
    candidate = `${padded}${suffix}`.slice(0, 30);
  }
  return candidate;
}

function sendWelcomeNotification(userId) {
  // Fire-and-forget — a failed notification write shouldn't fail signup.
  Notification.create({
    userId,
    type: "system",
    title: `Welcome to ${process.env.APP_NAME ?? "the app"}`,
    body: "Your account has been created — update your profile to get started.",
  }).catch(() => {});
}

async function verifyGoogleToken(idToken) {
  if (!googleClient) {
    throw Object.assign(
      new Error("Google sign-in is not configured on this server"),
      { statusCode: 503 },
    );
  }

  let ticket;
  try {
    ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
  } catch {
    throw Object.assign(new Error("Invalid Google token"), {
      statusCode: 401,
    });
  }

  const payload = ticket.getPayload();
  if (!payload?.email) {
    throw Object.assign(new Error("Invalid Google token"), {
      statusCode: 401,
    });
  }
  if (!payload.email_verified) {
    throw Object.assign(new Error("Google email is not verified"), {
      statusCode: 401,
    });
  }

  return {
    googleId: payload.sub,
    email: payload.email,
    avatar: payload.picture ?? null,
  };
}

export const authService = {
  // ==== Register ====================================
  async register({ username, email, password, dateOfBirth, geo, project }) {
    let dob = null;
    if (dateOfBirth) {
      dob = new Date(dateOfBirth);
      if (Number.isNaN(dob.getTime())) {
        throw Object.assign(new Error("Invalid date of birth"), {
          statusCode: 400,
        });
      }
    }

    const exists = await User.findOne({
      project,
      $or: [
        { email: email.toLowerCase() },
        { usernameLower: username.toLowerCase() },
      ],
    });

    if (exists) {
      const field = exists.email === email.toLowerCase() ? "Email" : "Username";
      throw Object.assign(new Error(`${field} already taken`), {
        statusCode: 409,
      });
    }

    const user = await User.create({
      project,
      username,
      email,
      password,
      dateOfBirth: dob,
      ...(geo && {
        country: geo.country,
        city: geo.city,
        lat: geo.lat,
        lng: geo.lng,
      }),
    });

    const tokens = generateTokens({
      id: user._id,
      role: user.role,
      project: String(project),
    });

    const verifyToken = crypto.randomBytes(32).toString("hex");
    user.refreshToken = hashToken(tokens.refreshToken);
    user.emailVerificationToken = hashToken(verifyToken);
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    emailService
      .sendWelcome({ email: user.email, username: user.username })
      .catch(() => {});
    emailService
      .sendVerification({ email: user.email, username: user.username, verifyToken })
      .catch(() => {});
    sendWelcomeNotification(user._id);

    return { user: user.toSafeObject(), ...tokens };
  },

  // ==== Verify email ====================================
  // Note: this does not block login — isEmailVerified is informational
  // only unless you add a check for it in login(). Kept that way here
  // since enforcing it is a product decision, not a plumbing one.
  async verifyEmail(token, project) {
    const hashed = hashToken(token);

    const user = await User.findOne({
      project,
      emailVerificationToken: hashed,
      emailVerificationExpires: { $gt: Date.now() },
    }).select("+emailVerificationToken +emailVerificationExpires");

    if (!user) {
      throw Object.assign(
        new Error("Invalid or expired verification link"),
        { statusCode: 400 },
      );
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await user.save({ validateBeforeSave: false });
  },

  // ==== Login ====================================
  async login({ email, password, geo, project }) {
    const user = await User.findOne({
      project,
      email: email.toLowerCase(),
    }).select("+password +refreshToken");

    if (!user || !user.password) {
      throw Object.assign(new Error("Invalid email or password"), {
        statusCode: 401,
      });
    }

    const valid = await user.comparePassword(password);
    if (!valid) {
      throw Object.assign(new Error("Invalid email or password"), {
        statusCode: 401,
      });
    }

    if (!user.isActive) {
      throw Object.assign(new Error("Account suspended"), {
        statusCode: 403,
      });
    }

    const tokens = generateTokens({
      id: user._id,
      role: user.role,
      project: String(project),
    });

    user.refreshToken = hashToken(tokens.refreshToken);
    user.lastSeen = new Date();

    if (geo?.country) {
      user.country = geo.country;
      user.city = geo.city;
    }

    await user.save({ validateBeforeSave: false });

    return { user: user.toSafeObject(), ...tokens };
  },

  // ==== Google OAuth ====================================
  async googleAuth({ idToken, geo, project }) {
    const { googleId, email, avatar } = await verifyGoogleToken(idToken);
    const normalizedEmail = email.toLowerCase();

    let user = await User.findOne({
      project,
      $or: [{ googleId }, { email: normalizedEmail }],
    });
    const isNewUser = !user;

    if (!user) {
      const username = await deriveUsername(normalizedEmail, project);
      user = await User.create({
        project,
        googleId,
        email: normalizedEmail,
        username,
        avatar,
        isEmailVerified: true,
        ...(geo && {
          country: geo.country,
          city: geo.city,
        }),
      });
    } else {
      if (!user.googleId) user.googleId = googleId;
      if (avatar && !user.avatar) user.avatar = avatar;
      user.lastSeen = new Date();
    }

    const tokens = generateTokens({
      id: user._id,
      role: user.role,
      project: String(project),
    });

    user.refreshToken = hashToken(tokens.refreshToken);
    await user.save({ validateBeforeSave: false });

    if (isNewUser) {
      emailService
        .sendWelcome({ email: user.email, username: user.username })
        .catch(() => {});
      sendWelcomeNotification(user._id);
    }

    return { user: user.toSafeObject(), ...tokens };
  },

  // ==== Refresh token ====================================
  async refresh(refreshToken, project) {
    if (!refreshToken) {
      throw Object.assign(new Error("Refresh token required"), {
        statusCode: 401,
      });
    }

    const payload = verifyRefreshToken(refreshToken);
    if (!payload || payload.project !== String(project)) {
      throw Object.assign(new Error("Invalid or expired refresh token"), {
        statusCode: 401,
      });
    }

    const user = await User.findOne({
      _id: payload.id,
      project,
    }).select("+refreshToken");

    if (!user || user.refreshToken !== hashToken(refreshToken)) {
      throw Object.assign(
        new Error("Refresh token reuse detected — please sign in again"),
        { statusCode: 401 },
      );
    }

    const tokens = generateTokens({
      id: user._id,
      role: user.role,
      project: String(project),
    });

    user.refreshToken = hashToken(tokens.refreshToken);
    await user.save({ validateBeforeSave: false });

    return tokens;
  },

  // ==== Logout ====================================
  async logout(userId, project) {
    await User.findOneAndUpdate({ _id: userId, project }, { refreshToken: null });
    await cache.del(`session:${userId}`);
  },

  // ==== Forgot password ====================================
  async forgotPassword(email, project) {
    const user = await User.findOne({ project, email: email.toLowerCase() });
    if (!user) return;

    const token = crypto.randomBytes(32).toString("hex");
    const hashed = hashToken(token);

    user.passwordResetToken = hashed;
    user.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000);

    await user.save({ validateBeforeSave: false });

    await emailService.sendPasswordReset({
      email: user.email,
      username: user.username,
      resetToken: token,
    });
  },

  // ==== Reset password =====================================
  async resetPassword({ token, newPassword, project }) {
    const hashed = hashToken(token);

    const user = await User.findOne({
      project,
      passwordResetToken: hashed,
      passwordResetExpires: { $gt: Date.now() },
    }).select("+passwordResetToken +passwordResetExpires");

    if (!user) {
      throw Object.assign(new Error("Invalid or expired reset token"), {
        statusCode: 400,
      });
    }

    user.password = newPassword;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    user.refreshToken = null;

    await user.save();
  },

  // ==== Get current user ====================================
  async getMe(userId, project) {
    const user = await User.findOne({ _id: userId, project });

    if (!user) {
      throw Object.assign(new Error("User not found"), {
        statusCode: 404,
      });
    }

    return user.toSafeObject();
  },
};
