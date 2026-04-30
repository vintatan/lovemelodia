import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { apiFetch } from "../../lib/api.ts";
import ShareButtons from "./ShareButtons.tsx";

const GENRES = ["Pop", "Electronic", "Jazz", "Tradisional", "Rock", "Cinematic", "R&B", "Lo-fi"];

const PLACEHOLDERS = [
  "Lagu sedih buat mantan, nada melankolis, gitar akustik...",
  "Beat energik buat konten gym, BPM tinggi, bass yang nendang...",
  "Musik instrumental santai buat kerja, piano & ambient...",
  "Gamelan modern campur electronic, vibe festival...",
  "R&B smooth buat malam minggu, vokal sensual, synth lembut...",
];

const placeholder = PLACEHOLDERS[Math.floor(Math.random() * PLACEHOLDERS.length)];

/* ── Audio Player ────────────────────────────────────────────────── */
function AudioPlayer({ audioUrl }: { audioUrl: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime   = () => setCurrentTime(a.currentTime);
    const onLoaded = () => setDuration(a.duration);
    const onEnded  = () => setPlaying(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onLoaded);
    a.addEventListener("ended", onEnded);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onLoaded);
      a.removeEventListener("ended", onEnded);
    };
  }, []);

  function togglePlay() {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { void a.play(); setPlaying(true); }
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

  return (
    <div className="card-glass-red p-4 space-y-3">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      {/* Fire waveform bars */}
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

      {/* Transport */}
      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
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

export default function MusicCreator({ token, credits, onCreditsUpdate, onTopUp }: MusicCreatorProps) {
  const [prompt, setPrompt] = useState("");
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [phase, setPhase] = useState<"idle" | "generating" | "done" | "error">("idle");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearTimeout(pollRef.current); pollRef.current = null; }
  }, []);
  useEffect(() => () => stopPolling(), [stopPolling]);

  function toggleGenre(g: string) {
    setSelectedGenres(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
  }

  function buildPrompt() {
    const p = prompt.trim();
    return selectedGenres.length > 0 ? `${selectedGenres.join(", ")} music. ${p}` : p;
  }

  async function handleGenerate() {
    const finalPrompt = buildPrompt();
    if (!finalPrompt) return;
    if (credits < 10) { onTopUp(); return; }

    setPhase("generating");
    setErrorMsg("");
    setAudioUrl(null);

    try {
      const res = await apiFetch("/api/music/generate", token, {
        method: "POST",
        body: JSON.stringify({ prompt: finalPrompt }),
      });
      const data = await res.json() as { jobId?: string; creditsRemaining?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Gagal memulai generasi");
      if (data.creditsRemaining !== undefined) onCreditsUpdate(data.creditsRemaining);
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

  function handleReset() {
    stopPolling();
    setPhase("idle");
    setAudioUrl(null);
    setErrorMsg("");
  }

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
              <p className="label-caps text-[var(--text-faint)]">Deskripsiin musikmu</p>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder={placeholder}
                rows={4}
                maxLength={450}
                className="w-full card-elevated px-4 py-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-faint)] resize-none focus:outline-none transition-colors"
                style={{ borderRadius: "1rem" }}
                onFocus={e => (e.target.style.borderColor = "rgba(255,45,85,0.35)")}
                onBlur={e => (e.target.style.borderColor = "")}
              />
              <div className="flex justify-between text-xs text-[var(--text-faint)]">
                <span>Makin detail makin gokil hasilnya ✨</span>
                <span>{prompt.length}/450</span>
              </div>
            </div>

            {/* Credit info row */}
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
              <button
                onClick={handleGenerate}
                disabled={!buildPrompt()}
                className="btn-primary w-full rounded-2xl py-4 text-sm"
              >
                Gas Bikin Musik 🎵
              </button>
            )}
          </motion.div>
        )}

        {/* ── GENERATING ── */}
        {phase === "generating" && (
          <motion.div key="loading" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }} className="text-center space-y-7 py-10">
            {/* Fire waveform loader */}
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
              <p className="font-bold text-[var(--text-primary)] text-base">AI lagi garap musikmu...</p>
              <p className="text-sm text-[var(--text-muted)]">Biasanya butuh 1–2 menit. Tenang aja ya 🎧</p>
            </div>

            {/* Bouncing dots */}
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
            <div className="text-center space-y-1">
              <div className="text-4xl spring-in">🎉</div>
              <p className="font-bold text-[var(--text-primary)] mt-2">Musikmu udah jadi!</p>
              <p className="text-sm text-[var(--text-muted)]">Gokil kan? Sekarang dengerin & share! 🔥</p>
            </div>

            <AudioPlayer audioUrl={audioUrl} />

            <ShareButtons audioUrl={audioUrl} />

            <a
              href={audioUrl}
              download="kreasi-ai-musik.wav"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl card-glass-green text-sm font-semibold transition-all hover:scale-[1.01] active:scale-[0.98]"
              style={{ color: "var(--accent-green)" }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Download Musik
            </a>

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
