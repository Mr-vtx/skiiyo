"use strict";

import { Redis } from "@upstash/redis";

let redis;
let connected = false;

export async function connectRedis() {
  try {
    const client = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    await client.ping();
    redis = client;
    connected = true;
    console.log("Upstash Redis connected");
  } catch (err) {
    // Important: don't keep `redis` set to a client whose connection never
    // actually succeeded — isRedisConnected() must reflect real state, or
    // every health check (and every cache read) retries against a dead
    // connection instead of short-circuiting.
    redis = undefined;
    connected = false;
    console.error("Redis connection failed:", err.message);
  }
}

export function getRedis() {
  return redis;
}

export function isRedisConnected() {
  return connected;
}

// ==== Cache helpers ============================
export const cache = {
  async get(key) {
    try {
      return (await redis?.get(key)) ?? null;
    } catch {
      return null;
    }
  },

  async set(key, value, ttlSeconds = 3600) {
    try {
      await redis?.set(key, value, { ex: ttlSeconds });
    } catch {
      // fail silently — cache miss is acceptable
    }
  },

  async del(key) {
    try {
      await redis?.del(key);
    } catch {
      /* silent */
    }
  },

  async delPattern(pattern) {
    try {
      const keys = await redis?.keys(pattern);
      if (keys && keys.length > 0) {
        await Promise.all(keys.map((k) => redis.del(k)));
      }
    } catch {
      /* silent */
    }
  },
};

// ==== TTL constants (seconds) =========================
export const TTL = {
  HOME_FEED: 60 * 60, // 1 hour
  TRENDING: 30 * 60, // 30 min
  SEARCH: 10 * 60, // 10 min
  SUGGESTIONS: 24 * 60 * 60, // 24 hours
  USER_SESSION: 30 * 24 * 60 * 60, // 30 days
};
