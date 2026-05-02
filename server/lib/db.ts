import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { nanoid } from "nanoid";
import { supabase, getCreditsFromSupabase, syncCreditsToSupabase, createTransactionInSupabase, getTransactionFromSupabase, hasRedeemedPromoInSupabase, recordPromoRedemptionInSupabase, getAlbumsByPhoneFromSupabase } from "./supabase.js";
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

  CREATE TABLE IF NOT EXISTS music_jobs (
    id               TEXT PRIMARY KEY,
    phone            TEXT NOT NULL,
    prompt           TEXT NOT NULL,
    enhanced_prompt  TEXT,
    timepoints_json  TEXT,
    status           TEXT NOT NULL DEFAULT 'pending',
    audio_url        TEXT,
    error            TEXT,
    credits_used     INTEGER NOT NULL DEFAULT 10,
    created_at       INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE INDEX IF NOT EXISTS idx_music_jobs_phone ON music_jobs(phone);

  CREATE TABLE IF NOT EXISTS novel_jobs (
    id               TEXT PRIMARY KEY,
    music_job_id     TEXT NOT NULL,
    phone            TEXT NOT NULL,
    status           TEXT NOT NULL DEFAULT 'pending',
    image_urls_json  TEXT,
    timepoints_json  TEXT,
    video_url        TEXT,
    error            TEXT,
    credits_used     INTEGER NOT NULL DEFAULT 50,
    created_at       INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE INDEX IF NOT EXISTS idx_novel_jobs_phone ON novel_jobs(phone);
`);

// ── Migrations ────────────────────────────────────────────────────────────────
try {
  db.exec(`CREATE TABLE IF NOT EXISTS albums (
    id               TEXT PRIMARY KEY,
    phone            TEXT NOT NULL,
    title            TEXT,
    theme            TEXT NOT NULL,
    song_count       INTEGER NOT NULL,
    credits_charged  INTEGER NOT NULL,
    status           TEXT NOT NULL DEFAULT 'generating',
    music_job_ids    TEXT NOT NULL DEFAULT '[]',
    cover_url        TEXT,
    created_at       INTEGER NOT NULL DEFAULT (unixepoch())
  )`);
  db.exec("CREATE INDEX IF NOT EXISTS idx_albums_phone ON albums(phone)");
} catch { /* already exists */ }
try { db.exec("ALTER TABLE albums ADD COLUMN cover_url TEXT"); } catch { /* already exists */ }
try { db.exec("ALTER TABLE albums ADD COLUMN title TEXT"); } catch { /* already exists */ }

try {
  db.exec(`CREATE TABLE IF NOT EXISTS album_novel_jobs (
    id               TEXT PRIMARY KEY,
    album_id         TEXT NOT NULL,
    phone            TEXT NOT NULL,
    status           TEXT NOT NULL DEFAULT 'generating',
    songs_done       INTEGER NOT NULL DEFAULT 0,
    song_count       INTEGER NOT NULL DEFAULT 0,
    final_video_url  TEXT,
    error            TEXT,
    credits_charged  INTEGER NOT NULL,
    created_at       INTEGER NOT NULL DEFAULT (unixepoch())
  )`);
  db.exec("CREATE INDEX IF NOT EXISTS idx_album_novel_jobs_album ON album_novel_jobs(album_id)");
} catch { /* already exists */ }

try { db.exec("ALTER TABLE music_jobs ADD COLUMN enhanced_prompt TEXT"); } catch { /* already exists */ }
try { db.exec("ALTER TABLE music_jobs ADD COLUMN timepoints_json TEXT"); } catch { /* already exists */ }
try { db.exec("ALTER TABLE novel_jobs ADD COLUMN timepoints_json TEXT"); } catch { /* already exists */ }
try { db.exec("ALTER TABLE music_jobs ADD COLUMN title TEXT"); } catch { /* already exists */ }
try { db.exec("ALTER TABLE music_jobs ADD COLUMN lyrics TEXT"); } catch { /* already exists */ }

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

  insertMusicJob:        db.prepare("INSERT INTO music_jobs (id, phone, prompt, title, enhanced_prompt, timepoints_json, lyrics) VALUES (?, ?, ?, ?, ?, ?, ?)"),
  getMusicJob:           db.prepare("SELECT * FROM music_jobs WHERE id = ?"),
  updateMusicJob:        db.prepare("UPDATE music_jobs SET status = ?, audio_url = ?, error = ?, enhanced_prompt = COALESCE(?, enhanced_prompt), timepoints_json = COALESCE(?, timepoints_json), lyrics = COALESCE(?, lyrics) WHERE id = ?"),
  renameMusicJob:        db.prepare("UPDATE music_jobs SET title = ? WHERE id = ? AND phone = ?"),
  getMusicJobsByPhone:   db.prepare("SELECT id, title, prompt, enhanced_prompt, timepoints_json, lyrics, status, audio_url, error, credits_used, created_at FROM music_jobs WHERE phone = ? ORDER BY created_at DESC LIMIT 50"),

  insertAlbum:           db.prepare("INSERT INTO albums (id, phone, title, theme, song_count, credits_charged, music_job_ids) VALUES (?, ?, ?, ?, ?, ?, ?)"),
  upsertAlbum:           db.prepare(`INSERT INTO albums (id, phone, title, theme, song_count, credits_charged, status, music_job_ids, cover_url, created_at)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                           ON CONFLICT(id) DO UPDATE SET
                             title = excluded.title,
                             status = excluded.status,
                             music_job_ids = excluded.music_job_ids,
                             cover_url = excluded.cover_url`),
  getAlbum:              db.prepare("SELECT * FROM albums WHERE id = ?"),
  updateAlbumStatus:     db.prepare("UPDATE albums SET status = ? WHERE id = ?"),
  updateAlbumJobIds:     db.prepare("UPDATE albums SET music_job_ids = ? WHERE id = ?"),
  updateAlbumCoverUrl:   db.prepare("UPDATE albums SET cover_url = ? WHERE id = ?"),
  renameAlbum:           db.prepare("UPDATE albums SET title = ? WHERE id = ? AND phone = ?"),
  getAlbumsByPhone:      db.prepare("SELECT * FROM albums WHERE phone = ? ORDER BY created_at DESC LIMIT 30"),
  getAlbumsForJobLookup: db.prepare("SELECT id, theme FROM albums WHERE phone = ?"),
  getStaleAlbums:        db.prepare("SELECT * FROM albums WHERE status = 'generating' AND created_at < ?"),

  insertAlbumNovelJob:   db.prepare("INSERT INTO album_novel_jobs (id, album_id, phone, credits_charged, song_count) VALUES (?, ?, ?, ?, ?)"),
  getAlbumNovelJob:      db.prepare("SELECT * FROM album_novel_jobs WHERE id = ?"),
  updateAlbumNovelJob:   db.prepare("UPDATE album_novel_jobs SET status = ?, songs_done = COALESCE(?, songs_done), final_video_url = COALESCE(?, final_video_url), error = COALESCE(?, error) WHERE id = ?"),

  insertNovelJob:        db.prepare("INSERT INTO novel_jobs (id, music_job_id, phone) VALUES (?, ?, ?)"),
  getNovelJob:           db.prepare("SELECT * FROM novel_jobs WHERE id = ?"),
  updateNovelJob:        db.prepare("UPDATE novel_jobs SET status = ?, image_urls_json = COALESCE(?, image_urls_json), timepoints_json = COALESCE(?, timepoints_json), video_url = COALESCE(?, video_url), error = COALESCE(?, error) WHERE id = ?"),
  getNovelJobsByPhone:   db.prepare("SELECT * FROM novel_jobs WHERE phone = ? ORDER BY created_at DESC LIMIT 20"),
  getLatestNovelJobWithImages: db.prepare("SELECT * FROM novel_jobs WHERE music_job_id = ? AND phone = ? AND image_urls_json IS NOT NULL AND status IN ('awaiting_approval','assembling','uploading','completed') ORDER BY created_at DESC LIMIT 1"),
  getNovelSummariesForPhone:  db.prepare("SELECT id, music_job_id, status, image_urls_json, video_url FROM novel_jobs WHERE phone = ? AND image_urls_json IS NOT NULL GROUP BY music_job_id HAVING created_at = MAX(created_at)"),
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
  } catch (err: any) {
    if (!err?.message?.includes("UNIQUE")) throw err;
  }
  return stmts.getUser.get(phone) as { phone: string; credits: number };
}

export function getOrCreateUser(phone: string): { phone: string; credits: number } {
  const existing = stmts.getUser.get(phone) as { phone: string; credits: number } | undefined;
  if (existing) return existing;
  stmts.insertUser.run(phone);
  return { phone, credits: 0 };
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

export function hasRedeemedPromo(phone: string, code: string): boolean {
  return !!stmts.hasRedeemedPromo.get(phone, code);
}

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

// ── Music jobs ────────────────────────────────────────────────────────────────

export function createMusicJob(id: string, phone: string, prompt: string, title?: string, enhancedPrompt?: string, timepointsJson?: string, lyrics?: string): void {
  stmts.insertMusicJob.run(id, phone, prompt, title ?? null, enhancedPrompt ?? null, timepointsJson ?? null, lyrics ?? null);
}

export function getMusicJob(id: string) {
  return stmts.getMusicJob.get(id) as {
    id: string; phone: string; prompt: string; title: string | null;
    enhanced_prompt: string | null; timepoints_json: string | null;
    lyrics: string | null; status: string;
    audio_url: string | null; error: string | null; credits_used: number;
  } | undefined;
}

export function renameMusicJob(id: string, phone: string, title: string): boolean {
  return stmts.renameMusicJob.run(title, id, phone).changes > 0;
}

export function updateMusicJob(id: string, status: string, audioUrl?: string, error?: string, enhancedPrompt?: string, timepointsJson?: string, lyrics?: string): void {
  stmts.updateMusicJob.run(status, audioUrl ?? null, error ?? null, enhancedPrompt ?? null, timepointsJson ?? null, lyrics ?? null, id);
}

export function getMusicJobsByPhone(phone: string) {
  return stmts.getMusicJobsByPhone.all(phone) as Array<{
    id: string; title: string | null; prompt: string; enhanced_prompt: string | null;
    timepoints_json: string | null; lyrics: string | null; status: string;
    audio_url: string | null; error: string | null; credits_used: number; created_at: number;
  }>;
}

// ── Novel jobs ────────────────────────────────────────────────────────────────

export function createNovelJob(id: string, musicJobId: string, phone: string): void {
  stmts.insertNovelJob.run(id, musicJobId, phone);
}

export function getNovelJob(id: string) {
  return stmts.getNovelJob.get(id) as {
    id: string; music_job_id: string; phone: string; status: string;
    image_urls_json: string | null; timepoints_json: string | null;
    video_url: string | null; error: string | null;
    credits_used: number; created_at: number;
  } | undefined;
}

export function updateNovelJob(
  id: string,
  status: string,
  imageUrls?: string[] | null,
  timepointsJson?: string | null,
  videoUrl?: string | null,
  error?: string | null,
): void {
  stmts.updateNovelJob.run(
    status,
    imageUrls !== undefined ? JSON.stringify(imageUrls) : null,
    timepointsJson ?? null,
    videoUrl ?? null,
    error ?? null,
    id,
  );
}

export function getNovelSummariesForPhone(phone: string): Record<string, { status: string; imageCount: number; videoUrl: string | null; novelJobId: string | null }> {
  const rows = stmts.getNovelSummariesForPhone.all(phone) as Array<{
    id: string; music_job_id: string; status: string; image_urls_json: string | null; video_url: string | null;
  }>;
  const map: Record<string, { status: string; imageCount: number; videoUrl: string | null; novelJobId: string | null }> = {};
  for (const r of rows) {
    const images = r.image_urls_json ? (JSON.parse(r.image_urls_json) as string[]) : [];
    map[r.music_job_id] = { status: r.status, imageCount: images.length, videoUrl: r.video_url, novelJobId: r.id };
  }
  return map;
}

export function getLatestNovelJobWithImages(musicJobId: string, phone: string) {
  return stmts.getLatestNovelJobWithImages.get(musicJobId, phone) as {
    id: string; music_job_id: string; phone: string; status: string;
    image_urls_json: string | null; timepoints_json: string | null;
    video_url: string | null; error: string | null;
    credits_used: number; created_at: number;
  } | undefined;
}

export function getNovelJobsByPhone(phone: string) {
  return stmts.getNovelJobsByPhone.all(phone) as Array<{
    id: string; music_job_id: string; phone: string; status: string;
    image_urls_json: string | null; video_url: string | null; error: string | null;
    credits_used: number; created_at: number;
  }>;
}

export interface ShowcaseItem {
  type: "video" | "audio";
  title: string;
  theme: string | null;
  url: string;
  music_url: string | null;
}

const showcaseVideosStmt = db.prepare(`
  SELECT 'video' as type,
    COALESCE(music_vibe, theme, 'Musik AI') as title,
    theme,
    video_url as url,
    music_url
  FROM projects
  WHERE status = 'completed' AND video_url IS NOT NULL
  ORDER BY stage3_completed_at DESC
  LIMIT 8
`);

const showcaseAudioStmt = db.prepare(`
  SELECT 'audio' as type,
    COALESCE(title, prompt, 'Musik AI') as title,
    NULL as theme,
    audio_url as url,
    NULL as music_url
  FROM music_jobs
  WHERE status = 'completed' AND audio_url IS NOT NULL
  ORDER BY created_at DESC
  LIMIT 8
`);

// ── Social proof stats ──────────────────────────────────────────────────────

const INDO_NAMES = ["Budi","Siti","Rina","Dian","Agus","Dewi","Reza","Fitri","Andi","Maya","Bayu","Nisa","Fajar","Lina","Rizki","Ayu","Hendra","Putri","Yudi","Sari","Joko","Wulan","Eko","Tari","Doni","Rini","Wahyu","Indah","Fandi","Citra"];
const INDO_CITIES = ["Jakarta","Surabaya","Bandung","Medan","Bekasi","Tangerang","Depok","Semarang","Makassar","Palembang","Bogor","Pekanbaru","Denpasar","Yogyakarta","Malang","Balikpapan","Padang","Batam","Banjarmasin","Pontianak"];

function deriveDisplayName(phone: string): { name: string; city: string } {
  const digits = phone.replace(/\D/g, "");
  const nameIdx = parseInt(digits.slice(-3) || "0") % INDO_NAMES.length;
  const cityIdx = parseInt(digits.slice(-6, -3) || "0") % INDO_CITIES.length;
  return { name: INDO_NAMES[nameIdx], city: INDO_CITIES[cityIdx] };
}

const creatorCountStmt = db.prepare("SELECT COUNT(*) as count FROM users");
const recentJoinersStmt = db.prepare("SELECT phone, created_at FROM users ORDER BY created_at DESC LIMIT 15");
const recentPurchasesStmt = db.prepare("SELECT phone, package_name, paid_at FROM transactions WHERE status = 'PAID' ORDER BY paid_at DESC LIMIT 10");

export interface SocialProofItem {
  name: string;
  city: string;
  action: string;
  package?: string;
}

export function getSocialProof(): { creatorCount: number; recentActivity: SocialProofItem[] } {
  const { count } = creatorCountStmt.get() as { count: number };
  const joiners = recentJoinersStmt.all() as { phone: string; created_at: number }[];
  const purchases = recentPurchasesStmt.all() as { phone: string; package_name: string; paid_at: number }[];

  // Merge joiners and purchases into a deduplicated, time-sorted list
  const merged: { phone: string; at: number; action: string; package?: string }[] = [
    ...joiners.map(j => ({ phone: j.phone, at: j.created_at, action: "bergabung" })),
    ...purchases.map(p => ({ phone: p.phone, at: p.paid_at ?? 0, action: "upgrade", package: p.package_name })),
  ];
  merged.sort((a, b) => b.at - a.at);

  // Deduplicate by phone, keep most recent action
  const seen = new Set<string>();
  const activity: SocialProofItem[] = [];
  for (const item of merged) {
    if (seen.has(item.phone)) continue;
    seen.add(item.phone);
    const { name, city } = deriveDisplayName(item.phone);
    activity.push({ name, city, action: item.action, package: item.package });
    if (activity.length >= 15) break;
  }

  return { creatorCount: Math.max(count, 50), recentActivity: activity };
}

export function getShowcaseItems(): ShowcaseItem[] {
  const videos = showcaseVideosStmt.all() as ShowcaseItem[];
  const audio = showcaseAudioStmt.all() as ShowcaseItem[];
  const result: ShowcaseItem[] = [];
  const max = Math.max(videos.length, audio.length);
  for (let i = 0; i < max; i++) {
    if (videos[i]) result.push(videos[i]);
    if (audio[i]) result.push(audio[i]);
  }
  return result.slice(0, 12);
}

// ── Albums ────────────────────────────────────────────────────────────────────

export interface Album {
  id: string; phone: string; title: string | null; theme: string;
  song_count: number; credits_charged: number;
  status: string; music_job_ids: string; cover_url: string | null; created_at: number;
}

export function createAlbum(data: {
  id: string; phone: string; title?: string; theme: string;
  songCount: number; creditsCharged: number; musicJobIds: string[];
}): void {
  stmts.insertAlbum.run(data.id, data.phone, data.title ?? null, data.theme, data.songCount, data.creditsCharged, JSON.stringify(data.musicJobIds));
}

export function getAlbum(id: string): Album | undefined {
  return stmts.getAlbum.get(id) as Album | undefined;
}

export function updateAlbumStatus(id: string, status: string): void {
  stmts.updateAlbumStatus.run(status, id);
}

export function updateAlbumJobIds(id: string, musicJobIds: string[]): void {
  stmts.updateAlbumJobIds.run(JSON.stringify(musicJobIds), id);
}

export function updateAlbumCoverUrl(id: string, coverUrl: string): void {
  stmts.updateAlbumCoverUrl.run(coverUrl, id);
}

export function renameAlbum(id: string, phone: string, title: string): boolean {
  return stmts.renameAlbum.run(title, id, phone).changes > 0;
}

export function getAlbumsByPhone(phone: string): Album[] {
  return stmts.getAlbumsByPhone.all(phone) as Album[];
}

export async function getAlbumsByPhoneAsync(phone: string): Promise<Album[]> {
  const local = stmts.getAlbumsByPhone.all(phone) as Album[];
  if (local.length > 0) return local;

  // Local cache is empty — try Supabase
  const remote = await getAlbumsByPhoneFromSupabase(phone);
  if (!remote || remote.length === 0) return [];

  // Hydrate local SQLite
  const upsert = db.transaction(() => {
    for (const a of remote) {
      const jobIds = Array.isArray(a.music_job_ids)
        ? JSON.stringify(a.music_job_ids)
        : (typeof a.music_job_ids === "string" ? a.music_job_ids : "[]");
      const createdAtUnix = a.created_at
        ? Math.floor(new Date(a.created_at).getTime() / 1000)
        : Math.floor(Date.now() / 1000);
      try {
        stmts.upsertAlbum.run(
          a.id, a.phone, a.title ?? null, a.theme,
          a.song_count, a.credits_charged, a.status,
          jobIds, a.cover_url ?? null, createdAtUnix,
        );
      } catch (e) {
        console.error("[db] upsertAlbum from Supabase failed:", e);
      }
    }
  });
  upsert();

  return stmts.getAlbumsByPhone.all(phone) as Album[];
}

export function getStaleAlbums(olderThanUnix: number): Album[] {
  return stmts.getStaleAlbums.all(olderThanUnix) as Album[];
}

export function getAlbumMapForPhone(phone: string): Record<string, { albumId: string; albumTheme: string; albumTitle: string | null; albumCoverUrl: string | null }> {
  const albums = stmts.getAlbumsByPhone.all(phone) as Album[];
  const map: Record<string, { albumId: string; albumTheme: string; albumTitle: string | null; albumCoverUrl: string | null }> = {};
  for (const album of albums) {
    try {
      const jobIds: string[] = JSON.parse(album.music_job_ids);
      for (const jobId of jobIds) {
        map[jobId] = { albumId: album.id, albumTheme: album.theme, albumTitle: album.title, albumCoverUrl: album.cover_url };
      }
    } catch { /* skip malformed */ }
  }
  return map;
}

// ── Album Novel jobs ──────────────────────────────────────────────────────────

export interface AlbumNovelJob {
  id: string; album_id: string; phone: string;
  status: string; songs_done: number; song_count: number;
  final_video_url: string | null; error: string | null;
  credits_charged: number; created_at: number;
}

export function createAlbumNovelJob(id: string, albumId: string, phone: string, creditsCharged: number, songCount: number): void {
  stmts.insertAlbumNovelJob.run(id, albumId, phone, creditsCharged, songCount);
}

export function getAlbumNovelJob(id: string): AlbumNovelJob | undefined {
  return stmts.getAlbumNovelJob.get(id) as AlbumNovelJob | undefined;
}

export function updateAlbumNovelJob(
  id: string,
  status: string,
  songsDone?: number | null,
  finalVideoUrl?: string | null,
  error?: string | null,
): void {
  stmts.updateAlbumNovelJob.run(status, songsDone ?? null, finalVideoUrl ?? null, error ?? null, id);
}

export default db;
