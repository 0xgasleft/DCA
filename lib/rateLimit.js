import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// Cache limiters by config key so we don't recreate them on every request
const limiters = new Map();

function getLimiter(limit, windowMs) {
  const key = `${limit}:${windowMs}`;
  if (!limiters.has(key)) {
    limiters.set(key, new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(limit, `${windowMs}ms`),
      prefix: "inkdca_rl",
    }));
  }
  return limiters.get(key);
}

/**
 * Redis-backed rate limiter using Upstash sliding window.
 * Same interface as the previous in-memory version.
 * @param {string} ip
 * @param {number} limit - Max requests in window
 * @param {number} windowMs - Window in milliseconds
 * @returns {{ allowed: boolean, remaining: number, resetIn: number }}
 */
export async function rateLimit(ip, limit, windowMs) {
  const limiter = getLimiter(limit, windowMs);
  const { success, remaining, reset } = await limiter.limit(ip);
  const resetIn = Math.max(0, reset - Date.now());
  return { allowed: success, remaining, resetIn };
}

export function getClientIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
    req.headers["x-real-ip"] ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}
