"use strict";

import crypto from "crypto";

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateApiKey() {
  const raw = crypto.randomBytes(24).toString("hex");
  const key = `sk_${raw}`;
  return {
    key,
    hash: hashToken(key),
    prefix: key.slice(0, 10),
  };
}
