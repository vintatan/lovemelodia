import { createHmac, timingSafeEqual } from "crypto";
import { verifyToken } from "../lib/otp.js";
import type { Request, Response, NextFunction } from "express";

const SERVICE_SECRET = process.env.IMAJI_SERVICE_SECRET ?? "";

function verifyServiceJwt(token: string): string | null {
  if (!SERVICE_SECRET) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sig] = parts;
    const expectedSig = createHmac("sha256", SERVICE_SECRET)
      .update(`${headerB64}.${payloadB64}`)
      .digest("base64url");
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString()) as Record<string, unknown>;
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === "number" && payload.exp < now) return null;
    return typeof payload.phone === "string" ? payload.phone : null;
  } catch {
    return null;
  }
}

// Accepts either a valid service JWT OR a regular kreasi user JWT.
// Sets req.servicePhone if the service JWT is valid.
export function serviceAuthOrRequireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const servicePhone = verifyServiceJwt(token);
  if (servicePhone) {
    req.user = { phone: servicePhone };
    (req as any).servicePhone = servicePhone;
    return next();
  }

  const decoded = verifyToken(token);
  if (!decoded) return res.status(401).json({ error: "Invalid or expired token" });
  req.user = decoded as { phone: string };
  next();
}
