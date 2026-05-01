import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { apiFetch } from "../../lib/api.ts";
import ShareButtons from "./ShareButtons.tsx";
import NovelCreator from "./NovelCreator.tsx";
import { RotatingText } from "../UI.tsx";

const MUSIC_LOADING_MSGS = [
  "AI lagi garap musikmu... 🎵",
  "Lagi milih chord yang pas buat kamu...",
  "Nulis liriknya dulu ya, sabar...",
  "Atur tempo dan beat-nya sekarang...",
  "Hampir jadi, tinggal mixing! 🎧",
  "Sedang poles vokal dan instrumennya...",
  "Bentar lagi selesai, dijamin enak didengernya!",
];

const GENRES = ["Pop", "Electronic", "Jazz", "Tradisional", "Rock", "Cinematic", "R&B", "Lo-fi"];

const GENRE_DEFAULTS: Record<string, string> = {
  "Pop": "Lagu pop yang catchy dan emosional, dengan melodi yang mudah diingat",
  "Electronic": "Track electronic yang energetik dengan synthesizer yang hypnotic",
  "Jazz": "Jazz smooth yang hangat dan relaksasi, cocok buat cafe atau malam santai",
  "Tradisional": "Musik tradisional Indonesia yang kaya dengan nuansa etnik dan gamelan",
  "Rock": "Rock yang penuh energi dengan gitar distorsi dan beat yang powerful",
  "Cinematic": "Musik sinematik yang dramatis dan emosional seperti soundtrack film",
  "R&B": "R&B smooth dengan groove yang sensual dan melodi yang ekspresif",
  "Lo-fi": "Lo-fi chill yang relaxing dan dreamy, cocok buat kerja atau belajar",
};

/* ── Audio Player ────────────────────────────────────────────────── */
function AudioPlayer({ audioUrl }: { audioUrl: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.load();
    const onTime    = () => setCurrentTime(a.currentTime);
    const onLoaded  = () => setDuration(a.duration);
    const onEnded   = () => setPlaying(false);
    const onError   = () => setLoadError(true);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onLoaded);
    a.addEventListener("ended", onEnded);
    a.addEventListener("error", onError);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onLoaded);
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("error", onError);
    };
  }, [audioUrl]);

  async function togglePlay() {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      try {
        await a.play();
        setPlaying(true);
      } catch (err) {
        console.error("Audio play failed:", err);
        setLoadError(true);
      }
    }
  }

  function seek(e: React.ChangeEvent<HTMLInputElement>) {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Number(e.target.value);
  }

  function fmt(s: number) {
    if (!isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    return `${m}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
  }

  if (loadError) {
    return (
      <div className="card-glass-red p-4 text-center space-y-2">
        <p className="text-sm text-[var(--text-muted)]">Gagal load audio. Coba download langsung.</p>
      </div>
    );
  }

  return (
    <div className="card-glass-red p-4 space-y-3">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} src={audioUrl} preload="auto" crossOrigin="anonymous" />

      <div className="flex items-end justify-center gap-px h-12 px-2">
        {Array.from({ length: 48 }, (_, i) => (
          <div
            key={i}
            className={`flex-1 rounded-full ${playing ? "waveform-bar" : ""}`}
            style={{
              height: `${20 + Math.sin(i * 0.6) * 14 + Math.cos(i * 0.3) * 8}%`,
              background: playing
                ? `hsl(${350 - i * 1.5}, 88%, ${52 + Math.sin(i * 0.5) * 14}%)`
                : `rgba(255,45,85,${0.15 + Math.sin(i * 0.4) * 0.1})`,
              transition: "background 0.35s ease",
              animationDelay: `${i * 0.038}s`,
            }}
          />
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => void togglePlay()}
          className="w-11 h-11 rounded-full bg-gradient-red flex items-center justify-center shadow-glow flex-shrink-0 transition-transform active:scale-90"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="white">
              <rect x="6" y="4" width="4" height="16" rx="1.5"/>
              <rect x="14" y="4" width="4" height="16" rx="1.5"/>
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="white" style={{ marginLeft: 2 }}>
              <polygon points="5,3 19,12 5,21"/>
            </svg>
          )}
        </button>

        <div className="flex-1 space-y-1.5">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={seek}
            className="w-full"
            style={{ accentColor: "var(--accent-red)", height: 3 }}
          />
          <div className="flex justify-between text-[11px] text-[var(--text-faint)] font-mono">
            <span>{fmt(currentTime)}</span>
            <span>{fmt(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Music Creator ───────────────────────────────────────────────── */
interface MusicCreatorProps {
  token: string;
  credits: number;
  onCreditsUpdate: (n: number) => void;
  onTopUp: () => void;
}

interface MusicTimepoint {
  timestamp: string;
  label: string;
  description: string;
  mood: string;
}

const MOOD_COLORS: Record<string, string> = {
  mysterious: "#a78bfa", melancholic: "#60a5fa", tense: "#f97316",
  euphoric: "#f59e0b", triumphant: "#10b981", dreamy: "#ec4899",
  playful: "#06b6d4", longing: "#8b5cf6",
};

export default function MusicCreator({ token, credits, onCreditsUpdate, onTopUp }: MusicCreatorProps) {
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [phase, setPhase] = useState<"idle" | "generating" | "done" | "error">("idle");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [showNovel, setShowNovel] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [enhancing, setEnhancing] = useState(false);
  const [enhancedPrompt, setEnhancedPrompt] = useState<string | null>(null);
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [timepoints, setTimepoints] = useState<MusicTimepoint[]>([]);
  const [editingTitle, setEditingTitle] = useState(false);
  const [savingTitle, setSavingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoFilledRef = useRef<string>("");

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearTimeout(pollRef.current); pollRef.current = null; }
  }, []);
  useEffect(() => () => stopPolling(), [stopPolling]);

  // Auto-fill default prompt when genres change
  useEffect(() => {
    const currentIsAutoFill = prompt === autoFilledRef.current;
    if (!currentIsAutoFill && prompt !== "") return; // user has typed their own text

    if (selectedGenres.length === 0) {
      autoFilledRef.current = "";
      if (currentIsAutoFill) setPrompt("");
      return;
    }

    let defaultText: string;
    if (selectedGenres.length === 1) {
      defaultText = GENRE_DEFAULTS[selectedGenres[0]] ?? "";
    } else {
      defaultText = `Perpaduan ${selectedGenres.join(" & ")} yang unik dan berkarakter`;
    }

    autoFilledRef.current = defaultText;
    setPrompt(defaultText);
  }, [selectedGenres]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleGenre(g: string) {
    setSelectedGenres(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
    setEnhancedPrompt(null);
    setLyrics(null);
    setTimepoints([]);
  }

  async function handleEnhance() {
    const rawPrompt = prompt.trim();
    if (!rawPrompt && selectedGenres.length === 0) return;
    setEnhancing(true);
    try {
      const res = await apiFetch("/api/music/enhance-prompt", token, {
        method: "POST",
        body: JSON.stringify({ prompt: rawPrompt, genres: selectedGenres }),
      });
      const data = await res.json() as { title?: string; enhancedPrompt?: string; lyrics?: string; timepoints?: MusicTimepoint[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Gagal enhance prompt");
      setEnhancedPrompt(data.enhancedPrompt ?? null);
      setLyrics(data.lyrics ?? null);
      setTimepoints(data.timepoints ?? []);
      if (data.title && !title.trim()) setTitle(data.title);
    } catch (err: any) {
      console.error("Enhance failed:", err.message);
    } finally {
      setEnhancing(false);
    }
  }

  async function handleSaveTitle() {
    if (!currentJobId || !draftTitle.trim()) return;
    setSavingTitle(true);
    try {
      await apiFetch(`/api/music/rename/${currentJobId}`, token, {
        method: "PATCH",
        body: JSON.stringify({ title: draftTitle.trim() }),
      });
      setTitle(draftTitle.trim());
    } catch { /* ignore */ } finally {
      setSavingTitle(false);
      setEditingTitle(false);
    }
  }

  async function handleGenerate() {
    const finalPrompt = prompt.trim();
    if (!finalPrompt && selectedGenres.length === 0) return;
    if (credits < 20) { onTopUp(); return; }

    setPhase("generating");
    setErrorMsg("");
    setAudioUrl(null);

    try {
      const res = await apiFetch("/api/music/generate", token, {
        method: "POST",
        body: JSON.stringify({ prompt: finalPrompt, genres: selectedGenres, title: title.trim() || undefined, enhancedPrompt, lyrics, timepoints: timepoints.length > 0 ? timepoints : undefined }),
      });
      const data = await res.json() as { jobId?: string; creditsRemaining?: number; error?: string };
      if (res.status === 402) { onTopUp(); return; }
      if (!res.ok) throw new Error(data.error ?? "Gagal memulai generasi");
      if (data.creditsRemaining !== undefined) onCreditsUpdate(data.creditsRemaining);
      setCurrentJobId(data.jobId!);
      pollStatus(data.jobId!);
    } catch (err: any) {
      setPhase("error");
      setErrorMsg(err.message);
    }
  }

  function pollStatus(id: string) {
    pollRef.current = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/music/status/${id}`, token, { method: "GET" });
        const data = await res.json() as { status: string; audioUrl?: string; error?: string };
        if (data.status === "completed" && data.audioUrl) {
          setAudioUrl(data.audioUrl);
          setPhase("done");
        } else if (data.status === "failed") {
          setPhase("error");
          setErrorMsg(data.error ?? "Generasi musik gagal. Kredit dikembalikan.");
        } else {
          pollStatus(id);
        }
      } catch {
        pollStatus(id);
      }
    }, 3000);
  }

  async function handleDownload(url: string) {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = "kreasi-ai-musik.wav";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(url, "_blank");
    }
  }

  function handleReset() {
    stopPolling();
    setPhase("idle");
    setAudioUrl(null);
    setCurrentJobId(null);
    setShowNovel(false);
    setErrorMsg("");
    setTitle("");
    setEnhancedPrompt(null);
    setLyrics(null);
    setTimepoints([]);
    setEditingTitle(false);
  }

  const hasInput = prompt.trim().length > 0 || selectedGenres.length > 0;
  const canEnhance = hasInput && !enhancing;
  const canGenerate = timepoints.length > 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-2">
      {/* Header */}
      <div className="text-center space-y-1.5">
        <h2 className="heading-display text-gradient-fire" style={{ fontSize: "clamp(1.6rem, 5vw, 2.2rem)" }}>
          Bikin Musikmu
        </h2>
        <p className="text-sm text-[var(--text-muted)]">Tulis vibe lo, AI yang garap sisanya 🎵</p>
      </div>

      <AnimatePresence mode="wait">

        {/* ── IDLE / FORM ── */}
        {phase === "idle" && (
          <motion.div key="form" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }} className="space-y-5">

            {/* Title */}
            <div className="space-y-2">
              <p className="label-caps text-[var(--text-faint)]">Judul Lagu</p>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Nama lagumu (opsional)..."
                maxLength={100}
                className="w-full card-elevated px-4 py-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-faint)] focus:outline-none transition-colors"
                style={{ borderRadius: "1rem" }}
                onFocus={e => (e.target.style.borderColor = "rgba(255,45,85,0.35)")}
                onBlur={e => (e.target.style.borderColor = "")}
              />
            </div>

            {/* Genre chips */}
            <div className="space-y-2.5">
              <p className="label-caps text-[var(--text-faint)]">Genre / Vibe</p>
              <div className="flex flex-wrap gap-2">
                {GENRES.map(g => {
                  const active = selectedGenres.includes(g);
                  return (
                    <button
                      key={g}
                      onClick={() => toggleGenre(g)}
                      className="px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200"
                      style={active
                        ? { background: "var(--accent-red)", borderColor: "var(--accent-red)", color: "#fff", boxShadow: "0 0 12px rgba(255,45,85,0.35)" }
                        : { background: "transparent", borderColor: "var(--border-subtle)", color: "var(--text-muted)" }
                      }
                    >
                      {g}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Prompt */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="label-caps text-[var(--text-faint)]">Deskripsiin musikmu</p>
                {selectedGenres.length > 0 && prompt === autoFilledRef.current && (
                  <span className="text-[10px] text-[var(--accent-red)] font-medium">✨ AI-suggested</span>
                )}
              </div>
              <textarea
                value={prompt}
                onChange={e => {
                  setPrompt(e.target.value);
                  setEnhancedPrompt(null);
                  setLyrics(null);
                  setTimepoints([]);
                }}
                placeholder="Tulis vibe, suasana, atau cerita di balik musikmu..."
                rows={4}
                maxLength={450}
                className="w-full card-elevated px-4 py-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-faint)] resize-none focus:outline-none transition-colors"
                style={{ borderRadius: "1rem" }}
                onFocus={e => (e.target.style.borderColor = "rgba(255,45,85,0.35)")}
                onBlur={e => (e.target.style.borderColor = "")}
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-[var(--text-faint)]">{prompt.length}/450</span>
                {timepoints.length > 0 && (
                  <button
                    onClick={() => void handleEnhance()}
                    disabled={!canEnhance}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 disabled:opacity-40"
                    style={{
                      background: "rgba(255,45,85,0.08)",
                      color: "var(--accent-red)",
                      border: "1px solid rgba(255,45,85,0.2)",
                    }}
                  >
                    {enhancing ? (
                      <svg className="animate-spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                      </svg>
                    ) : "✨"}
                    {enhancing ? "Memperbarui..." : "Ubah Alur"}
                  </button>
                )}
              </div>
            </div>

            {/* Timepoints preview */}
            <AnimatePresence>
              {timepoints.length > 0 && (
                <motion.div
                  key="timepoints"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="card-elevated p-3 space-y-2" style={{ borderRadius: "1rem" }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--accent-red)" }}>
                      Alur Dramatik ✨
                    </p>
                    <div className="space-y-1.5">
                      {timepoints.map((tp, i) => (
                        <div key={i} className="flex items-start gap-2.5">
                          <span className="text-[10px] font-mono text-[var(--text-faint)] w-8 flex-shrink-0 pt-0.5">{tp.timestamp}</span>
                          <div className="flex-1 min-w-0">
                            <span
                              className="text-[10px] font-bold uppercase mr-1.5"
                              style={{ color: MOOD_COLORS[tp.mood] ?? "var(--accent-red)" }}
                            >
                              {tp.label}
                            </span>
                            <span className="text-xs text-[var(--text-muted)]">{tp.description}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Step CTA — enhance first, then generate */}
            <AnimatePresence mode="wait">
              {!canGenerate ? (
                <motion.button
                  key="enhance-cta"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  onClick={() => void handleEnhance()}
                  disabled={!canEnhance}
                  className="btn-primary w-full rounded-2xl py-4 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {enhancing ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                      </svg>
                      Menyusun alur dramatis...
                    </span>
                  ) : (
                    <span>✨ Perkuat Prompt dulu</span>
                  )}
                </motion.button>
              ) : (
                <motion.div
                  key="generate-cta"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="space-y-3"
                >
                  <div className="flex items-center justify-between text-xs px-0.5">
                    <span className="text-[var(--text-muted)]">
                      Biaya: <span className="font-bold" style={{ color: "var(--accent-red)" }}>10 kredit</span>
                    </span>
                    <span className="text-[var(--text-muted)]">
                      Saldo: <span className={credits < 10 ? "text-red-400 font-bold" : "text-[var(--text-primary)] font-medium"}>{credits} kredit</span>
                    </span>
                  </div>
                  {credits < 10 ? (
                    <button onClick={onTopUp} className="w-full py-3.5 rounded-2xl text-white font-bold text-sm bg-gradient-warm shadow-glow-amber">
                      Top Up Kredit dulu yuk 🪙
                    </button>
                  ) : (
                    <button onClick={handleGenerate} className="btn-primary w-full rounded-2xl py-4 text-sm">
                      Gas Bikin Musik 🎵
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ── GENERATING ── */}
        {phase === "generating" && (
          <motion.div key="loading" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }} className="text-center space-y-7 py-10">
            <div className="flex items-end justify-center gap-0.5 h-20">
              {Array.from({ length: 28 }, (_, i) => (
                <div
                  key={i}
                  className="w-2 rounded-full waveform-bar"
                  style={{
                    height: `${28 + Math.sin(i * 0.7) * 18}%`,
                    background: `hsl(${350 - i * 3}, 90%, ${55 + Math.sin(i * 0.6) * 12}%)`,
                    animationDelay: `${i * 0.07}s`,
                  }}
                />
              ))}
            </div>

            <div className="space-y-2">
              <p className="font-bold text-[var(--text-primary)] text-base">
                <RotatingText messages={MUSIC_LOADING_MSGS} interval={3500} />
              </p>
              <p className="text-sm text-[var(--text-muted)]">Biasanya butuh 2–3 menit. Tenang aja ya 🎧</p>
            </div>

            <div className="flex justify-center gap-1.5">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full"
                  style={{ background: "var(--accent-red)", animation: "waveform-bounce 1s ease-in-out infinite", animationDelay: `${i * 0.18}s` }}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* ── DONE ── */}
        {phase === "done" && audioUrl && (
          <motion.div key="done" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }} className="space-y-5">
            <div className="text-center space-y-2">
              <div className="text-4xl spring-in">🎉</div>

              {/* Editable title */}
              {editingTitle ? (
                <div className="flex items-center gap-2 justify-center">
                  <input
                    autoFocus
                    value={draftTitle}
                    onChange={e => setDraftTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") void handleSaveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
                    maxLength={100}
                    className="card-elevated px-3 py-1.5 text-sm font-bold text-[var(--text-primary)] focus:outline-none text-center"
                    style={{ borderRadius: "0.75rem", borderColor: "rgba(255,45,85,0.35)", minWidth: 0, width: "12rem" }}
                  />
                  <button onClick={() => void handleSaveTitle()} disabled={savingTitle} className="text-xs px-3 py-1.5 rounded-xl font-semibold text-white bg-gradient-red disabled:opacity-50">
                    {savingTitle ? "..." : "Simpan"}
                  </button>
                  <button onClick={() => setEditingTitle(false)} className="text-xs text-[var(--text-faint)] hover:text-[var(--text-muted)]">Batal</button>
                </div>
              ) : (
                <button
                  onClick={() => { setDraftTitle(title || ""); setEditingTitle(true); }}
                  className="group flex items-center gap-1.5 mx-auto"
                >
                  <p className="font-bold text-[var(--text-primary)]">
                    {title || "Musikmu udah jadi!"}
                  </p>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--accent-red)" strokeWidth="2.5" className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
              )}

              <p className="text-sm text-[var(--text-muted)]">Gokil kan? Sekarang dengerin & share! 🔥</p>
            </div>

            <AudioPlayer audioUrl={audioUrl} />

            <ShareButtons audioUrl={audioUrl} />

            <button
              onClick={() => void handleDownload(audioUrl)}
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl card-glass-green text-sm font-semibold transition-all hover:scale-[1.01] active:scale-[0.98]"
              style={{ color: "var(--accent-green)" }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Download Musik
            </button>

            {/* Novel Musik CTA */}
            <AnimatePresence>
              {!showNovel && (
                <motion.button
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowNovel(true)}
                  className="w-full py-3.5 rounded-2xl text-white font-bold text-sm transition-all hover:scale-[1.01] active:scale-[0.98]"
                  style={{
                    background: "linear-gradient(135deg, #7c3aed 0%, #db2777 100%)",
                    boxShadow: "0 0 20px rgba(124,58,237,0.35)",
                  }}
                >
                  Bikin Novel Musik 🎬
                </motion.button>
              )}
            </AnimatePresence>

            {/* NovelCreator panel */}
            <AnimatePresence>
              {showNovel && currentJobId && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="card-elevated p-4 space-y-4" style={{ borderRadius: "1.25rem" }}>
                    <NovelCreator
                      musicJobId={currentJobId}
                      token={token}
                      credits={credits}
                      onCreditsUpdate={onCreditsUpdate}
                      onTopUp={onTopUp}
                      onClose={() => setShowNovel(false)}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <button onClick={handleReset} className="w-full py-3 rounded-2xl text-sm text-[var(--text-faint)] hover:text-[var(--text-muted)] transition-colors">
              Bikin lagu baru lagi →
            </button>
          </motion.div>
        )}

        {/* ── ERROR ── */}
        {phase === "error" && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-4 py-10">
            <div className="text-4xl">😓</div>
            <p className="font-bold text-red-400">Ada yang error nih</p>
            <p className="text-sm text-[var(--text-muted)]">{errorMsg || "Coba lagi ya, kredit udah dikembalikan."}</p>
            <button onClick={handleReset} className="px-6 py-2.5 rounded-xl card-elevated text-sm font-medium">
              Coba Lagi
            </button>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
