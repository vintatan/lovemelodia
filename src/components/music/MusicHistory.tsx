import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { apiFetch } from "../../lib/api.ts";

interface NovelSummary {
  status: string;
  imageCount: number;
  videoUrl: string | null;
  novelJobId: string | null;
}

interface AlbumRef {
  albumId: string;
  albumTheme: string;
  albumTitle?: string | null;
  albumCoverUrl?: string | null;
}

interface MusicJob {
  id: string;
  title: string | null;
  prompt: string;
  status: string;
  audio_url: string | null;
  error: string | null;
  credits_used: number;
  created_at: number;
  novel: NovelSummary | null;
  album: AlbumRef | null;
}

function MiniPlayer({ audioUrl }: { audioUrl: string }) {
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
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
  }

  return (
    <div className="flex items-center gap-3 mt-3">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      <button
        onClick={togglePlay}
        className="w-9 h-9 rounded-full bg-gradient-red flex items-center justify-center shadow-glow flex-shrink-0 transition-transform active:scale-90"
      >
        {playing ? (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="white">
            <rect x="6" y="4" width="4" height="16" rx="1.5"/>
            <rect x="14" y="4" width="4" height="16" rx="1.5"/>
          </svg>
        ) : (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="white" style={{ marginLeft: 1 }}>
            <polygon points="5,3 19,12 5,21"/>
          </svg>
        )}
      </button>
      <div className="flex-1 space-y-1">
        <input
          type="range" min={0} max={duration || 100} value={currentTime}
          onChange={seek} className="w-full"
          style={{ accentColor: "var(--accent-red)", height: 2 }}
        />
        <div className="flex justify-between text-[10px] text-[var(--text-faint)] font-mono">
          <span>{fmt(currentTime)}</span>
          <span>{fmt(duration)}</span>
        </div>
      </div>
      <a
        href={audioUrl}
        download
        target="_blank"
        rel="noopener noreferrer"
        className="text-[var(--text-faint)] hover:text-[var(--accent-green)] transition-colors"
        title="Download"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
      </a>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "completed") {
    return (
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(52,199,89,0.12)", color: "var(--accent-green)" }}>
        Selesai
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(255,69,58,0.12)", color: "#ff453a" }}>
        Gagal
      </span>
    );
  }
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(255,159,10,0.12)", color: "var(--accent-amber)" }}>
      Sedang diproses
    </span>
  );
}

function formatDate(unix: number) {
  const d = new Date(unix * 1000);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

interface MusicHistoryProps {
  token: string;
  phone?: string;
}

function InlineRename({ jobId, initialTitle, prompt, token, onSaved }: {
  jobId: string; initialTitle: string | null; prompt: string; token: string; onSaved: (t: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialTitle ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    const trimmed = draft.trim();
    if (!trimmed) { setEditing(false); return; }
    setSaving(true);
    try {
      await apiFetch(`/api/music/rename/${jobId}`, token, {
        method: "PATCH",
        body: JSON.stringify({ title: trimmed }),
      });
      onSaved(trimmed);
    } catch { /* ignore */ } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") void save(); if (e.key === "Escape") setEditing(false); }}
          maxLength={100}
          className="flex-1 min-w-0 card-elevated px-2.5 py-1 text-sm font-medium text-[var(--text-primary)] focus:outline-none"
          style={{ borderRadius: "0.6rem", borderColor: "rgba(255,45,85,0.35)" }}
        />
        <button onClick={() => void save()} disabled={saving} className="text-[10px] px-2.5 py-1 rounded-lg font-bold text-white bg-gradient-red disabled:opacity-50 flex-shrink-0">
          {saving ? "..." : "OK"}
        </button>
        <button onClick={() => setEditing(false)} className="text-[10px] text-[var(--text-faint)] hover:text-[var(--text-muted)] flex-shrink-0">✕</button>
      </div>
    );
  }

  return (
    <button
      onClick={() => { setDraft(initialTitle ?? ""); setEditing(true); }}
      className="group flex items-center gap-1.5 text-left w-full"
    >
      <p className="text-sm font-medium text-[var(--text-primary)] leading-snug flex-1">
        {initialTitle || "Musik tanpa judul"}
      </p>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--accent-red)" strokeWidth="2.5" className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
    </button>
  );
}

function NovelVideoPreview({ novelJobId, token }: { novelJobId: string; token: string }) {
  const [open, setOpen] = useState(false);
  const proxyUrl = `/api/novel/video/${novelJobId}?t=${encodeURIComponent(token)}`;

  async function handleDownload() {
    try {
      const res = await fetch(proxyUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "kreasi-ai-novel.mp4";
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch { window.open(proxyUrl, "_blank"); }
  }

  return (
    <div className="space-y-2 mt-1">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen(v => !v)}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide transition-opacity hover:opacity-75"
          style={{ background: "rgba(124,58,237,0.15)", color: "#a78bfa" }}
        >
          {open ? "▲ Sembunyikan" : "🎬 Tonton Video"}
        </button>
        <button
          onClick={() => void handleDownload()}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide transition-opacity hover:opacity-75"
          style={{ background: "rgba(52,199,89,0.12)", color: "var(--accent-green)" }}
        >
          ↓ Download
        </button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            key="video"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl overflow-hidden bg-black"
          >
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video src={proxyUrl} controls playsInline autoPlay className="w-full" style={{ maxHeight: "40vh" }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function JobCard({ job: initialJob, token }: { job: MusicJob; token: string }) {
  const [job, setJob] = useState(initialJob);
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-elevated p-4 space-y-2.5 rounded-2xl"
    >
      <div className="flex items-start justify-between gap-3">
        <InlineRename
          jobId={job.id}
          initialTitle={job.title}
          prompt={job.prompt}
          token={token}
          onSaved={t => setJob(j => ({ ...j, title: t }))}
        />
        <StatusBadge status={job.status} />
      </div>

      {/* Album badge */}
      {job.album && (
        <div className="flex items-center gap-2">
          {job.album.albumCoverUrl && (
            <img
              src={job.album.albumCoverUrl}
              alt="Album cover"
              className="w-7 h-7 rounded-md object-cover flex-shrink-0"
            />
          )}
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold truncate max-w-[200px]"
            style={{ background: "rgba(255,159,10,0.12)", color: "var(--accent-amber)" }}
          >
            💿 {job.album.albumTitle || job.album.albumTheme}
          </span>
        </div>
      )}

      {/* Full prompt / description — never truncated */}
      {job.prompt && (
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">{job.prompt}</p>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-[11px] text-[var(--text-faint)]">{formatDate(job.created_at)}</p>
        {job.novel && !job.novel.videoUrl && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide"
            style={{ background: "rgba(255,45,85,0.10)", color: "var(--accent-red)" }}
          >
            🖼️ {job.novel.imageCount} scenes
          </span>
        )}
      </div>

      {job.novel?.novelJobId && (
        <NovelVideoPreview novelJobId={job.novel.novelJobId} token={token} />
      )}

      {job.status === "completed" && job.audio_url && (
        <MiniPlayer audioUrl={job.audio_url} />
      )}
      {job.status === "failed" && job.error && (
        <p className="text-xs text-red-400 mt-1">{job.error}</p>
      )}
      {job.status === "generating" && (
        <div className="flex items-center gap-2 mt-2">
          <div className="flex gap-1">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent-amber)", animation: "waveform-bounce 1s ease-in-out infinite", animationDelay: `${i * 0.18}s` }} />
            ))}
          </div>
          <p className="text-xs text-[var(--accent-amber)]">Sedang diproses...</p>
        </div>
      )}
    </motion.div>
  );
}

export default function MusicHistory({ token }: MusicHistoryProps) {
  const [jobs, setJobs] = useState<MusicJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError("");
    apiFetch("/api/music/history", token, { method: "GET" })
      .then(async r => {
        if (!r.ok && r.status === 401) throw new Error("Sesi kadaluarsa. Silakan login ulang.");
        return r.json();
      })
      .then((data: { jobs?: MusicJob[]; error?: string }) => {
        if (data.jobs) setJobs(data.jobs.filter(j => j.status !== "failed"));
        else setError(data.error ?? "Gagal memuat riwayat");
      })
      .catch((e: Error) => setError(e.message || "Gagal memuat riwayat"))
      .finally(() => setLoading(false));
  }, [token, retryKey]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full" style={{ background: "var(--accent-red)", animation: "waveform-bounce 1s ease-in-out infinite", animationDelay: `${i * 0.18}s` }} />
          ))}
        </div>
        <p className="text-sm text-[var(--text-faint)]">Memuat riwayat...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20 space-y-3">
        <div className="text-3xl">😓</div>
        <p className="text-sm text-[var(--text-muted)]">{error}</p>
        <button
          onClick={() => setRetryKey(k => k + 1)}
          className="px-5 py-2 rounded-xl card-elevated text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="text-center py-20 space-y-4">
        <div className="text-5xl">🎵</div>
        <p className="font-bold text-[var(--text-primary)]">Belum ada musik</p>
        <p className="text-sm text-[var(--text-muted)]">Bikin lagu pertamamu di tab Musik!</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 py-2">
      <div className="text-center space-y-1">
        <h2 className="heading-display text-gradient-fire" style={{ fontSize: "clamp(1.4rem, 4vw, 2rem)" }}>
          Riwayat Musikmu
        </h2>
        <p className="text-sm text-[var(--text-muted)]">{jobs.length} lagu dibuat</p>
      </div>

      <div className="space-y-3">
        {jobs.map(job => (
          <JobCard key={job.id} job={job} token={token} />
        ))}
      </div>
    </div>
  );
}
