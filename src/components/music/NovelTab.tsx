import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { apiFetch } from "../../lib/api.ts";
import { RotatingText } from "../UI.tsx";
import NovelCreator from "./NovelCreator.tsx";

interface MusicJob {
  id: string;
  title: string | null;
  prompt: string;
  status: string;
  audio_url: string | null;
  created_at: number;
}

interface NovelTabProps {
  token: string;
  credits: number;
  onCreditsUpdate: (n: number) => void;
  onTopUp: () => void;
}

const MULTI_NOVEL_MSGS = [
  "Bikin storyboard tiap lagu...",
  "Generate karakter & visual... 🎨",
  "Assembling video per lagu...",
  "Gabungin semua scene jadi satu film...",
  "Rendering adegan sinematik... 🎬",
  "Novel musikmu hampir jadi!",
];

function formatDate(unix: number) {
  return new Date(unix * 1000).toLocaleDateString("id-ID", {
    day: "numeric", month: "short", year: "numeric",
  });
}

type View = "list" | "single" | "multi-generating" | "multi-done" | "multi-error";

export default function NovelTab({ token, credits, onCreditsUpdate, onTopUp }: NovelTabProps) {
  const [jobs, setJobs] = useState<MusicJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [view, setView] = useState<View>("list");
  const [singleJob, setSingleJob] = useState<MusicJob | null>(null);

  const [multiSongsDone, setMultiSongsDone] = useState(0);
  const [multiSongCount, setMultiSongCount] = useState(0);
  const [multiVideoUrl, setMultiVideoUrl] = useState<string | null>(null);
  const [multiError, setMultiError] = useState("");
  const multiPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    apiFetch("/api/music/history", token, { method: "GET" })
      .then(r => r.json())
      .then((data: { jobs?: MusicJob[]; error?: string }) => {
        if (data.jobs) setJobs(data.jobs.filter(j => j.status === "completed" && j.audio_url));
        else setLoadError(data.error ?? "Gagal memuat riwayat");
      })
      .catch(() => setLoadError("Gagal memuat riwayat"))
      .finally(() => setLoading(false));
  }, [token]);

  const stopMultiPoll = useCallback(() => {
    if (multiPollRef.current) { clearInterval(multiPollRef.current); multiPollRef.current = null; }
  }, []);

  useEffect(() => () => stopMultiPoll(), [stopMultiPoll]);

  function toggleSelect(id: string) {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  function handleBackToList() {
    stopMultiPoll();
    setView("list");
    setSingleJob(null);
    setMultiVideoUrl(null);
    setMultiError("");
  }

  async function handleProceed() {
    if (selectedIds.length === 0) return;

    if (selectedIds.length === 1) {
      const job = jobs.find(j => j.id === selectedIds[0]);
      if (job) { setSingleJob(job); setView("single"); }
      return;
    }

    // Multi-song: call generate-from-songs
    const creditsNeeded = selectedIds.length * 50;
    if (credits < creditsNeeded) { onTopUp(); return; }

    setMultiSongCount(selectedIds.length);
    setMultiSongsDone(0);
    setView("multi-generating");

    try {
      const res = await apiFetch("/api/album-novel/generate-from-songs", token, {
        method: "POST",
        body: JSON.stringify({ musicJobIds: selectedIds }),
      });
      const data = await res.json() as { novelJobId?: string; error?: string; creditsRemaining?: number };
      if (!res.ok || !data.novelJobId) {
        setMultiError(data.error ?? "Gagal mulai generasi");
        setView("multi-error");
        return;
      }
      if (data.creditsRemaining !== undefined) onCreditsUpdate(data.creditsRemaining);

      const jobId = data.novelJobId;
      stopMultiPoll();
      multiPollRef.current = setInterval(async () => {
        try {
          const r = await apiFetch(`/api/album-novel/status/${jobId}`, token);
          if (!r.ok) return;
          const s = await r.json() as { status: string; songsDone: number; songCount: number; finalVideoUrl: string | null; error: string | null };
          setMultiSongsDone(s.songsDone);
          if (s.status === "completed" || s.status === "failed") {
            stopMultiPoll();
            if (s.status === "completed" && s.finalVideoUrl) {
              setMultiVideoUrl(s.finalVideoUrl);
              setView("multi-done");
            } else {
              setMultiError(s.error ?? "Gagal buat novel");
              setView("multi-error");
            }
          }
        } catch { /* keep polling */ }
      }, 10000);
    } catch {
      setMultiError("Gagal terhubung ke server");
      setView("multi-error");
    }
  }

  // ── Single song view ──────────────────────────────────────────────────────

  if (view === "single" && singleJob) {
    return (
      <div className="max-w-2xl mx-auto py-2">
        <button
          onClick={handleBackToList}
          className="flex items-center gap-1.5 text-xs text-[var(--text-faint)] hover:text-[var(--text-muted)] transition-colors mb-5"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Pilih lagu lain
        </button>
        <div className="card-elevated p-4 rounded-2xl mb-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] mb-1">Lagu dipilih</p>
          <p className="text-sm font-medium text-[var(--text-primary)]">
            {singleJob.title || singleJob.prompt || "Musik tanpa judul"}
          </p>
          {singleJob.title && (
            <p className="text-[11px] text-[var(--text-faint)] mt-0.5 line-clamp-1">{singleJob.prompt}</p>
          )}
        </div>
        <div className="card-elevated p-4 rounded-2xl">
          <NovelCreator
            musicJobId={singleJob.id}
            token={token}
            credits={credits}
            onCreditsUpdate={onCreditsUpdate}
            onTopUp={onTopUp}
            onClose={handleBackToList}
          />
        </div>
      </div>
    );
  }

  // ── Multi-song generating view ────────────────────────────────────────────

  if (view === "multi-generating") {
    return (
      <div className="max-w-2xl mx-auto py-8 space-y-6 text-center">
        <div className="flex items-end justify-center gap-0.5 h-14">
          {Array.from({ length: 16 }, (_, i) => (
            <div
              key={i}
              className="w-1.5 rounded-full waveform-bar"
              style={{
                height: `${30 + Math.sin(i * 0.9) * 20}%`,
                background: `hsl(${350 - i * 5}, 90%, ${55 + Math.sin(i * 0.6) * 10}%)`,
                animationDelay: `${i * 0.09}s`,
              }}
            />
          ))}
        </div>
        <div className="space-y-2">
          <p className="font-bold text-[var(--text-primary)]">
            <RotatingText messages={MULTI_NOVEL_MSGS} interval={4000} />
          </p>
          <p className="text-sm text-[var(--text-muted)]">
            {multiSongsDone} dari {multiSongCount} video selesai
          </p>
        </div>
        <div className="max-w-xs mx-auto h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,45,85,0.1)" }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: multiSongCount > 0 ? `${(multiSongsDone / multiSongCount) * 100}%` : "4%",
              background: "linear-gradient(90deg, #ff2d55, #ff6b35)",
            }}
          />
        </div>
        <p className="text-xs text-[var(--text-faint)]">Ini butuh beberapa menit, santai dulu ☕</p>
      </div>
    );
  }

  // ── Multi-song done view ──────────────────────────────────────────────────

  if (view === "multi-done" && multiVideoUrl) {
    return (
      <div className="max-w-2xl mx-auto py-4 space-y-5">
        <button onClick={handleBackToList} className="flex items-center gap-1.5 text-xs text-[var(--text-faint)] hover:text-[var(--text-muted)] transition-colors">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          Pilih lagu lain
        </button>
        <div className="text-center space-y-1">
          <div className="text-3xl">🎬</div>
          <h3 className="heading-display text-lg text-[var(--text-primary)]">Novel Musik Selesai!</h3>
          <p className="text-sm text-[var(--text-muted)]">{multiSongCount} lagu digabung jadi satu film</p>
        </div>
        <video
          controls
          src={multiVideoUrl}
          className="w-full rounded-2xl overflow-hidden"
          style={{ maxHeight: "320px", background: "#000" }}
        />
      </div>
    );
  }

  // ── Multi-song error view ─────────────────────────────────────────────────

  if (view === "multi-error") {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
        <div className="text-4xl">😔</div>
        <p className="font-bold text-[var(--text-primary)]">Waduh, ada yang gagal</p>
        <p className="text-sm text-[var(--text-muted)]">{multiError || "Coba lagi ya!"}</p>
        <button
          onClick={handleBackToList}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #ff2d55, #ff6b35)" }}
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  // ── Song selection list ───────────────────────────────────────────────────

  const creditsCost = selectedIds.length * 50;
  const canAfford = credits >= creditsCost;

  return (
    <div className="max-w-2xl mx-auto space-y-5 py-2">
      <div className="text-center space-y-1.5">
        <h2 className="heading-display text-gradient-fire" style={{ fontSize: "clamp(1.6rem, 5vw, 2.2rem)" }}>
          Novel Musik
        </h2>
        <p className="text-sm text-[var(--text-muted)]">Pilih 1 lagu atau lebih untuk divisualisasi 🎬</p>
      </div>

      {/* Action bar — shown when any songs selected */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            key="action-bar"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="card-elevated p-3 rounded-2xl flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: "var(--accent-red)" }}>
                {selectedIds.length}
              </span>
              <p className="text-sm text-[var(--text-muted)]">
                {selectedIds.length === 1 ? "lagu dipilih" : "lagu dipilih"}
                {selectedIds.length > 1 && <span className="ml-1 text-[var(--text-faint)]">· {creditsCost} kredit</span>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedIds([])}
                className="text-xs text-[var(--text-faint)] hover:text-[var(--text-muted)] transition-colors"
              >
                Batal
              </button>
              {!canAfford && selectedIds.length > 1 ? (
                <button
                  onClick={onTopUp}
                  className="text-xs font-bold px-3 py-1.5 rounded-xl"
                  style={{ background: "rgba(255,45,85,0.12)", color: "var(--accent-red)" }}
                >
                  Top up dulu →
                </button>
              ) : (
                <button
                  onClick={() => void handleProceed()}
                  className="text-xs font-bold px-3 py-1.5 rounded-xl text-white"
                  style={{ background: "linear-gradient(135deg, #ff2d55, #ff6b35)" }}
                >
                  {selectedIds.length === 1
                    ? "Buat Novel →"
                    : `Buat ${selectedIds.length} Novel →`}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {loading && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="flex gap-1.5">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-2 h-2 rounded-full" style={{ background: "var(--accent-red)", animation: "waveform-bounce 1s ease-in-out infinite", animationDelay: `${i * 0.18}s` }} />
              ))}
            </div>
            <p className="text-sm text-[var(--text-faint)]">Memuat lagumu...</p>
          </motion.div>
        )}

        {!loading && loadError && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20 space-y-3">
            <div className="text-3xl">😓</div>
            <p className="text-sm text-[var(--text-muted)]">{loadError}</p>
          </motion.div>
        )}

        {!loading && !loadError && jobs.length === 0 && (
          <motion.div key="empty" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center py-20 space-y-4">
            <div className="text-5xl float-anim">🎵</div>
            <p className="font-bold text-[var(--text-primary)]">Belum ada musik yang selesai</p>
            <p className="text-sm text-[var(--text-muted)]">Bikin lagu dulu di tab Musik, baru balik ke sini!</p>
          </motion.div>
        )}

        {!loading && !loadError && jobs.length > 0 && (
          <motion.div key="list" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <p className="label-caps text-[var(--text-faint)]">Tap untuk pilih lagu</p>
            {jobs.map((job, i) => {
              const isSelected = selectedIds.includes(job.id);
              return (
                <motion.button
                  key={job.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => toggleSelect(job.id)}
                  className="w-full text-left card-elevated p-4 rounded-2xl transition-all duration-150 hover:scale-[1.01] active:scale-[0.99]"
                  style={{
                    border: isSelected ? "1.5px solid rgba(255,45,85,0.45)" : "1px solid transparent",
                    background: isSelected ? "rgba(255,45,85,0.05)" : undefined,
                  }}
                >
                  <div className="flex items-center gap-3">
                    {/* Icon / checkmark */}
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-150"
                      style={{
                        background: isSelected
                          ? "linear-gradient(135deg, #ff2d55, #ff6b35)"
                          : "linear-gradient(135deg, rgba(255,45,85,0.7), rgba(255,107,53,0.7))",
                        boxShadow: isSelected ? "0 0 12px rgba(255,45,85,0.4)" : undefined,
                      }}
                    >
                      {isSelected ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                          <path d="M9 18V5l12-2v13M6 21a3 3 0 100-6 3 3 0 000 6zm12-2a3 3 0 100-6 3 3 0 000 6z"/>
                        </svg>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)] line-clamp-1">
                        {job.title || job.prompt || "Musik tanpa judul"}
                      </p>
                      {job.title && (
                        <p className="text-[10px] text-[var(--text-faint)] line-clamp-1 mt-0.5">{job.prompt}</p>
                      )}
                      <p className="text-[11px] text-[var(--text-faint)] mt-0.5">{formatDate(job.created_at)}</p>
                    </div>

                    {isSelected && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: "rgba(255,45,85,0.12)", color: "var(--accent-red)" }}>
                        #{selectedIds.indexOf(job.id) + 1}
                      </span>
                    )}
                  </div>
                </motion.button>
              );
            })}

            {jobs.length > 1 && selectedIds.length === 0 && (
              <p className="text-center text-[11px] text-[var(--text-faint)] pt-1">
                Pilih beberapa lagu untuk digabung jadi satu film
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
