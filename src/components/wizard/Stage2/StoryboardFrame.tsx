import { motion } from "motion/react";
import { RefreshCw } from "lucide-react";
import { Badge } from "../../UI.tsx";
import { INTENSITY, type Intensity } from "../../../lib/intensity.ts";

interface Timepoint {
  timestamp: string;
  label: string;
  mood: string;
  intensity: Intensity;
}

interface StoryboardFrameProps {
  timepoint: Timepoint;
  imageUrl: string | null;
  loading: boolean;
  error: string | null;
  onRegen: () => void;
  creditsRemaining: number;
}

function FilmHoles() {
  return (
    <div className="flex gap-1 px-1 justify-around opacity-30">
      {Array.from({ length: 4 }).map((_, i) => <div key={i} className="film-hole" />)}
    </div>
  );
}

export default function StoryboardFrame({ timepoint, imageUrl, loading, error, onRegen, creditsRemaining }: StoryboardFrameProps) {
  const config = INTENSITY[timepoint.intensity];
  const hasImage = Boolean(imageUrl) && !loading;

  return (
    <div className="flex flex-col gap-1.5">
      <FilmHoles />

      <div className={`relative aspect-[9/16] rounded-xl overflow-hidden bg-[var(--bg-elevated)] border border-[var(--border-subtle)] transition-shadow duration-300 ${hasImage ? config.glow : ""}`}>
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

        {hasImage && (
          <>
            <motion.img
              src={imageUrl!}
              alt={timepoint.label}
              className="w-full h-full object-cover"
              initial={{ opacity: 0, scale: 1.06 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/10 pointer-events-none" />
          </>
        )}

        {error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center p-3 bg-red-500/5">
            <p className="text-xs text-red-400 text-center leading-snug">{error}</p>
          </div>
        )}

        {hasImage && (
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

        <div className="absolute bottom-2 left-2">
          <span className="text-xs font-mono bg-black/70 text-[var(--accent-violet)] px-1.5 py-0.5 rounded-md backdrop-blur-sm">
            {timepoint.timestamp}
          </span>
        </div>
      </div>

      <FilmHoles />

      <div className="flex items-center justify-between px-0.5">
        <span className="text-xs font-medium text-[var(--text-primary)] truncate">{timepoint.label}</span>
        <Badge color={config.badgeColor}>{timepoint.mood}</Badge>
      </div>
    </div>
  );
}
