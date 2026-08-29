"use strict";

import jwt from "jsonwebtoken";

// A token is only valid for the project it was issued under. Without this,
// a token minted while calling one project's API key could be replayed
// against another project sharing the same JWT_SECRET.
function sameProject(request, reply) {
  if (request.user?.project !== String(request.project?._id)) {
    reply.code(401).send({
      statusCode: 401,
      error: "Unauthorized",
      message: "Token is not valid for this project",
    });
    return false;
  }
  return true;
}

export async function authenticate(request, reply) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.code(401).send({
      statusCode: 401,
      error: "Unauthorized",
      message: "Invalid or expired token — please sign in again",
    });
  }
  sameProject(request, reply);
}

export async function optionalAuth(request) {
  try {
    await request.jwtVerify();
  } catch {
    return;
  }
  if (request.user?.project !== String(request.project?._id)) {
    request.user = undefined;
  }
}

export async function adminOnly(request, reply) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.code(401).send({
      statusCode: 401,
      error: "Unauthorized",
      message: "Please sign in",
    });
  }
  if (!sameProject(request, reply)) return;
  if (request.user?.role !== "admin") {
    return reply.code(403).send({
      statusCode: 403,
      error: "Forbidden",
      message: "Admin access required",
    });
  }
}

export function generateTokens(payload) {
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES ?? "15m",
  });

  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES ?? "30d",
  });

  return { accessToken, refreshToken };
}

export function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch {
    return null;
  }
}
