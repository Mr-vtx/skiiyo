"use strict";

export function errorHandler(error, request, reply) {
  const env = process.env.NODE_ENV;

  // ==== Validation errors (Fastify schema) ============================
  if (error.validation) {
    return reply.code(400).send({
      statusCode: 400,
      error: "Validation Error",
      message: error.message,
      details: error.validation,
    });
  }

  // ==== JWT errors ============================
  if (error.code === "FST_JWT_AUTHORIZATION_TOKEN_EXPIRED") {
    return reply.code(401).send({
      statusCode: 401,
      error: "Token Expired",
      message: "Your session has expired — please sign in again",
    });
  }

  if (error.code === "FST_JWT_AUTHORIZATION_TOKEN_INVALID") {
    return reply.code(401).send({
      statusCode: 401,
      error: "Invalid Token",
      message: "Invalid authentication token",
    });
  }

  // ==== Rate limit ============================
  if (error.statusCode === 429) {
    return reply.code(429).send({
      statusCode: 429,
      error: "Too Many Requests",
      message: error.message,
    });
  }

  // ==== Mongoose duplicate key =============================
  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern ?? {})[0] ?? "field";
    return reply.code(409).send({
      statusCode: 409,
      error: "Conflict",
      message: `${field} already exists`,
    });
  }

  // ==== Mongoose validation =============================
  if (error.name === "ValidationError") {
    const messages = Object.values(error.errors).map((e) => e.message);
    return reply.code(400).send({
      statusCode: 400,
      error: "Validation Error",
      message: messages[0],
      details: messages,
    });
  }

  // ==== Mongoose cast errors (bad ObjectId, bad Date, bad Number, etc) ====
  if (error.name === "CastError") {
    return reply.code(400).send({
      statusCode: 400,
      error: "Validation Error",
      message: `Invalid value for "${error.path}"`,
    });
  }
  // ==== Known HTTP errors ==============================
  if (error.statusCode) {
    return reply.code(error.statusCode).send({
      statusCode: error.statusCode,
      error: error.name ?? "Error",
      message: error.message,
    });
  }

  // ==== Unknown errors ==============================
  request.log.error(error);
  return reply.code(500).send({
    statusCode: 500,
    error: "Internal Server Error",
    message: env === "development" ? error.message : "Something went wrong",
    ...(env === "development" && { stack: error.stack }),
  });
}
