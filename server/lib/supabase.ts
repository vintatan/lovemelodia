import { createClient } from "@supabase/supabase-js";
import { bqTrackPayment } from "./bigquery.js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;

if (!url || !key) {
  console.warn("[Supabase] SUPABASE_URL or SUPABASE_SERVICE_KEY not set — tracking disabled");
}

export const supabase = url && key ? createClient(url, key) : null;

export async function recordLogin(phone: string): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from("users").upsert(
      { phone, app: "kreasi", last_login_at: new Date().toISOString() },
      { onConflict: "phone", ignoreDuplicates: false }
    );
  } catch (err) {
    console.error("[Supabase] recordLogin error:", err);
  }
}

export async function getCreditsFromSupabase(phone: string): Promise<number | null> {
  if (!supabase) return null;
  const { data } = await supabase.from("user_credits").select("credits").eq("phone", phone).single();
  return (data as { credits: number } | null)?.credits ?? null;
}

export async function syncCreditsToSupabase(phone: string, newBalance: number, txType: "deduct" | "refund" | "topup_approved", txAmount: number): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from("user_credits").upsert(
      { phone, credits: newBalance, updated_at: new Date().toISOString() },
      { onConflict: "phone", ignoreDuplicates: false }
    );
    await supabase.from("credit_transactions").insert({ phone, amount: txType === "deduct" ? -txAmount : txAmount, type: txType });
  } catch (err) {
    console.error("[Supabase] syncCredits error:", err);
  }
}

export async function createTransactionInSupabase(tx: {
  externalId: string; phone: string; packageName: string;
  credits: number; amount: number; currency: string;
}): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from("payment_transactions").upsert(
      { external_id: tx.externalId, phone: tx.phone, package_name: tx.packageName,
        credits: tx.credits, amount: tx.amount, currency: tx.currency, status: "PENDING" },
      { onConflict: "external_id", ignoreDuplicates: true }
    );
  } catch (err) {
    console.error("[Supabase] createTransaction error:", err);
  }
}

export async function getTransactionFromSupabase(externalId: string): Promise<{
  phone: string; package_name: string; credits: number; amount: number; currency: string; status: string;
} | null> {
  if (!supabase) return null;
  const { data } = await supabase.from("payment_transactions")
    .select("phone, package_name, credits, amount, currency, status")
    .eq("external_id", externalId).single();
  return (data as any) ?? null;
}

export async function hasRedeemedPromoInSupabase(phone: string, code: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data } = await supabase.from("redeemed_promos").select("phone").eq("phone", phone).eq("code", code).maybeSingle();
    return data !== null;
  } catch {
    return false;
  }
}

export async function recordPromoRedemptionInSupabase(phone: string, code: string, credits: number): Promise<boolean> {
  if (!supabase) return true;
  try {
    const { error } = await supabase.from("redeemed_promos").insert({ phone, code, credits, redeemed_at: new Date().toISOString() });
    if (error) {
      if (error.code === "23505") return false;
      throw error;
    }
    return true;
  } catch (err) {
    console.error("[Supabase] recordPromoRedemption error:", err);
    return false;
  }
}

export async function createMusicJobInSupabase(job: {
  id: string; phone: string; prompt: string; enhanced_prompt?: string | null;
}): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from("music_jobs").upsert(
      { id: job.id, phone: job.phone, prompt: job.prompt,
        enhanced_prompt: job.enhanced_prompt ?? null,
        status: "pending", created_at: new Date().toISOString() },
      { onConflict: "id", ignoreDuplicates: true }
    );
  } catch (err) {
    console.error("[Supabase] createMusicJob error:", err);
  }
}

export async function updateMusicJobInSupabase(id: string, status: string, audioUrl?: string | null, error?: string | null, enhancedPrompt?: string | null, lyrics?: string | null): Promise<void> {
  if (!supabase) return;
  try {
    const updates: Record<string, unknown> = { status };
    if (audioUrl !== undefined) updates.audio_url = audioUrl;
    if (error !== undefined) updates.error = error;
    if (enhancedPrompt !== undefined) updates.enhanced_prompt = enhancedPrompt;
    if (lyrics !== undefined) updates.lyrics = lyrics;
    await supabase.from("music_jobs").update(updates).eq("id", id);
  } catch (err) {
    console.error("[Supabase] updateMusicJob error:", err);
  }
}

export async function createNovelJobInSupabase(job: {
  id: string; musicJobId: string; phone: string;
}): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from("novel_jobs").upsert(
      { id: job.id, music_job_id: job.musicJobId, phone: job.phone,
        status: "pending", credits_used: 50, created_at: new Date().toISOString() },
      { onConflict: "id", ignoreDuplicates: true }
    );
  } catch (err) {
    console.error("[Supabase] createNovelJob error:", err);
  }
}

export async function updateNovelJobInSupabase(
  id: string,
  status: string,
  imageUrls?: string[] | null,
  videoUrl?: string | null,
  error?: string | null,
  timepointsJson?: string | null,
): Promise<void> {
  if (!supabase) return;
  try {
    const updates: Record<string, unknown> = { status };
    if (imageUrls !== undefined) updates.image_urls_json = imageUrls ? JSON.stringify(imageUrls) : null;
    if (videoUrl !== undefined) updates.video_url = videoUrl;
    if (error !== undefined) updates.error = error;
    if (timepointsJson !== undefined) updates.timepoints_json = timepointsJson;
    await supabase.from("novel_jobs").update(updates).eq("id", id);
  } catch (err) {
    console.error("[Supabase] updateNovelJob error:", err);
  }
}

export function trackPaymentCompleted(tx: {
  external_id?: string; phone: string; package_name: string;
  credits: number; amount: number; currency: string;
}): void {
  bqTrackPayment({
    externalId: tx.external_id ?? "",
    phone: tx.phone, packageName: tx.package_name,
    credits: tx.credits, amountIdr: tx.amount, currency: tx.currency,
  });
}
