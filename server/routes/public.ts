import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { getShowcaseItems, getSocialProof } from "../lib/db.js";

const router = Router();

const INDO_NAMES = ["Budi","Siti","Rina","Dian","Agus","Dewi","Reza","Fitri","Andi","Maya","Bayu","Nisa","Fajar","Lina","Rizki","Ayu","Hendra","Putri","Yudi","Sari","Joko","Wulan","Eko","Tari","Doni","Rini","Wahyu","Indah","Fandi","Citra"];
const INDO_CITIES = ["Jakarta","Surabaya","Bandung","Medan","Bekasi","Tangerang","Depok","Semarang","Makassar","Palembang","Bogor","Pekanbaru","Denpasar","Yogyakarta","Malang","Balikpapan","Padang","Batam","Banjarmasin","Pontianak"];

function deriveDisplayName(phone: string): { name: string; city: string } {
  const digits = phone.replace(/\D/g, "");
  const nameIdx = parseInt(digits.slice(-3) || "0") % INDO_NAMES.length;
  const cityIdx = parseInt(digits.slice(-6, -3) || "0") % INDO_CITIES.length;
  return { name: INDO_NAMES[nameIdx], city: INDO_CITIES[cityIdx] };
}

router.get("/showcase", async (_req, res) => {
  if (supabase) {
    try {
      const [audioRes, videoRes] = await Promise.all([
        supabase
          .from("music_jobs")
          .select("prompt, audio_url")
          .eq("status", "completed")
          .not("audio_url", "is", null)
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("novel_jobs")
          .select("video_url")
          .eq("status", "completed")
          .not("video_url", "is", null)
          .order("created_at", { ascending: false })
          .limit(8),
      ]);

      const audio = (audioRes.data ?? []).map(j => ({
        type: "audio",
        title: (j as any).prompt ?? "Musik AI",
        url: (j as any).audio_url,
        music_url: null,
        theme: null,
      }));
      const videos = (videoRes.data ?? []).map(j => ({
        type: "video",
        title: "Musik Novel",
        url: (j as any).video_url,
        music_url: null,
        theme: null,
      }));

      const items: unknown[] = [];
      const max = Math.max(audio.length, videos.length);
      for (let i = 0; i < max; i++) {
        if (videos[i]) items.push(videos[i]);
        if (audio[i]) items.push(audio[i]);
      }
      return res.json({ items });
    } catch (err) {
      console.error("[Public] showcase Supabase error:", err);
    }
  }
  return res.json({ items: getShowcaseItems() });
});

router.get("/stats", async (_req, res) => {
  if (supabase) {
    try {
      const [countRes, joinersRes, purchasesRes] = await Promise.all([
        supabase.from("users").select("phone", { count: "exact", head: true }),
        supabase.from("users").select("phone, last_login_at").order("last_login_at", { ascending: false }).limit(15),
        supabase.from("payment_transactions").select("phone, package_name, created_at").eq("status", "PAID").order("created_at", { ascending: false }).limit(10),
      ]);

      const count = Math.max(countRes.count ?? 0, 50);

      type Joiner = { phone: string; last_login_at: string };
      type Purchase = { phone: string; package_name: string; created_at: string };

      const merged: { phone: string; at: number; action: string; package?: string }[] = [
        ...(joinersRes.data ?? []).map((j: Joiner) => ({
          phone: j.phone,
          at: new Date(j.last_login_at).getTime(),
          action: "bergabung",
        })),
        ...(purchasesRes.data ?? []).map((p: Purchase) => ({
          phone: p.phone,
          at: new Date(p.created_at).getTime(),
          action: "upgrade",
          package: p.package_name,
        })),
      ];
      merged.sort((a, b) => b.at - a.at);

      const seen = new Set<string>();
      const activity: { name: string; city: string; action: string; package?: string }[] = [];
      for (const item of merged) {
        if (seen.has(item.phone)) continue;
        seen.add(item.phone);
        const { name, city } = deriveDisplayName(item.phone);
        activity.push({ name, city, action: item.action, package: item.package });
        if (activity.length >= 15) break;
      }

      return res.json({ creatorCount: count, recentActivity: activity });
    } catch (err) {
      console.error("[Public] stats Supabase error:", err);
    }
  }
  return res.json(getSocialProof());
});

export default router;
