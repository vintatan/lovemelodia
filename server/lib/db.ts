import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { nanoid } from "nanoid";
import { supabase, getCreditsFromSupabase, syncCreditsToSupabase, createTransactionInSupabase, getTransactionFromSupabase, hasRedeemedPromoInSupabase, recordPromoRedemptionInSupabase } from "./supabase.js";
import { bqTrackCost, bqTrackUserCredit } from "./bigquery.js";

fs.mkdirSync(path.resolve("./data"), { recursive: true });

const db = new Database(path.join(path.resolve("./data"), "kreasi-ai.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    phone      TEXT PRIMARY KEY,
    credits    INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id           TEXT PRIMARY KEY,
    phone        TEXT NOT NULL,
    external_id  TEXT UNIQUE NOT NULL,
    package_name TEXT NOT NULL,
    credits      INTEGER NOT NULL,
    amount       INTEGER NOT NULL,
    currency     TEXT NOT NULL DEFAULT 'IDR',
    status       TEXT NOT NULL DEFAULT 'PENDING',
    created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
    paid_at      INTEGER
  );

  CREATE TABLE IF NOT EXISTS redeemed_promos (
    phone       TEXT NOT NULL,
    code        TEXT NOT NULL,
    redeemed_at INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY (phone, code)
  );

  CREATE TABLE IF NOT EXISTS api_cost_logs (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    phone         TEXT,
    service       TEXT NOT NULL,
    operation     TEXT NOT NULL,
    model         TEXT,
    cost_usd      REAL NOT NULL,
    input_tokens  INTEGER,
    output_tokens INTEGER,
    metadata      TEXT,
    created_at    INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS projects (
    id                    TEXT PRIMARY KEY,
    phone                 TEXT NOT NULL,
    status                TEXT NOT NULL DEFAULT 'stage1',
    theme                 TEXT,
    music_vibe            TEXT,
    character_desc        TEXT,
    character_image_url   TEXT,
    enhanced_prompt       TEXT,
    timepoints_json       TEXT,
    stage1_credits_used   INTEGER NOT NULL DEFAULT 0,
    stage1_completed_at   INTEGER,
    frames_json           TEXT,
    stage2_credits_used   INTEGER NOT NULL DEFAULT 0,
    stage2_completed_at   INTEGER,
    music_url             TEXT,
    video_url             TEXT,
    stage3_credits_used   INTEGER NOT NULL DEFAULT 0,
    stage3_completed_at   INTEGER,
    created_at            INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at            INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_projects_phone ON projects(phone);

  CREATE TABLE IF NOT EXISTS frame_jobs (
    id              TEXT PRIMARY KEY,
    project_id      TEXT NOT NULL,
    timepoint_index INTEGER NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending',
    image_url       TEXT,
    error           TEXT,
    credits_used    INTEGER NOT NULL DEFAULT 0,
    created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE(project_id, timepoint_index)
  );

  CREATE TABLE IF NOT EXISTS assembly_jobs (
    id          TEXT PRIMARY KEY,
    project_id  TEXT NOT NULL,
    phone       TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'generating_music',
    music_url   TEXT,
    video_url   TEXT,
    error       TEXT,
    created_at  INTEGER NOT NULL DEFAULT (unixepoch())
  );
`);

// ── Prepared statements ───────────────────────────────────────────────────────

const stmts = {
  getUser:             db.prepare("SELECT * FROM users WHERE phone = ?"),
  insertUser:          db.prepare("INSERT INTO users (phone, credits) VALUES (?, 0)"),
  getCredits:          db.prepare("SELECT credits FROM users WHERE phone = ?"),
  deductCredits:       db.prepare("UPDATE users SET credits = credits - ? WHERE phone = ? AND credits >= ?"),
  addCredits:          db.prepare("UPDATE users SET credits = credits + ? WHERE phone = ?"),
  hasRedeemedPromo:    db.prepare("SELECT 1 FROM redeemed_promos WHERE phone = ? AND code = ?"),
  insertRedeemedPromo: db.prepare("INSERT INTO redeemed_promos (phone, code) VALUES (?, ?)"),
  insertTx:            db.prepare("INSERT INTO transactions (id, phone, external_id, package_name, credits, amount, currency) VALUES (?, ?, ?, ?, ?, ?, ?)"),
  getTxByExtId:        db.prepare("SELECT * FROM transactions WHERE external_id = ?"),
  updateTxStatus:      db.prepare("UPDATE transactions SET status = ?, paid_at = ? WHERE external_id = ?"),
  insertCostLog:       db.prepare("INSERT INTO api_cost_logs (phone, service, operation, model, cost_usd, input_tokens, output_tokens, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"),

  insertProject:  db.prepare(`INSERT INTO projects (id, phone, theme, music_vibe, character_desc, character_image_url) VALUES (?, ?, ?, ?, ?, ?)`),
  getProject:     db.prepare("SELECT * FROM projects WHERE id = ?"),
  getProjectsByPhone: db.prepare("SELECT id, status, theme, music_vibe, character_image_url, video_url, created_at FROM projects WHERE phone = ? ORDER BY created_at DESC LIMIT 20"),
  updateProject:  db.prepare("UPDATE projects SET status = ?, enhanced_prompt = ?, timepoints_json = ?, stage1_credits_used = ?, stage1_completed_at = ?, updated_at = unixepoch() WHERE id = ?"),
  updateFrames:   db.prepare("UPDATE projects SET frames_json = ?, stage2_credits_used = stage2_credits_used + ?, status = ?, stage2_completed_at = ?, updated_at = unixepoch() WHERE id = ?"),
  updateVideo:    db.prepare("UPDATE projects SET music_url = ?, video_url = ?, stage3_credits_used = ?, stage3_completed_at = unixepoch(), status = 'completed', updated_at = unixepoch() WHERE id = ?"),

  insertFrameJob: db.prepare("INSERT OR REPLACE INTO frame_jobs (id, project_id, timepoint_index, status) VALUES (?, ?, ?, 'pending')"),
  updateFrameJob: db.prepare("UPDATE frame_jobs SET status = ?, image_url = ?, error = ?, credits_used = ? WHERE id = ?"),
  getFrameJob:    db.prepare("SELECT * FROM frame_jobs WHERE project_id = ? AND timepoint_index = ?"),

  insertAssemblyJob: db.prepare("INSERT INTO assembly_jobs (id, project_id, phone) VALUES (?, ?, ?)"),
  getAssemblyJob:    db.prepare("SELECT * FROM assembly_jobs WHERE id = ?"),
  updateAssemblyJob: db.prepare("UPDATE assembly_jobs SET status = ?, music_url = ?, video_url = ?, error = ? WHERE id = ?"),
  staleAssemblyJobs: db.prepare("SELECT * FROM assembly_jobs WHERE status NOT IN ('completed','failed') AND created_at < ?"),
};

// ── Users ─────────────────────────────────────────────────────────────────────

export async function getOrCreateUserAsync(phone: string): Promise<{ phone: string; credits: number }> {
  const remoteCredits = await getCreditsFromSupabase(phone);
  if (remoteCredits !== null) {
    const existing = stmts.getUser.get(phone) as { phone: string; credits: number } | undefined;
    if (existing) {
      if (existing.credits !== remoteCredits) {
        db.prepare("UPDATE users SET credits = ? WHERE phone = ?").run(remoteCredits, phone);
      }
      return { phone, credits: remoteCredits };
    }
    try {
      stmts.insertUser.run(phone);
      if (remoteCredits !== 0) stmts.addCredits.run(remoteCredits, phone);
    } catch (err: any) {
      if (!err?.message?.includes("UNIQUE")) throw err;
    }
    return { phone, credits: remoteCredits };
  }
  const existing = stmts.getUser.get(phone) as { phone: string; credits: number } | undefined;
  if (existing) return existing;
  try {
    stmts.insertUser.run(phone);
    // New user gets 100 free credits (per Jagat AI credits policy)
    stmts.addCredits.run(100, phone);
  } catch (err: any) {
    if (!err?.message?.includes("UNIQUE")) throw err;
  }
  return stmts.getUser.get(phone) as { phone: string; credits: number };
}

export function getOrCreateUser(phone: string): { phone: string; credits: number } {
  const existing = stmts.getUser.get(phone) as { phone: string; credits: number } | undefined;
  if (existing) return existing;
  stmts.insertUser.run(phone);
  stmts.addCredits.run(100, phone);
  return { phone, credits: 100 };
}

export function getCredits(phone: string): number {
  const row = stmts.getCredits.get(phone) as { credits: number } | undefined;
  return row?.credits ?? 0;
}

export function deductCredits(phone: string, amount: number): boolean {
  const changed = stmts.deductCredits.run(amount, phone, amount).changes > 0;
  if (changed) {
    const newBalance = getCredits(phone);
    syncCreditsToSupabase(phone, newBalance, "deduct", amount).catch(() => {});
    bqTrackUserCredit(phone, newBalance);
  }
  return changed;
}

export async function deductCreditsAsync(phone: string, amount: number): Promise<boolean> {
  try {
    if (supabase) {
      const { data, error } = await supabase.rpc("deduct_one_credit", { p_phone: phone, p_amount: amount });
      if (error) throw error;
      if (data === null || data === undefined) return deductCredits(phone, amount);
      db.prepare("UPDATE users SET credits = ? WHERE phone = ?").run(data as number, phone);
      return true;
    }
  } catch (err) {
    console.error("[deductCreditsAsync] Supabase RPC failed, fallback to SQLite:", err);
  }
  return deductCredits(phone, amount);
}

export function addCredits(phone: string, amount: number, type: "topup_approved" | "refund" = "topup_approved"): void {
  stmts.addCredits.run(amount, phone);
  const newBalance = getCredits(phone);
  syncCreditsToSupabase(phone, newBalance, type, amount).catch(() => {});
  bqTrackUserCredit(phone, newBalance);
}

export async function addCreditsAsync(phone: string, amount: number, type: "topup_approved" | "refund" = "topup_approved"): Promise<void> {
  stmts.addCredits.run(amount, phone);
  const newBalance = getCredits(phone);
  await syncCreditsToSupabase(phone, newBalance, type, amount);
}

// ── Promos ────────────────────────────────────────────────────────────────────

export async function redeemFreePromo(phone: string, code: string, credits: number): Promise<{ success: boolean; reason?: string }> {
  if (stmts.hasRedeemedPromo.get(phone, code)) {
    return { success: false, reason: "Kode promo sudah pernah digunakan" };
  }
  const alreadyInSupabase = await hasRedeemedPromoInSupabase(phone, code);
  if (alreadyInSupabase) {
    try { stmts.insertRedeemedPromo.run(phone, code); } catch { }
    return { success: false, reason: "Kode promo sudah pernah digunakan" };
  }
  const recorded = await recordPromoRedemptionInSupabase(phone, code, credits);
  if (!recorded) return { success: false, reason: "Kode promo sudah pernah digunakan" };
  db.transaction(() => {
    try { stmts.insertRedeemedPromo.run(phone, code); } catch { }
    stmts.addCredits.run(credits, phone);
  })();
  const newBalance = getCredits(phone);
  syncCreditsToSupabase(phone, newBalance, "topup_approved", credits).catch(() => {});
  bqTrackUserCredit(phone, newBalance);
  return { success: true };
}

// ── Transactions ──────────────────────────────────────────────────────────────

export function createTransaction(data: {
  id: string; phone: string; externalId: string;
  packageName: string; credits: number; amount: number; currency: string;
}): void {
  stmts.insertTx.run(data.id, data.phone, data.externalId, data.packageName, data.credits, data.amount, data.currency);
  createTransactionInSupabase({ externalId: data.externalId, phone: data.phone,
    packageName: data.packageName, credits: data.credits, amount: data.amount,
    currency: data.currency }).catch(() => {});
}

export function getTransactionByExternalId(externalId: string) {
  return stmts.getTxByExtId.get(externalId) as {
    id: string; phone: string; external_id: string; package_name: string;
    credits: number; amount: number; currency: string; status: string; paid_at: number | null;
  } | undefined;
}

export async function getTransactionByExternalIdAsync(externalId: string) {
  const local = getTransactionByExternalId(externalId);
  if (local) return local;
  const remote = await getTransactionFromSupabase(externalId);
  if (!remote) return undefined;
  try {
    stmts.insertTx.run(nanoid(), remote.phone, externalId, remote.package_name,
      remote.credits, remote.amount, remote.currency);
    if (remote.status === "PAID") stmts.updateTxStatus.run("PAID", Date.now(), externalId);
  } catch { }
  return getTransactionByExternalId(externalId);
}

export function markPaidAndCredit(externalId: string): boolean {
  type Tx = { phone: string; credits: number; status: string };
  const granted = db.transaction(() => {
    const tx = stmts.getTxByExtId.get(externalId) as Tx | undefined;
    if (!tx || tx.status === "PAID") return null;
    stmts.updateTxStatus.run("PAID", Date.now(), externalId);
    stmts.addCredits.run(tx.credits, tx.phone);
    return tx;
  })() as Tx | null;
  if (!granted) return false;
  const newBalance = getCredits(granted.phone);
  syncCreditsToSupabase(granted.phone, newBalance, "topup_approved", granted.credits).catch(() => {});
  return true;
}

// ── Cost logging ──────────────────────────────────────────────────────────────

export function logApiCost(entry: {
  phone?: string; service: string; operation: string; model?: string;
  costUsd: number; inputTokens?: number; outputTokens?: number; metadata?: Record<string, unknown>;
}): void {
  const metadataJson = entry.metadata ? JSON.stringify(entry.metadata) : null;
  try {
    stmts.insertCostLog.run(
      entry.phone ?? null, entry.service, entry.operation, entry.model ?? null,
      entry.costUsd, entry.inputTokens ?? null, entry.outputTokens ?? null, metadataJson,
    );
  } catch (err) {
    console.error("[cost-logger] Failed:", err);
  }
  bqTrackCost({
    phone: entry.phone, service: entry.service, operation: entry.operation,
    model: entry.model, costUsd: entry.costUsd, inputTokens: entry.inputTokens,
    outputTokens: entry.outputTokens, metadata: metadataJson,
  });
}

// ── Projects ──────────────────────────────────────────────────────────────────

export interface Timepoint {
  timestamp: string;
  label: string;
  lyricMoment: string;
  sceneDesc: string;
  mood: string;
  intensity: "low" | "medium" | "high";
  visualEffect: string;
  transition: "dissolve" | "fade" | "wipeleft" | "wiperight" | "slideright";
  transitionDuration: number;
}

export interface Project {
  id: string; phone: string; status: string;
  theme: string | null; music_vibe: string | null;
  character_desc: string | null; character_image_url: string | null;
  enhanced_prompt: string | null; timepoints_json: string | null;
  stage1_credits_used: number;
  frames_json: string | null; stage2_credits_used: number;
  music_url: string | null; video_url: string | null; stage3_credits_used: number;
  created_at: number; updated_at: number;
}

export function createProject(data: {
  id: string; phone: string; theme: string; musicVibe: string;
  characterDesc: string; characterImageUrl: string | null;
}): void {
  stmts.insertProject.run(data.id, data.phone, data.theme, data.musicVibe, data.characterDesc, data.characterImageUrl ?? null);
}

export function getProject(id: string): Project | undefined {
  return stmts.getProject.get(id) as Project | undefined;
}

export function getProjectsByPhone(phone: string) {
  return stmts.getProjectsByPhone.all(phone) as Array<{
    id: string; status: string; theme: string | null; music_vibe: string | null;
    character_image_url: string | null; video_url: string | null; created_at: number;
  }>;
}

export function saveStage1Result(projectId: string, data: {
  enhancedPrompt: string; timepointsJson: string; creditsUsed: number;
}): void {
  stmts.updateProject.run("stage2_ready", data.enhancedPrompt, data.timepointsJson, data.creditsUsed, Math.floor(Date.now() / 1000), projectId);
}

export function saveStage2Frame(projectId: string, framesJson: string, additionalCredits: number, approved: boolean): void {
  const status = approved ? "stage3_ready" : "stage2_generating";
  const completedAt = approved ? Math.floor(Date.now() / 1000) : null;
  stmts.updateFrames.run(framesJson, additionalCredits, status, completedAt, projectId);
}

export function saveStage3Result(projectId: string, musicUrl: string, videoUrl: string, creditsUsed: number): void {
  stmts.updateVideo.run(musicUrl, videoUrl, creditsUsed, projectId);
}

// ── Frame jobs ────────────────────────────────────────────────────────────────

export function upsertFrameJob(id: string, projectId: string, timepointIndex: number): void {
  stmts.insertFrameJob.run(id, projectId, timepointIndex);
}

export function updateFrameJob(id: string, status: string, imageUrl?: string, error?: string, creditsUsed = 0): void {
  stmts.updateFrameJob.run(status, imageUrl ?? null, error ?? null, creditsUsed, id);
}

export function getFrameJob(projectId: string, timepointIndex: number) {
  return stmts.getFrameJob.get(projectId, timepointIndex) as {
    id: string; status: string; image_url: string | null; error: string | null; credits_used: number;
  } | undefined;
}

// ── Assembly jobs ─────────────────────────────────────────────────────────────

export function createAssemblyJob(id: string, projectId: string, phone: string): void {
  stmts.insertAssemblyJob.run(id, projectId, phone);
}

export function getAssemblyJob(id: string) {
  return stmts.getAssemblyJob.get(id) as {
    id: string; project_id: string; phone: string;
    status: string; music_url: string | null; video_url: string | null; error: string | null;
  } | undefined;
}

export function updateAssemblyJob(id: string, status: string, musicUrl?: string, videoUrl?: string, error?: string): void {
  stmts.updateAssemblyJob.run(status, musicUrl ?? null, videoUrl ?? null, error ?? null, id);
}

export function getStaleAssemblyJobs(olderThanUnix: number) {
  return stmts.staleAssemblyJobs.all(olderThanUnix) as Array<{
    id: string; project_id: string; phone: string; status: string;
  }>;
}

export default db;
