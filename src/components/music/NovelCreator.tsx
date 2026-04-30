import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { apiFetch } from "../../lib/api.ts";

interface NovelCreatorProps {
  musicJobId: string;
  token: string;
  credits: number;
  onCreditsUpdate: (n: number) => void;
  onTopUp: () => void;
  onClose: () => void;
}

type NovelPhase = "idle" | "generating" | "reviewing" | "assembling" | "done" | "error";

export default function NovelCreator({ musicJobId, token, credits, onCreditsUpdate, onTopUp, onClose }: NovelCreatorProps) {
  const [phase, setPhase] = useState<NovelPhase>("idle");
  const [jobId, setJobId] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [timepoints, setTimepoints] = useState<Array<{ timestamp: string; label: string; description: string; mood: string }>>([]);
  const [regenIdx, setRegenIdx] = useState<number | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [statusLabel, setStatusLabel] = useState("Mempersiapkan...");
  const [charImageBase64, setCharImageBase64] = useState<string | null>(null);
  const [charPreview, setCharPreview] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearTimeout(pollRef.current); pollRef.current = null; }
  }, []);
  useEffect(() => () => stopPolling(), [stopPolling]);

  function handleCharImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const result = ev.target?.result as string;
      const b64 = result.replace(/^data:image\/[a-z+]+;base64,/, "");
      if (!b64) return;
      setCharPreview(result);
      setCharImageBase64(b64);
    };
    reader.readAsDataURL(file);
  }

  async function handleStart() {
    if (credits < 50) { onTopUp(); return; }
    setPhase("generating");
    setImageUrls([]);
    setVideoUrl(null);
    setErrorMsg("");
    setStatusLabel("Membuat storyboard...");
    try {
      const res = await apiFetch("/api/novel/generate", token, {
        method: "POST",
        body: JSON.stringify({
          musicJobId,
          ...(charImageBase64 ? { characterImageBase64: charImageBase64 } : {}),
        }),
      });
      const data = await res.json() as { jobId?: string; creditsRemaining?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Gagal memulai Novel Musik");
      if (data.creditsRemaining !== undefined) onCreditsUpdate(data.creditsRemaining);
      setJobId(data.jobId!);
      pollStatus(data.jobId!);
    } catch (err: any) {
      setPhase("error");
      setErrorMsg(err.message);
    }
  }

  function pollStatus(id: string) {
    pollRef.current = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/novel/status/${id}`, token, { method: "GET" });
        const data = await res.json() as {
          status: string; imageUrls?: string[]; timepoints?: typeof timepoints; videoUrl?: string | null; error?: string;
        };
        if (data.imageUrls && data.imageUrls.length > 0) setImageUrls(data.imageUrls);
        if (data.timepoints && data.timepoints.length > 0) setTimepoints(data.timepoints);

        if (data.status === "awaiting_approval") {
          setPhase("reviewing");
          stopPolling();
        } else if (data.status === "completed" && data.videoUrl) {
          setVideoUrl(data.videoUrl);
          setPhase("done");
          stopPolling();
        } else if (data.status === "failed") {
          setPhase("error");
          setErrorMsg(data.error ?? "Generasi gagal. Kredit dikembalikan.");
          stopPolling();
        } else {
          const labels: Record<string, string> = {
            generating_images: `Membuat gambar... (${data.imageUrls?.length ?? 0} selesai)`,
            assembling: "Merakit video dari timepoints...",
            uploading: "Mengupload video...",
          };
          setStatusLabel(labels[data.status] ?? "Memproses...");
          pollStatus(id);
        }
      } catch {
        pollStatus(id);
      }
    }, 3000);
  }

  async function handleRegenImage(idx: number) {
    if (!jobId || regenIdx !== null) return;
    setRegenIdx(idx);
    try {
      await apiFetch(`/api/novel/regenerate-image/${jobId}/${idx}`, token, { method: "POST" });
      // Poll for the updated image
      const poll = async () => {
        const res = await apiFetch(`/api/novel/status/${jobId}`, token, { method: "GET" });
        const data = await res.json() as { imageUrls?: string[] };
        if (data.imageUrls?.[idx] && data.imageUrls[idx] !== imageUrls[idx]) {
          setImageUrls(data.imageUrls);
          setRegenIdx(null);
        } else {
          pollRef.current = setTimeout(poll, 3000);
        }
      };
      pollRef.current = setTimeout(poll, 3000);
    } catch {
      setRegenIdx(null);
    }
  }

  async function handleApprove() {
    if (!jobId) return;
    setApproving(true);
    try {
      const res = await apiFetch(`/api/novel/assemble/${jobId}`, token, { method: "POST" });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error ?? "Gagal memulai assembly");
      }
      setPhase("assembling");
      setStatusLabel("Merakit video...");
      pollStatus(jobId);
    } catch (err: any) {
      setErrorMsg(err.message);
      setPhase("error");
    } finally {
      setApproving(false);
    }
  }

  async function handleDownload() {
    if (!videoUrl) return;
    try {
      const res = await fetch(videoUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "kreasi-ai-novel.mp4";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      window.open(videoUrl, "_blank");
    }
  }

  async function handleCopyLink() {
    if (!videoUrl) return;
    try {
      await navigator.clipboard.writeText(videoUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }

  async function handleNativeShare() {
    if (!videoUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Novel Musikku di Kreasi AI 🎬", url: videoUrl });
      } catch { /* user cancelled */ }
    } else {
      void handleCopyLink();
    }
  }

  const NOVEL_CREDITS = 50;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
      className="space-y-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h3 className="font-bold text-[var(--text-primary)] text-base">Novel Musik</h3>
          <p className="text-xs text-[var(--text-muted)]">Musik lo jadi video visual sinematik 🎬</p>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full card-elevated text-[var(--text-faint)] hover:text-[var(--text-muted)] transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <AnimatePresence mode="wait">

        {/* ── IDLE ── */}
        {phase === "idle" && (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="space-y-2">
              <p className="label-caps text-[var(--text-faint)]">Karakter (opsional)</p>
              <p className="text-xs text-[var(--text-muted)]">Upload foto referensi agar karakter konsisten di semua scene</p>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-3 p-3 rounded-xl card-elevated cursor-pointer transition-colors"
                style={{ border: "1.5px dashed var(--border-subtle)" }}
              >
                {charPreview ? (
                  <img src={charPreview} alt="character" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-[rgba(255,45,85,0.08)] flex items-center justify-center flex-shrink-0">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-red)" strokeWidth="2" strokeLinecap="round">
                      <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                    </svg>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  {charPreview
                    ? <p className="text-xs font-medium text-[var(--text-primary)]">Karakter dipilih ✓</p>
                    : <p className="text-xs text-[var(--text-muted)]">Tap untuk upload foto karakter</p>
                  }
                  <p className="text-[10px] text-[var(--text-faint)]">JPG / PNG · Maks 5MB</p>
                </div>
                {charPreview && (
                  <button
                    onClick={e => { e.stopPropagation(); setCharPreview(null); setCharImageBase64(null); }}
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[var(--text-faint)] hover:text-red-400 transition-colors"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleCharImageChange} />
            </div>

            <div className="flex items-center justify-between text-xs px-0.5">
              <span className="text-[var(--text-muted)]">Biaya: <span className="font-bold" style={{ color: "var(--accent-red)" }}>{NOVEL_CREDITS} kredit</span></span>
              <span className="text-[var(--text-muted)]">Saldo: <span className={credits < NOVEL_CREDITS ? "text-red-400 font-bold" : "text-[var(--text-primary)] font-medium"}>{credits} kredit</span></span>
            </div>

            {credits < NOVEL_CREDITS ? (
              <button onClick={onTopUp} className="w-full py-3.5 rounded-2xl text-white font-bold text-sm bg-gradient-warm shadow-glow-amber">
                Top Up Kredit dulu yuk 🪙
              </button>
            ) : (
              <button onClick={() => void handleStart()} className="btn-primary w-full rounded-2xl py-4 text-sm">
                Bikin Novel Musik 🎬
              </button>
            )}
          </motion.div>
        )}

        {/* ── GENERATING ── */}
        {(phase === "generating" || phase === "assembling") && (
          <motion.div key="generating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <svg className="animate-spin flex-shrink-0" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent-red)" strokeWidth="2.5">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
              <span>{statusLabel}</span>
            </div>

            {/* Live storyboard grid — images pop in as they arrive */}
            {imageUrls.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: Math.max(6, imageUrls.length) }, (_, i) => {
                  const url = imageUrls[i];
                  return url ? (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: "spring", stiffness: 340, damping: 22 }}
                      className="aspect-video rounded-xl overflow-hidden"
                    >
                      <img src={url} alt={`scene ${i + 1}`} className="w-full h-full object-cover" />
                    </motion.div>
                  ) : (
                    <div key={i} className="aspect-video rounded-xl animate-pulse"
                      style={{ background: "rgba(255,45,85,0.08)", border: "1px solid rgba(255,45,85,0.1)" }}
                    />
                  );
                })}
              </div>
            )}

            {imageUrls.length === 0 && (
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="aspect-video rounded-xl animate-pulse"
                    style={{ background: "rgba(255,45,85,0.08)", border: "1px solid rgba(255,45,85,0.1)", animationDelay: `${i * 0.1}s` }}
                  />
                ))}
              </div>
            )}

            <p className="text-xs text-[var(--text-faint)] text-center">
              {phase === "assembling" ? "Sinkronisasi video dengan musik... ~1–2 menit 🎬" : "Membuat gambar... ~3–5 menit 🖼️"}
            </p>
          </motion.div>
        )}

        {/* ── REVIEWING — storyboard approval ── */}
        {phase === "reviewing" && (
          <motion.div key="reviewing" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="space-y-1">
              <p className="font-semibold text-[var(--text-primary)] text-sm">Storyboard siap! Review dulu yuk 👀</p>
              <p className="text-xs text-[var(--text-muted)]">Kalau udah oke, tap "Setujui" buat mulai bikin videonya</p>
            </div>

            {/* Full storyboard grid */}
            <div className="grid grid-cols-3 gap-2">
              {imageUrls.map((url, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 340, damping: 22, delay: i * 0.05 }}
                  className="aspect-video rounded-xl overflow-hidden relative group"
                >
                  {regenIdx === i ? (
                    <div className="w-full h-full bg-black/60 flex items-center justify-center">
                      <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                      </svg>
                    </div>
                  ) : (
                    <img src={url} alt={`scene ${i + 1}`} className="w-full h-full object-cover" />
                  )}
                  {/* Timestamp + label always visible */}
                  <div className="absolute top-1 left-1 bg-black/70 rounded px-1.5 py-0.5 flex items-center gap-1">
                    <span className="text-[8px] text-white/80 font-mono">{timepoints[i]?.timestamp ?? `${i + 1}`}</span>
                    {timepoints[i]?.label && <span className="text-[8px] text-white/60 font-medium">{timepoints[i].label}</span>}
                  </div>
                  {/* Regenerate button on hover */}
                  <button
                    onClick={() => void handleRegenImage(i)}
                    disabled={regenIdx !== null}
                    className="absolute bottom-1 right-1 bg-black/70 rounded-lg p-1 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-30"
                    title="Bikin ulang scene ini"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                      <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.32"/>
                    </svg>
                  </button>
                </motion.div>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => { setPhase("idle"); setImageUrls([]); setJobId(null); }}
                className="flex-1 py-3 rounded-2xl text-sm font-medium card-elevated text-[var(--text-muted)]"
              >
                Bikin Ulang
              </button>
              <button
                onClick={() => void handleApprove()}
                disabled={approving}
                className="flex-[2] py-3 rounded-2xl text-white font-bold text-sm transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #7c3aed 0%, #db2777 100%)", boxShadow: "0 0 16px rgba(124,58,237,0.35)" }}
              >
                {approving ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                    </svg>
                    Memulai...
                  </span>
                ) : "Setujui & Bikin Video 🎬"}
              </button>
            </div>
          </motion.div>
        )}

        {/* ── DONE ── */}
        {phase === "done" && (
          <motion.div key="done" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-4">
            <div className="text-center space-y-1">
              <div className="text-3xl">🎬</div>
              <p className="font-bold text-[var(--text-primary)]">Novel Musikmu udah jadi!</p>
              <p className="text-xs text-[var(--text-muted)]">Video sinematik tersinkron sama musikmu 🔥</p>
            </div>

            {/* Storyboard strip */}
            <div className="grid grid-cols-3 gap-2">
              {imageUrls.map((url, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 340, damping: 22, delay: i * 0.04 }}
                  className="aspect-video rounded-xl overflow-hidden"
                >
                  <img src={url} alt={`scene ${i + 1}`} className="w-full h-full object-cover" />
                </motion.div>
              ))}
            </div>

            {/* Video player */}
            {videoUrl && (
              <div className="rounded-2xl overflow-hidden bg-black">
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video src={videoUrl} controls playsInline className="w-full" style={{ maxHeight: "50vh" }} />
              </div>
            )}

            {/* Actions */}
            <div className="space-y-2">
              <button
                onClick={() => void handleDownload()}
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl card-glass-green text-sm font-semibold transition-all hover:scale-[1.01] active:scale-[0.98]"
                style={{ color: "var(--accent-green)" }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download Video
              </button>

              <div className="flex gap-2">
                <button
                  onClick={() => void handleCopyLink()}
                  className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl card-elevated text-xs font-semibold text-[var(--text-muted)] transition-all hover:scale-[1.01]"
                >
                  {copied ? (
                    <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      <span style={{ color: "var(--accent-green)" }}>Link disalin!</span>
                    </>
                  ) : (
                    <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                      </svg>
                      Copy Link
                    </>
                  )}
                </button>
                <button
                  onClick={() => void handleNativeShare()}
                  className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl card-elevated text-xs font-semibold text-[var(--text-muted)] transition-all hover:scale-[1.01]"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                  </svg>
                  Share
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── ERROR ── */}
        {phase === "error" && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-3 py-4">
            <div className="text-3xl">😓</div>
            <p className="font-bold text-red-400 text-sm">Aduh, ada error nih</p>
            <p className="text-xs text-[var(--text-muted)]">{errorMsg || "Kredit udah dikembalikan. Coba lagi ya."}</p>
            <button onClick={() => { setPhase("idle"); setImageUrls([]); setJobId(null); }} className="px-5 py-2 rounded-xl card-elevated text-sm font-medium">
              Coba Lagi
            </button>
          </motion.div>
        )}

      </AnimatePresence>
    </motion.div>
  );
}
