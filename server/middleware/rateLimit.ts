import { Request, Response, NextFunction } from "express";

const OTP_WINDOW_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

interface RateLimitEntry { count: number; resetAt: number }
const store = new Map<string, RateLimitEntry>();
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}, OTP_WINDOW_MS).unref();

export function otpRateLimit(req: Request, res: Response, next: NextFunction) {
  const phone = (req.body?.phone as string) ?? "";
  const ip = req.ip ?? req.socket?.remoteAddress ?? "";
  const key = `${phone}:${ip}`;
  const now = Date.now();

  let entry = store.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + OTP_WINDOW_MS };
  }
  if (entry.count >= OTP_MAX_ATTEMPTS) {
    return res.status(429).json({ error: "Too many attempts. Try again in 10 minutes." });
  }
  entry.count++;
  store.set(key, entry);
  next();
}

const GEN_WINDOW_MS = 60 * 1000;
const GEN_MAX_PER_WINDOW = 10;

interface GenEntry { count: number; windowStart: number }
const genStore = new Map<string, GenEntry>();
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of genStore) {
    if (now - entry.windowStart > GEN_WINDOW_MS) genStore.delete(key);
  }
}, GEN_WINDOW_MS).unref();

export function generationRateLimit(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip ?? req.socket?.remoteAddress ?? "";
  const now = Date.now();
  let entry = genStore.get(ip);
  if (!entry || now - entry.windowStart > GEN_WINDOW_MS) {
    entry = { count: 0, windowStart: now };
  }
  if (entry.count >= GEN_MAX_PER_WINDOW) {
    return res.status(429).json({ error: "Slow down. Too many generation requests." });
  }
  entry.count++;
  genStore.set(ip, entry);
  next();
}

const inFlight = new Set<string>();

export function concurrentGuard(req: Request, res: Response, next: NextFunction) {
  const phone = req.user?.phone ?? "";
  if (!phone) return next();
  if (inFlight.has(phone)) {
    return res.status(409).json({ error: "Another generation is in progress" });
  }
  inFlight.add(phone);
  res.on("finish", () => inFlight.delete(phone));
  res.on("close", () => inFlight.delete(phone));
  next();
}
