"use strict";

import { authController } from "../controllers/authController.js";
import { authenticate } from "../middleware/auth.js";
import { geoMiddleware } from "../middleware/geoip.js";

export default async function authRoutes(app) {
  app.post(
    "/register",
    {
      preHandler: [geoMiddleware],
      schema: {
        body: {
          type: "object",
          required: ["username", "email", "password"],
          properties: {
            username: { type: "string", minLength: 4, maxLength: 30 },
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 6, maxLength: 100 },
            dateOfBirth: { type: "string", nullable: true },
          },
          additionalProperties: false,
        },
      },
    },
    authController.register,
  );

  // ==== Login ================================================
  app.post(
    "/login",
    {
      preHandler: [geoMiddleware],
      schema: {
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 1 },
          },
          additionalProperties: false,
        },
      },
    },
    authController.login,
  );

  // ==== Google OAuth ================================================
  app.post(
    "/google",
    {
      preHandler: [geoMiddleware],
      schema: {
        body: {
          type: "object",
          required: ["idToken"],
          properties: {
            idToken: { type: "string" },
          },
          additionalProperties: false,
        },
      },
    },
    authController.google,
  );

  // ==== Refresh token ================================================
  app.post(
    "/refresh",
    {
      schema: {
        body: {
          type: "object",
          required: ["refreshToken"],
          properties: {
            refreshToken: { type: "string" },
          },
          additionalProperties: false,
        },
      },
    },
    authController.refresh,
  );

  // ==== Logout (requires auth) ================================================
  app.post(
    "/logout",
    {
      preHandler: [authenticate],
    },
    authController.logout,
  );

  // ==== Forgot password ================================================
  app.post(
    "/forgot-password",
    {
      schema: {
        body: {
          type: "object",
          required: ["email"],
          properties: {
            email: { type: "string", format: "email" },
          },
          additionalProperties: false,
        },
      },
    },
    authController.forgotPassword,
  );

  // ==== Reset password ================================================
  app.post(
    "/reset-password",
    {
      schema: {
        body: {
          type: "object",
          required: ["token", "newPassword"],
          properties: {
            token: { type: "string" },
            newPassword: { type: "string", minLength: 6, maxLength: 100 },
          },
          additionalProperties: false,
        },
      },
    },
    authController.resetPassword,
  );

  // ==== Get current user ================================================
  app.get(
    "/me",
    {
      preHandler: [authenticate],
    },
    authController.getMe,
  );
}
