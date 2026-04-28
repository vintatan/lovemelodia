import { motion } from "motion/react";
import { RefreshCw } from "lucide-react";
import { Badge } from "../../UI.tsx";

interface Timepoint {
  timestamp: string;
  label: string;
  mood: string;
  intensity: "low" | "medium" | "high";
}

interface StoryboardFrameProps {
  timepoint: Timepoint;
  imageUrl: string | null;
  loading: boolean;
  error: string | null;
  onRegen: () => void;
  creditsRemaining: number;
}

export default function StoryboardFrame({ timepoint, imageUrl, loading, error, onRegen, creditsRemaining }: StoryboardFrameProps) {
  const intensityGlow = {
    high:   "shadow-[0_0_16px_rgba(239,68,68,0.25)]",
    medium: "shadow-[0_0_16px_rgba(245,158,11,0.2)]",
    low:    "shadow-[0_0_16px_rgba(34,197,94,0.15)]",
  }[timepoint.intensity];

  return (
    <div className="flex flex-col gap-1.5">
      {/* Film holes top */}
      <div className="flex gap-1 px-1 justify-around opacity-30">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="film-hole" />)}
      </div>

      <div className={`relative aspect-[9/16] rounded-xl overflow-hidden bg-[var(--bg-elevated)] border border-[var(--border-subtle)] transition-shadow duration-300 ${imageUrl && !loading ? intensityGlow : ""}`}>
        {/* Shimmer loading state */}
        {loading && (
          <div className="absolute inset-0 shimmer flex flex-col items-center justify-center gap-3">
            <motion.div
              className="w-8 h-8 rounded-full border-2 border-[var(--accent-violet)] border-t-transparent"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
            <span className="text-xs text-[var(--text-faint)] font-mono">generating…</span>
          </div>
        )}

        {/* Loaded image */}
        {imageUrl && !loading && (
          <>
            <motion.img
              src={imageUrl}
              alt={timepoint.label}
              className="w-full h-full object-cover"
              initial={{ opacity: 0, scale: 1.06 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
            />
            {/* Cinematic vignette */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/10 pointer-events-none" />
          </>
        )}

        {error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center p-3 bg-red-500/5">
            <p className="text-xs text-red-400 text-center leading-snug">{error}</p>
          </div>
        )}

        {/* Regen button */}
        {imageUrl && !loading && (
          <motion.button
            onClick={onRegen}
            disabled={creditsRemaining < 5}
            className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-lg text-white hover:bg-black/80 disabled:opacity-40 transition-all backdrop-blur-sm"
            title="Regenerate (5 credits)"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </motion.button>
        )}

        {/* Timestamp overlay */}
        <div className="absolute bottom-2 left-2">
          <span className="text-xs font-mono bg-black/70 text-[var(--accent-violet)] px-1.5 py-0.5 rounded-md backdrop-blur-sm">
            {timepoint.timestamp}
          </span>
        </div>
      </div>

      {/* Film holes bottom */}
      <div className="flex gap-1 px-1 justify-around opacity-30">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="film-hole" />)}
      </div>

      <div className="flex items-center justify-between px-0.5">
        <span className="text-xs font-medium text-[var(--text-primary)] truncate">{timepoint.label}</span>
        <Badge color={timepoint.intensity === "high" ? "red" : timepoint.intensity === "medium" ? "amber" : "green"}>
          {timepoint.mood}
        </Badge>
      </div>
    </div>
  );
}
