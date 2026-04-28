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

interface Props {
  timepoints: Timepoint[];
  enhancedPrompt: string;
}

export default function TimepointTimeline({ timepoints, enhancedPrompt }: Props) {
  return (
    <div className="flex flex-col gap-4 max-w-md mx-auto">
      {/* Enhanced prompt */}
      <div className="card-elevated p-4">
        <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-2">Enhanced Music Prompt</p>
        <p className="text-sm text-[var(--text-primary)] leading-relaxed">{enhancedPrompt}</p>
      </div>

      {/* Timeline */}
      <div className="flex flex-col gap-2">
        <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Dramatic Timeline ({timepoints.length} scenes)</p>
        {timepoints.map((tp, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
            className="card-glass p-3.5 flex flex-col gap-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-[var(--accent-violet)] bg-violet-500/10 px-2 py-0.5 rounded-md">
                  {tp.timestamp}
                </span>
                <span className="text-sm font-medium text-[var(--text-primary)]">{tp.label}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <IntensityIcon intensity={tp.intensity} />
                <Badge color={intensityBadgeColor(tp.intensity)}>{tp.intensity}</Badge>
              </div>
            </div>
            <p className="text-xs text-[var(--accent-amber)] italic">{tp.lyricMoment}</p>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">{tp.sceneDesc}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-[var(--text-faint)] flex items-center gap-1"><Clock className="w-3 h-3" />{tp.transitionDuration}s {tp.transition}</span>
              <span className="text-xs text-[var(--text-faint)]">· {tp.visualEffect}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
