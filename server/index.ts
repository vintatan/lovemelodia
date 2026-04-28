import "dotenv/config";
import express from "express";
import cors from "cors";
import compression from "compression";
import path from "path";
import { fileURLToPath } from "url";
import authRouter from "./routes/auth.js";
import creditsRouter from "./routes/credits.js";
import webhookRouter from "./routes/webhook.js";
import projectsRouter from "./routes/projects.js";
import stage1Router from "./routes/stage1.js";
import stage2Router from "./routes/stage2.js";
import stage3Router from "./routes/stage3.js";
import { requireAuth } from "./middleware/auth.js";
import { getStaleAssemblyJobs, addCreditsAsync } from "./lib/db.js";

declare global {
  namespace Express {
    interface Request {
      user?: { phone: string };
      rawBody?: string;
    }
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
const isProd = process.env.NODE_ENV === "production";

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "http://localhost:3000,http://localhost:3001").split(",");
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(compression());
app.use(express.json({
  limit: "20mb",
  verify: (req: any, _res, buf) => { req.rawBody = buf.toString("utf8"); },
}));

// Security headers
app.use((_req, res, next) => {
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

// Request logger
app.use((req, res, next) => {
  if (!req.path.startsWith("/api")) return next();
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    const phone = (req as any).user?.phone ?? "-";
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${ms}ms (${phone})`);
  });
  next();
});

app.use("/api/auth", authRouter);
app.use("/api/credits", requireAuth, creditsRouter);
app.use("/api/webhooks", webhookRouter);
app.use("/api/projects", requireAuth, projectsRouter);
app.use("/api/stage1", requireAuth, stage1Router);
app.use("/api/stage2", requireAuth, stage2Router);
app.use("/api/stage3", requireAuth, stage3Router);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Serve Vite build in production
if (isProd) {
  const distDir = path.join(__dirname, "../dist");
  app.use(express.static(distDir));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distDir, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`[Kreasi AI] Server running on port ${PORT}`);
});

// Reconcile stale assembly jobs on startup — refund credits for jobs stuck >15 min
async function reconcileStaleJobs(): Promise<void> {
  const cutoff = Math.floor(Date.now() / 1000) - 15 * 60;
  const stale = getStaleAssemblyJobs(cutoff);
  for (const job of stale) {
    console.log(`[Reconcile] Refunding stale assembly job ${job.id} for ${job.phone}`);
    const { updateAssemblyJob } = await import("./lib/db.js");
    updateAssemblyJob(job.id, "failed", undefined, undefined, "Stale job reconciled on restart");
    await addCreditsAsync(job.phone, 30, "refund").catch(() => {});
  }
}

reconcileStaleJobs().catch(err => console.error("[Reconcile] startup error:", err));
