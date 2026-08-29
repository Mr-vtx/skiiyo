"use strict";

import { authService } from "../services/authService.js";
import { success, error } from "../utils/response.js";
import { sanitize } from "../utils/validate.js";

export const authController = {
  async register(request, reply) {
    const { username, email, password, dateOfBirth } = request.body;

    const data = await authService.register({
      username: sanitize(username),
      email: sanitize(email),
      password,
      dateOfBirth: dateOfBirth ?? null,
      geo: request.geo,
      project: request.project._id,
    });

    return success(reply, data, "Account created successfully", 201);
  },

  // POST /api/v1/auth/login
  async login(request, reply) {
    const { email, password } = request.body;

    const data = await authService.login({
      email: sanitize(email),
      password,
      geo: request.geo,
      project: request.project._id,
    });

    return success(reply, data, "Signed in successfully");
  },

  // POST /api/v1/auth/google
  async google(request, reply) {
    const { idToken } = request.body;

    const data = await authService.googleAuth({
      idToken,
      geo: request.geo,
      project: request.project._id,
    });

    return success(reply, data, "Signed in with Google");
  },

  // POST /api/v1/auth/refresh
  async refresh(request, reply) {
    const { refreshToken } = request.body;
    const tokens = await authService.refresh(refreshToken, request.project._id);
    return success(reply, tokens, "Tokens refreshed");
  },

  // POST /api/v1/auth/logout
  async logout(request, reply) {
    await authService.logout(request.user.id, request.project._id);
    return success(reply, {}, "Signed out successfully");
  },

  // POST /api/v1/auth/forgot-password
  async forgotPassword(request, reply) {
    const { email } = request.body;
    await authService.forgotPassword(sanitize(email), request.project._id);
    // Always return success — don't reveal if email exists
    return success(
      reply,
      {},
      "If email exists, a reset link has been sent",
    );
  },

  // POST /api/v1/auth/reset-password
  async resetPassword(request, reply) {
    const { token, newPassword } = request.body;
    await authService.resetPassword({
      token,
      newPassword,
      project: request.project._id,
    });
    return success(reply, {}, "Password reset successfully — please sign in");
  },

  // GET /api/v1/auth/me
  async getMe(request, reply) {
    const user = await authService.getMe(request.user.id, request.project._id);
    return success(reply, { user }, "Profile fetched");
  },
};
