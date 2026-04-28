import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Music, Film, Upload, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { SectionHeading } from "../../UI.tsx";
import VideoPlayer from "./VideoPlayer.tsx";

type AssemblyStatus = "generating_music" | "assembling_video" | "uploading" | "completed" | "failed";

const STAGE_LABELS: Record<AssemblyStatus, string> = {
  generating_music: "Generating music with Lyria 3 Pro…",
  assembling_video: "Assembling storyboard with Ken Burns + dramatic transitions…",
  uploading:        "Uploading final video…",
  completed:        "Your music video is ready!",
  failed:           "Assembly failed. Credits refunded.",
};

const STAGE_ICONS: Record<AssemblyStatus, typeof Music> = {
  generating_music: Music,
  assembling_video: Film,
  uploading:        Upload,
  completed:        CheckCircle2,
  failed:           XCircle,
};

interface Stage3Props {
  projectId: string;
  assemblyJobId: string;
  token: string;
}

export default function Stage3Assembly({ projectId, assemblyJobId, token }: Stage3Props) {
  const [status, setStatus] = useState<AssemblyStatus>("generating_music");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/stage3/status/${assemblyJobId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json() as {
          status?: AssemblyStatus; videoUrl?: string; error?: string;
        };
        if (data.status) setStatus(data.status);
        if (data.videoUrl) setVideoUrl(data.videoUrl);
        if (data.error) setError(data.error);
        if (data.status === "completed" || data.status === "failed") {
          clearInterval(interval);
        }
      } catch { }
    }, 3000);
    return () => clearInterval(interval);
  }, [assemblyJobId, token]);

  const Icon = STAGE_ICONS[status];
  const isDone = status === "completed";
  const isFailed = status === "failed";

  return (
    <div className="flex flex-col gap-5 max-w-md mx-auto">
      <SectionHeading
        step={3}
        title="Creating Your Music Video"
        subtitle="Sit back while we compose and assemble your cinematic story."
      />

      {/* Status card */}
      <motion.div
        key={status}
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`card-glass p-5 flex flex-col items-center gap-3 text-center ${
          isDone ? "border-green-500/20" : isFailed ? "border-red-500/20" : "border-[var(--border-accent)]"
        }`}
      >
        <div className={`p-3 rounded-2xl ${
          isDone ? "bg-green-500/10" : isFailed ? "bg-red-500/10" : "bg-violet-500/10"
        }`}>
          {!isDone && !isFailed ? (
            <Loader2 className="w-7 h-7 text-[var(--accent-violet)] animate-spin" />
          ) : (
            <Icon className={`w-7 h-7 ${isDone ? "text-green-400" : "text-red-400"}`} />
          )}
        </div>
        <p className={`text-sm font-medium ${isFailed ? "text-red-300" : "text-[var(--text-primary)]"}`}>
          {STAGE_LABELS[status]}
        </p>
        {error && <p className="text-xs text-red-400">{error}</p>}
        {!isDone && !isFailed && (
          <p className="text-xs text-[var(--text-faint)]">This takes 2–4 minutes</p>
        )}
      </motion.div>

      {/* Progress steps */}
      <div className="flex gap-2">
        {(["generating_music", "assembling_video", "uploading", "completed"] as AssemblyStatus[]).map((s, i) => {
          const stages: AssemblyStatus[] = ["generating_music", "assembling_video", "uploading", "completed"];
          const currentIdx = stages.indexOf(status);
          const stepIdx = stages.indexOf(s);
          const done = stepIdx <= currentIdx;
          return (
            <div key={s} className={`flex-1 h-1 rounded-full transition-all duration-500 ${done ? "bg-violet-500" : "bg-[var(--bg-elevated)]"}`} />
          );
        })}
      </div>

      {/* Video player */}
      {videoUrl && <VideoPlayer videoUrl={videoUrl} />}
    </div>
  );
}
