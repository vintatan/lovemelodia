import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Music, Film, Upload, CheckCircle2, XCircle } from "lucide-react";
import { SectionHeading } from "../../UI.tsx";
import VideoPlayer from "./VideoPlayer.tsx";
import { apiFetch } from "../../../lib/api.ts";

type AssemblyStatus = "generating_music" | "assembling_video" | "uploading" | "completed" | "failed";

const STAGE_LABELS: Record<AssemblyStatus, string> = {
  generating_music: "Composing with proprietary model…",
  assembling_video: "Assembling cinematic scenes…",
  uploading:        "Uploading your music video…",
  completed:        "Your music video is ready!",
  failed:           "Assembly failed — credits refunded.",
};

const STAGE_SUBTITLES: Record<AssemblyStatus, string> = {
  generating_music: "AI is writing and performing your custom score",
  assembling_video: "Applying Ken Burns motion and dramatic transitions",
  uploading:        "Almost there…",
  completed:        "Download or share your cinematic story",
  failed:           "Something went wrong. Your 30 credits have been returned.",
};

const STAGE_ICONS: Record<AssemblyStatus, typeof Music> = {
  generating_music: Music,
  assembling_video: Film,
  uploading:        Upload,
  completed:        CheckCircle2,
  failed:           XCircle,
};

const PROGRESS_STAGES: AssemblyStatus[] = ["generating_music", "assembling_video", "uploading", "completed"];

const WAVEFORM_DELAYS = [0, 0.15, 0.3, 0.1, 0.25, 0.05, 0.2, 0.35];
const WAVEFORM_HEIGHTS = [0.4, 0.7, 1, 0.55, 0.85, 0.45, 0.9, 0.6];

function WaveformVisualizer({ active }: { active: boolean }) {
  return (
    <div className="flex items-end gap-0.5 h-10" aria-hidden>
      {WAVEFORM_HEIGHTS.map((h, i) => (
        <motion.div
          key={i}
          className="w-1.5 rounded-full bg-[var(--accent-violet)]"
          style={{ height: `${h * 40}px`, originY: 1 }}
          animate={active ? { scaleY: [0.25, 1, 0.25], opacity: [0.5, 1, 0.5] } : { scaleY: 0.25, opacity: 0.3 }}
          transition={active ? { duration: 1.1, repeat: Infinity, ease: "easeInOut", delay: WAVEFORM_DELAYS[i] } : { duration: 0.3 }}
        />
      ))}
    </div>
  );
}

function FilmStripProgress({ currentStatus }: { currentStatus: AssemblyStatus }) {
  const currentIdx = PROGRESS_STAGES.indexOf(currentStatus);
  const isFailed = currentStatus === "failed";
  return (
    <div className="flex gap-1 items-center">
      {PROGRESS_STAGES.map((s, i) => {
        const done = !isFailed && i <= currentIdx;
        const active = !isFailed && i === currentIdx && currentStatus !== "completed";
        return (
          <div key={s} className="flex items-center gap-1 flex-1">
            <motion.div
              className={`h-1.5 flex-1 rounded-full ${done ? "bg-violet-500" : "bg-[var(--bg-elevated)]"}`}
              initial={false}
              animate={{ scaleX: done ? 1 : 0, opacity: done ? 1 : 0.3 }}
              style={{ originX: 0 }}
              transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
            />
            {active && (
              <motion.div
                className="w-1.5 h-1.5 rounded-full bg-[var(--accent-violet)] glow-pulse"
                animate={{ scale: [1, 1.4, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

interface Stage3Props {
  projectId: string;
  assemblyJobId: string;
  token: string;
}

export default function Stage3Assembly({ projectId, assemblyJobId, token }: Stage3Props) {
  const [status, setStatus] = useState<AssemblyStatus>("generating_music");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const statusRef = useRef(status);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await apiFetch(`/api/stage3/status/${assemblyJobId}`, token);
        const data = await res.json() as { status?: AssemblyStatus; videoUrl?: string; error?: string };

        // Only update state when values actually change to avoid no-op re-renders
        if (data.status && data.status !== statusRef.current) {
          statusRef.current = data.status;
          setStatus(data.status);
        }
        if (data.videoUrl) setVideoUrl(prev => prev ?? data.videoUrl!);
        if (data.error) setError(prev => prev ?? data.error!);

        if (data.status === "completed" || data.status === "failed") clearInterval(interval);
      } catch { }
    }, 3000);
    return () => clearInterval(interval);
  }, [assemblyJobId, token]);

  const isDone = status === "completed";
  const isFailed = status === "failed";
  const isActive = !isDone && !isFailed;
  const Icon = STAGE_ICONS[status];

  return (
    <div className="flex flex-col gap-6 max-w-md mx-auto">
      <SectionHeading
        step={3}
        title="Creating Your Music Video"
        subtitle="Sit back while we compose and assemble your cinematic story."
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={status}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
          className={`card-glass p-6 flex flex-col items-center gap-4 text-center ${
            isDone   ? "border-green-500/25 shadow-glow-green" :
            isFailed ? "border-red-500/20" :
                       "border-[var(--border-accent)] shadow-glow"
          }`}
        >
          {status === "generating_music" ? (
            <div className="flex flex-col items-center gap-3">
              <div className="p-3 rounded-2xl bg-violet-500/10">
                <Music className="w-7 h-7 text-[var(--accent-violet)]" />
              </div>
              <WaveformVisualizer active />
            </div>
          ) : isActive ? (
            <motion.div
              className="p-3 rounded-2xl bg-violet-500/10"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <Icon className="w-7 h-7 text-[var(--accent-violet)]" />
            </motion.div>
          ) : (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className={`p-3 rounded-2xl ${isDone ? "bg-green-500/10" : "bg-red-500/10"}`}
            >
              <Icon className={`w-7 h-7 ${isDone ? "text-green-400" : "text-red-400"}`} />
            </motion.div>
          )}

          <div className="flex flex-col gap-1">
            <p className={`text-base font-semibold ${isFailed ? "text-red-300" : "text-[var(--text-primary)]"}`}>
              {STAGE_LABELS[status]}
            </p>
            <p className="text-xs text-[var(--text-muted)]">{STAGE_SUBTITLES[status]}</p>
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/5 px-3 py-2 rounded-lg border border-red-500/10">{error}</p>
          )}
          {isActive && (
            <p className="text-xs text-[var(--text-faint)]">Est. 2–4 minutes · please keep this tab open</p>
          )}
        </motion.div>
      </AnimatePresence>

      <FilmStripProgress currentStatus={status} />

      <div className="flex justify-between text-xs text-[var(--text-faint)] -mt-4 px-0.5">
        <span>Music</span>
        <span>Assemble</span>
        <span>Upload</span>
        <span>Done</span>
      </div>

      {videoUrl && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <VideoPlayer videoUrl={videoUrl} />
        </motion.div>
      )}
    </div>
  );
}
