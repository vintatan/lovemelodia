import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { apiFetch } from "../../lib/api.ts";
import { RotatingText } from "../UI.tsx";

const ALBUM_LOADING_MSGS = [
  "Claude lagi dengerin temamu... 🤔",
  "Nulis konsep buat tiap lagu...",
  "Generate musik secara paralel... 🎵",
  "Mixing semua lagu sekaligus nih...",
  "Hampir punya album sendiri! 💿",
  "Tinggal finishing touch...",
  "Album kamu hampir siap dirilis!",
];

interface AlbumSong {
  id: string;
  title: string | null;
  status: string;
  audioUrl: string | null;
  error: string | null;
}

interface AlbumCreatorProps {
  token: string;
  credits: number;
  onCreditsUpdate: (n: number) => void;
  onTopUp: () => void;
}

type Phase = "idle" | "generating" | "done" | "error";

const ALBUM_PRICING: Record<number, number> = { 5: 150, 10: 250 };

export default function AlbumCreator({ token, credits, onCreditsUpdate, onTopUp }: AlbumCreatorProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [theme, setTheme] = useState("");
  const [songCount, setSongCount] = useState<5 | 10>(5);
  const [albumId, setAlbumId] = useState<string | null>(null);
  const [songs, setSongs] = useState<AlbumSong[]>([]);
  const [albumTheme, setAlbumTheme] = useState("");
  const [albumTitle, setAlbumTitle] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const [error, setError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const creditsRequired = ALBUM_PRICING[songCount];
  const canAfford = credits >= creditsRequired;

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  const pollStatus = useCallback((id: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res = await apiFetch(`/api/album/status/${id}`, token);
        if (!res.ok) return;
        const data = await res.json() as { status: string; songs: AlbumSong[]; theme: string; title: string | null; coverUrl: string | null };
        setSongs(data.songs);
        if (data.title) setAlbumTitle(data.title);
        if (data.coverUrl) setCoverUrl(data.coverUrl);
        if (data.status === "completed" || data.status === "failed") {
          stopPolling();
          setPhase(data.status === "completed" ? "done" : "error");
        }
      } catch { /* network hiccup, keep polling */ }
    }, 4000);
  }, [token, stopPolling]);

  async function handleSaveTitle(id: string) {
    const trimmed = draftTitle.trim();
    if (!trimmed) { setEditingTitle(false); return; }
    setSavingTitle(true);
    try {
      await apiFetch(`/api/album/rename/${id}`, token, {
        method: "PATCH",
        body: JSON.stringify({ title: trimmed }),
      });
      setAlbumTitle(trimmed);
    } catch { /* ignore */ } finally {
      setSavingTitle(false);
      setEditingTitle(false);
    }
  }

  useEffect(() => () => stopPolling(), [stopPolling]);

  async function handleGenerate() {
    if (!theme.trim()) { setError("Tulis tema albummu dulu ya!"); return; }
    if (!canAfford) { onTopUp(); return; }
    setError("");
    setPhase("generating");
    setSongs([]);

    try {
      const res = await apiFetch("/api/album/generate", token, {
        method: "POST",
        body: JSON.stringify({ theme: theme.trim(), songCount }),
      });
      const data = await res.json() as { albumId?: string; error?: string; creditsRemaining?: number };
      if (!res.ok || !data.albumId) {
        setPhase("error");
        setError(data.error ?? "Gagal buat album");
        return;
      }
      if (data.creditsRemaining !== undefined) onCreditsUpdate(data.creditsRemaining);
      setAlbumId(data.albumId);
      setAlbumTheme(theme.trim());
      pollStatus(data.albumId);
    } catch {
      setPhase("error");
      setError("Gagal terhubung ke server");
    }
  }

  function handleReset() {
    stopPolling();
    setPhase("idle");
    setSongs([]);
    setAlbumId(null);
    setAlbumTitle(null);
    setCoverUrl(null);
    setEditingTitle(false);
    setError("");
    setTheme("");
  }

  const completedCount = songs.filter(s => s.status === "completed").length;
  const totalCount = songs.length || songCount;

  return (
    <div className="max-w-xl mx-auto space-y-6 py-4">

      <AnimatePresence mode="wait">

        {/* ── IDLE ── */}
        {phase === "idle" && (
          <motion.div key="idle" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
            <div className="text-center space-y-1">
              <div className="text-4xl">💿</div>
              <h2 className="heading-display text-xl text-[var(--text-primary)]">Bikin Album Sendiri</h2>
              <p className="text-sm text-[var(--text-muted)]">Tulis tema, pilih paket, dan AI akan generate semua lagu sekaligus</p>
            </div>

            {/* Theme input */}
            <div className="space-y-2">
              <label className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider">Tema Album</label>
              <textarea
                value={theme}
                onChange={e => { setTheme(e.target.value); setError(""); }}
                placeholder="Contoh: 10 lagu tentang kehidupan kantor — dari Senin blues, deadline gila, sampai after-work karaoke"
                rows={3}
                maxLength={300}
                className="w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-faint)] focus:outline-none focus:border-[var(--accent-red)] transition-colors resize-none"
              />
              <div className="flex justify-between items-center">
                {error && <p className="text-xs text-red-400">{error}</p>}
                <p className="text-xs text-[var(--text-faint)] ml-auto">{theme.length}/300</p>
              </div>
            </div>

            {/* Package picker */}
            <div className="space-y-2">
              <label className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider">Pilih Paket</label>
              <div className="grid grid-cols-2 gap-3">
                {([5, 10] as const).map(n => {
                  const selected = songCount === n;
                  const cost = ALBUM_PRICING[n];
                  const affordable = credits >= cost;
                  return (
                    <button
                      key={n}
                      onClick={() => setSongCount(n)}
                      className={`relative p-4 rounded-2xl border text-left transition-all duration-200 ${
                        selected
                          ? "border-[var(--accent-red)] bg-[rgba(255,45,85,0.08)]"
                          : "border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:border-[rgba(255,45,85,0.3)]"
                      }`}
                    >
                      {n === 10 && (
                        <span className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(245,158,11,0.18)", color: "#f59e0b" }}>
                          HEMAT
                        </span>
                      )}
                      <div className="text-2xl mb-1">{n === 5 ? "🎵" : "💿"}</div>
                      <div className="font-bold text-[var(--text-primary)] text-sm">{n} Lagu</div>
                      <div className={`text-xs font-semibold mt-0.5 ${affordable ? "text-[var(--accent-red)]" : "text-[var(--text-faint)]"}`}>
                        {cost} kredit
                      </div>
                      {!affordable && <div className="text-[10px] text-[var(--text-faint)] mt-0.5">Kredit kurang</div>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Credits warning */}
            {!canAfford && (
              <div className="card-elevated p-3 flex items-center justify-between gap-3">
                <p className="text-xs text-[var(--text-muted)]">
                  Kredit kamu <span className="font-bold text-[var(--text-primary)]">{credits}</span>, butuh <span className="font-bold text-[var(--accent-red)]">{creditsRequired}</span>
                </p>
                <button onClick={onTopUp} className="text-xs font-semibold text-[var(--accent-red)] whitespace-nowrap">Top up →</button>
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={!theme.trim()}
              className="w-full py-3.5 rounded-2xl text-sm font-bold transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: canAfford ? "linear-gradient(135deg, #ff2d55, #ff6b35)" : "rgba(255,45,85,0.2)",
                color: canAfford ? "#fff" : "var(--accent-red)",
              }}
            >
              {canAfford ? `💿 Bikin Album ${songCount} Lagu (${creditsRequired} kredit)` : "Kredit Tidak Cukup — Top Up Dulu"}
            </button>
          </motion.div>
        )}

        {/* ── GENERATING ── */}
        {phase === "generating" && (
          <motion.div key="generating" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="space-y-6 py-4">
            {/* Cover pops in once ready */}
            <AnimatePresence>
              {coverUrl && (
                <motion.div
                  key="cover"
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
                  className="mx-auto w-32 h-32 rounded-xl overflow-hidden shadow-glow"
                >
                  <img src={coverUrl} alt="Album cover" className="w-full h-full object-cover" />
                </motion.div>
              )}
            </AnimatePresence>
            <div className="text-center space-y-3">
              <div className="flex items-end justify-center gap-0.5 h-14">
                {Array.from({ length: 20 }, (_, i) => (
                  <div
                    key={i}
                    className="w-1.5 rounded-full waveform-bar"
                    style={{
                      height: `${30 + Math.sin(i * 0.8) * 20}%`,
                      background: `hsl(${350 - i * 4}, 90%, ${55 + Math.sin(i * 0.6) * 10}%)`,
                      animationDelay: `${i * 0.08}s`,
                    }}
                  />
                ))}
              </div>
              <p className="font-bold text-[var(--text-primary)] text-base">
                <RotatingText messages={ALBUM_LOADING_MSGS} interval={3500} />
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                {songs.length > 0
                  ? `${completedCount} dari ${totalCount} lagu selesai`
                  : `Mempersiapkan ${songCount} lagu untuk albummu...`}
              </p>
            </div>

            {/* Song progress cards */}
            {songs.length > 0 && (
              <div className="space-y-2">
                {songs.map((song, i) => (
                  <motion.div
                    key={song.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="card-elevated p-3 flex items-center gap-3"
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{
                        background: song.status === "completed" ? "rgba(34,197,94,0.15)" : song.status === "failed" ? "rgba(239,68,68,0.15)" : "rgba(255,45,85,0.1)",
                        color: song.status === "completed" ? "#22c55e" : song.status === "failed" ? "#ef4444" : "var(--accent-red)",
                      }}
                    >
                      {song.status === "completed" ? "✓" : song.status === "failed" ? "✗" : `${i + 1}`}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">{song.title ?? `Lagu ${i + 1}`}</p>
                      <p className="text-xs text-[var(--text-faint)]">
                        {song.status === "completed" ? "Selesai" : song.status === "failed" ? "Gagal" : "Sedang diproses..."}
                      </p>
                    </div>
                    {song.status === "generating" && (
                      <div className="flex gap-1">
                        {[0, 1, 2].map(j => (
                          <div key={j} className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent-red)", animation: "waveform-bounce 1s ease-in-out infinite", animationDelay: `${j * 0.18}s` }} />
                        ))}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}

            {songs.length === 0 && (
              <div className="space-y-2">
                {Array.from({ length: songCount }, (_, i) => (
                  <div key={i} className="card-elevated p-3 flex items-center gap-3 animate-pulse">
                    <div className="w-8 h-8 rounded-full" style={{ background: "rgba(255,45,85,0.08)" }} />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 rounded" style={{ background: "rgba(255,255,255,0.06)", width: `${50 + i * 7}%` }} />
                      <div className="h-2 rounded w-16" style={{ background: "rgba(255,255,255,0.04)" }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ── DONE ── */}
        {phase === "done" && (
          <motion.div key="done" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-5">
            {/* Cover image */}
            {coverUrl && (
              <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
                className="mx-auto w-48 h-48 rounded-2xl overflow-hidden shadow-glow"
              >
                <img src={coverUrl} alt="Album cover" className="w-full h-full object-cover" />
              </motion.div>
            )}

            <div className="text-center space-y-2">
              {/* Editable album title */}
              {albumId && (editingTitle ? (
                <div className="flex items-center gap-2 justify-center">
                  <input
                    autoFocus
                    value={draftTitle}
                    onChange={e => setDraftTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") void handleSaveTitle(albumId); if (e.key === "Escape") setEditingTitle(false); }}
                    maxLength={120}
                    className="card-elevated px-3 py-1.5 text-sm font-bold text-[var(--text-primary)] focus:outline-none text-center"
                    style={{ borderRadius: "0.75rem", borderColor: "rgba(255,45,85,0.35)", minWidth: 0, width: "14rem" }}
                  />
                  <button onClick={() => void handleSaveTitle(albumId)} disabled={savingTitle} className="text-[10px] px-2.5 py-1.5 rounded-lg font-bold text-white bg-gradient-red disabled:opacity-50">
                    {savingTitle ? "..." : "OK"}
                  </button>
                  <button onClick={() => setEditingTitle(false)} className="text-[10px] text-[var(--text-faint)] hover:text-[var(--text-muted)]">✕</button>
                </div>
              ) : (
                <button
                  onClick={() => { setDraftTitle(albumTitle ?? albumTheme); setEditingTitle(true); }}
                  className="group inline-flex items-center gap-1.5"
                >
                  <h3 className="heading-display text-lg text-[var(--text-primary)]">{albumTitle || albumTheme}</h3>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent-red)" strokeWidth="2.5" className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
              ))}
              <p className="text-xs text-[var(--text-faint)]">{albumTheme}</p>
            </div>

            <div className="space-y-3">
              {songs.filter(s => s.status === "completed" && s.audioUrl).map((song, i) => (
                <motion.div
                  key={song.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="card-elevated p-4 space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[var(--text-faint)]">#{i + 1}</span>
                    <p className="font-bold text-sm text-[var(--text-primary)]">{song.title ?? `Lagu ${i + 1}`}</p>
                  </div>
                  <audio controls src={song.audioUrl!} className="w-full" style={{ height: "36px" }} />
                </motion.div>
              ))}

              {songs.filter(s => s.status === "failed").length > 0 && (
                <p className="text-xs text-[var(--text-faint)] text-center">
                  {songs.filter(s => s.status === "failed").length} lagu gagal diproses
                </p>
              )}
            </div>

            <button
              onClick={handleReset}
              className="w-full py-3 rounded-2xl text-sm font-semibold border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
            >
              Bikin Album Baru
            </button>
          </motion.div>
        )}

        {/* ── ERROR ── */}
        {phase === "error" && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-4 py-10">
            <div className="text-4xl">😔</div>
            <p className="font-bold text-[var(--text-primary)]">Waduh, ada yang gagal</p>
            <p className="text-sm text-[var(--text-muted)]">{error || "Coba lagi ya!"}</p>
            <button
              onClick={handleReset}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
              style={{ background: "linear-gradient(135deg, #ff2d55, #ff6b35)" }}
            >
              Coba Lagi
            </button>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
