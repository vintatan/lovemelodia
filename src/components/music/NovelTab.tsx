import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { apiFetch } from "../../lib/api.ts";
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

function formatDate(unix: number) {
  return new Date(unix * 1000).toLocaleDateString("id-ID", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export default function NovelTab({ token, credits, onCreditsUpdate, onTopUp }: NovelTabProps) {
  const [jobs, setJobs] = useState<MusicJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedJob, setSelectedJob] = useState<MusicJob | null>(null);

  useEffect(() => {
    apiFetch("/api/music/history", token, { method: "GET" })
      .then(r => r.json())
      .then((data: { jobs?: MusicJob[]; error?: string }) => {
        if (data.jobs) setJobs(data.jobs.filter(j => j.status === "completed" && j.audio_url));
        else setError(data.error ?? "Gagal memuat riwayat");
      })
      .catch(() => setError("Gagal memuat riwayat"))
      .finally(() => setLoading(false));
  }, [token]);

  if (selectedJob) {
    return (
      <div className="max-w-2xl mx-auto py-2">
        <button
          onClick={() => setSelectedJob(null)}
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
            {selectedJob.title || selectedJob.prompt || "Musik tanpa judul"}
          </p>
          {selectedJob.title && (
            <p className="text-[11px] text-[var(--text-faint)] mt-0.5 line-clamp-1">{selectedJob.prompt}</p>
          )}
        </div>

        <div className="card-elevated p-4 rounded-2xl">
          <NovelCreator
            musicJobId={selectedJob.id}
            token={token}
            credits={credits}
            onCreditsUpdate={onCreditsUpdate}
            onTopUp={onTopUp}
            onClose={() => setSelectedJob(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-2">
      <div className="text-center space-y-1.5">
        <h2 className="heading-display text-gradient-fire" style={{ fontSize: "clamp(1.6rem, 5vw, 2.2rem)" }}>
          Novel Musik
        </h2>
        <p className="text-sm text-[var(--text-muted)]">Pilih lagumu, AI bikin video visual sinematik 🎬</p>
      </div>

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

        {!loading && error && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20 space-y-3">
            <div className="text-3xl">😓</div>
            <p className="text-sm text-[var(--text-muted)]">{error}</p>
          </motion.div>
        )}

        {!loading && !error && jobs.length === 0 && (
          <motion.div key="empty" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center py-20 space-y-4">
            <div className="text-5xl float-anim">🎵</div>
            <p className="font-bold text-[var(--text-primary)]">Belum ada musik yang selesai</p>
            <p className="text-sm text-[var(--text-muted)]">Bikin lagu dulu di tab Musik, baru balik ke sini!</p>
          </motion.div>
        )}

        {!loading && !error && jobs.length > 0 && (
          <motion.div key="list" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <p className="label-caps text-[var(--text-faint)]">Pilih lagu untuk divisualisasi</p>
            {jobs.map((job, i) => (
              <motion.button
                key={job.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => setSelectedJob(job)}
                className="w-full text-left card-elevated p-4 rounded-2xl transition-all hover:scale-[1.01] active:scale-[0.99] group"
                style={{ border: "1px solid transparent" }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(255,45,85,0.25)")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "transparent")}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-red flex items-center justify-center flex-shrink-0 shadow-glow">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                      <path d="M9 18V5l12-2v13M6 21a3 3 0 100-6 3 3 0 000 6zm12-2a3 3 0 100-6 3 3 0 000 6z"/>
                    </svg>
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
                  <svg
                    width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="var(--accent-red)" strokeWidth="2.5"
                    className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </div>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
