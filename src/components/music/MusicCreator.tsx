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

interface AudioPlayerProps {
  audioUrl: string;
}

function AudioPlayer({ audioUrl }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setCurrentTime(a.currentTime);
    const onLoaded = () => setDuration(a.duration);
    const onEnded = () => setPlaying(false);
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
    else { a.play(); setPlaying(true); }
  }

  function seek(e: React.ChangeEvent<HTMLInputElement>) {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Number(e.target.value);
  }

  function fmt(s: number) {
    if (!isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  return (
    <div className="card-elevated p-4 space-y-3">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      {/* Waveform visual */}
      <div className="flex items-end justify-center gap-0.5 h-10">
        {Array.from({ length: 40 }, (_, i) => (
          <div
            key={i}
            className="w-1 rounded-full"
            style={{
              height: `${20 + Math.sin(i * 0.7) * 14 + Math.cos(i * 0.3) * 8}%`,
              background: playing
                ? `hsl(${260 + i * 2}, 80%, ${55 + Math.sin(i * 0.5) * 15}%)`
                : "rgba(139,92,246,0.3)",
              transition: "background 0.3s",
              animation: playing ? `waveform-bounce ${0.8 + (i % 5) * 0.15}s ease-in-out infinite` : "none",
              animationDelay: `${i * 0.04}s`,
            }}
          />
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          className="w-10 h-10 rounded-full bg-gradient-violet flex items-center justify-center shadow-glow flex-shrink-0"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
              <rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white" style={{ marginLeft: 2 }}>
              <polygon points="5,3 19,12 5,21"/>
            </svg>
          )}
        </button>

        <div className="flex-1 space-y-1">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={seek}
            className="w-full accent-[var(--accent-violet)]"
            style={{ height: 3 }}
          />
          <div className="flex justify-between text-xs text-[var(--text-faint)] font-mono">
            <span>{fmt(currentTime)}</span>
            <span>{fmt(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

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
  const [jobId, setJobId] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const placeholder = PLACEHOLDERS[Math.floor(Math.random() * PLACEHOLDERS.length)];

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearTimeout(pollRef.current); pollRef.current = null; }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  function toggleGenre(g: string) {
    setSelectedGenres(prev =>
      prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]
    );
  }

  function buildPrompt() {
    let p = prompt.trim();
    if (selectedGenres.length > 0) {
      p = `${selectedGenres.join(", ")} music. ${p}`;
    }
    return p;
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
      setJobId(data.jobId!);
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
          setJobId(null);
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
    setJobId(null);
    setErrorMsg("");
  }

  return (
    <div className="max-w-xl mx-auto space-y-6 py-2">
      {/* Header */}
      <div className="text-center space-y-1">
        <h2 className="heading-display text-2xl text-gradient">Bikin Musikmu</h2>
        <p className="text-sm text-[var(--text-muted)]">Tulis vibe lo, Lyria AI yang garap sisanya 🎵</p>
      </div>

      <AnimatePresence mode="wait">
        {phase === "idle" && (
          <motion.div key="form" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
            {/* Genre chips */}
            <div className="space-y-2">
              <label className="text-xs text-[var(--text-faint)] uppercase tracking-widest font-medium">Genre / Vibe</label>
              <div className="flex flex-wrap gap-2">
                {GENRES.map(g => (
                  <button
                    key={g}
                    onClick={() => toggleGenre(g)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      selectedGenres.includes(g)
                        ? "bg-[var(--accent-violet)] border-[var(--accent-violet)] text-white shadow-glow"
                        : "bg-transparent border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--accent-violet)]/50"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Prompt */}
            <div className="space-y-2">
              <label className="text-xs text-[var(--text-faint)] uppercase tracking-widest font-medium">
                Deskripsiin musikmu
              </label>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder={placeholder}
                rows={4}
                maxLength={450}
                className="w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-faint)] resize-none focus:outline-none focus:border-[var(--accent-violet)]/50 transition-colors"
              />
              <div className="flex justify-between text-xs text-[var(--text-faint)]">
                <span>Makin detail makin gokil hasilnya ✨</span>
                <span>{prompt.length}/450</span>
              </div>
            </div>

            {/* Credit info */}
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)] px-1">
              <span>Biaya: <span className="text-[var(--accent-violet)] font-semibold">10 kredit</span></span>
              <span>Saldo: <span className={credits < 10 ? "text-red-400" : "text-[var(--text-primary)]"}>{credits} kredit</span></span>
            </div>

            {credits < 10 ? (
              <button
                onClick={onTopUp}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold text-sm shadow-glow"
              >
                Top Up Kredit dulu yuk 🪙
              </button>
            ) : (
              <button
                onClick={handleGenerate}
                disabled={!buildPrompt()}
                className="w-full py-3.5 rounded-xl bg-gradient-violet text-white font-semibold text-sm shadow-glow disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
              >
                Gas Bikin Musik 🎵
              </button>
            )}
          </motion.div>
        )}

        {phase === "generating" && (
          <motion.div key="loading" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="text-center space-y-6 py-8">
            {/* Waveform animation */}
            <div className="flex items-end justify-center gap-1 h-16">
              {Array.from({ length: 20 }, (_, i) => (
                <div
                  key={i}
                  className="w-1.5 rounded-full waveform-bar"
                  style={{
                    height: `${30 + Math.sin(i * 0.8) * 20}%`,
                    background: `hsl(${260 + i * 5}, 80%, 65%)`,
                    animationDelay: `${i * 0.08}s`,
                  }}
                />
              ))}
            </div>
            <div className="space-y-2">
              <p className="text-[var(--text-primary)] font-semibold">Lyria AI lagi garap musikmu...</p>
              <p className="text-sm text-[var(--text-muted)]">Biasanya butuh 1–2 menit. Tenang aja ya 🎧</p>
            </div>
            <div className="flex justify-center gap-1">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-2 h-2 rounded-full bg-[var(--accent-violet)]"
                  style={{ animation: `waveform-bounce 1s ease-in-out infinite`, animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
          </motion.div>
        )}

        {phase === "done" && audioUrl && (
          <motion.div key="done" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <div className="text-center">
              <div className="text-3xl mb-2">🎉</div>
              <p className="font-semibold text-[var(--text-primary)]">Musikmu udah jadi!</p>
              <p className="text-sm text-[var(--text-muted)] mt-1">Gokil kan? Sekarang dengerin & share! 🔥</p>
            </div>

            <AudioPlayer audioUrl={audioUrl} />

            <ShareButtons audioUrl={audioUrl} />

            <a
              href={audioUrl}
              download="kreasi-ai-musik.wav"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm font-medium text-[var(--text-primary)] hover:border-[var(--accent-violet)]/50 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Download Musik
            </a>

            <button
              onClick={handleReset}
              className="w-full py-3 rounded-xl text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              Bikin lagu baru lagi →
            </button>
          </motion.div>
        )}

        {phase === "error" && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-4 py-8">
            <div className="text-3xl">😓</div>
            <p className="font-semibold text-red-400">Ada yang error nih</p>
            <p className="text-sm text-[var(--text-muted)]">{errorMsg || "Coba lagi ya, kredit udah dikembalikan."}</p>
            <button
              onClick={handleReset}
              className="px-6 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm font-medium"
            >
              Coba Lagi
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
