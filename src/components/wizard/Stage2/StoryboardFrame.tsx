import { motion } from "motion/react";
import { RefreshCw, Loader2 } from "lucide-react";
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
  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative aspect-[9/16] rounded-xl overflow-hidden bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--accent-violet)]" />
            <span className="text-xs text-[var(--text-faint)]">Generating…</span>
          </div>
        )}
        {imageUrl && !loading && (
          <motion.img
            src={imageUrl}
            alt={timepoint.label}
            className="w-full h-full object-cover"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          />
        )}
        {error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center p-3">
            <p className="text-xs text-red-400 text-center">{error}</p>
          </div>
        )}
        {imageUrl && !loading && (
          <button
            onClick={onRegen}
            disabled={creditsRemaining < 5}
            className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-lg text-white hover:bg-black/80 disabled:opacity-40 transition-all"
            title="Regenerate (5 credits)"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
        {/* Timestamp overlay */}
        <div className="absolute bottom-2 left-2">
          <span className="text-xs font-mono bg-black/70 text-[var(--accent-violet)] px-1.5 py-0.5 rounded-md">
            {timepoint.timestamp}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between px-0.5">
        <span className="text-xs font-medium text-[var(--text-primary)]">{timepoint.label}</span>
        <Badge color={timepoint.intensity === "high" ? "red" : timepoint.intensity === "medium" ? "amber" : "green"}>
          {timepoint.mood}
        </Badge>
      </div>
    </div>
  );
}
