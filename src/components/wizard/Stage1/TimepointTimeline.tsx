import { motion } from "motion/react";
import { Clock, Zap, Wind, Waves } from "lucide-react";
import { Badge } from "../../UI.tsx";

interface Timepoint {
  timestamp: string;
  label: string;
  lyricMoment: string;
  sceneDesc: string;
  mood: string;
  intensity: "low" | "medium" | "high";
  visualEffect: string;
  transition: string;
  transitionDuration: number;
}

function IntensityIcon({ intensity }: { intensity: string }) {
  if (intensity === "high") return <Zap className="w-3.5 h-3.5 text-red-400" />;
  if (intensity === "medium") return <Waves className="w-3.5 h-3.5 text-amber-400" />;
  return <Wind className="w-3.5 h-3.5 text-green-400" />;
}

function intensityBadgeColor(intensity: string): "green" | "amber" | "red" {
  if (intensity === "high") return "red";
  if (intensity === "medium") return "amber";
  return "green";
}

const INTENSITY_ACCENT: Record<string, string> = {
  high:   "border-red-500/20 hover:border-red-500/35",
  medium: "border-amber-500/20 hover:border-amber-500/35",
  low:    "border-green-500/20 hover:border-green-500/35",
};

interface Props {
  timepoints: Timepoint[];
  enhancedPrompt: string;
}

export default function TimepointTimeline({ timepoints, enhancedPrompt }: Props) {
  return (
    <div className="flex flex-col gap-4 max-w-md mx-auto">
      {/* Enhanced prompt */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-elevated p-4 border border-[var(--border-accent)]"
      >
        <p className="text-xs text-[var(--accent-violet)] uppercase tracking-wider mb-2 font-medium">Enhanced Music Prompt</p>
        <p className="text-sm text-[var(--text-primary)] leading-relaxed">{enhancedPrompt}</p>
      </motion.div>

      {/* Timeline */}
      <div className="flex flex-col gap-2">
        <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
          Dramatic Timeline — {timepoints.length} scenes
        </p>

        {/* Connecting line */}
        <div className="relative">
          <div className="absolute left-[11px] top-4 bottom-4 w-px bg-gradient-to-b from-violet-500/40 via-violet-500/20 to-violet-500/5 pointer-events-none" />

          <div className="flex flex-col gap-2">
            {timepoints.map((tp, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.07, duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
                whileHover={{ x: 3, transition: { duration: 0.15 } }}
                className={`card-glass p-3.5 ml-5 flex flex-col gap-2 border transition-all duration-200 ${INTENSITY_ACCENT[tp.intensity]}`}
              >
                {/* Timeline dot */}
                <div className={`absolute left-0 mt-3.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--bg-primary)] ml-1.5 ${
                  tp.intensity === "high" ? "bg-red-400" :
                  tp.intensity === "medium" ? "bg-amber-400" : "bg-green-400"
                }`} style={{ marginLeft: "-1.5rem" }} />

                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-[var(--accent-violet)] bg-violet-500/10 px-2 py-0.5 rounded-md">
                      {tp.timestamp}
                    </span>
                    <span className="text-sm font-medium text-[var(--text-primary)]">{tp.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <IntensityIcon intensity={tp.intensity} />
                    <Badge color={intensityBadgeColor(tp.intensity)}>{tp.intensity}</Badge>
                  </div>
                </div>

                <p className="text-xs text-[var(--accent-amber)] italic leading-snug">{tp.lyricMoment}</p>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">{tp.sceneDesc}</p>

                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs text-[var(--text-faint)] flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {tp.transitionDuration}s {tp.transition}
                  </span>
                  <span className="text-xs text-[var(--text-faint)]">· {tp.visualEffect}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
