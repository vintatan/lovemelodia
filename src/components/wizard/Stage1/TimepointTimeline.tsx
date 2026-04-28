import { motion } from "motion/react";
import { Clock } from "lucide-react";
import { Badge } from "../../UI.tsx";
import { INTENSITY, type Intensity } from "../../../lib/intensity.ts";

interface Timepoint {
  timestamp: string;
  label: string;
  lyricMoment: string;
  sceneDesc: string;
  mood: string;
  intensity: Intensity;
  visualEffect: string;
  transition: string;
  transitionDuration: number;
}

interface Props {
  timepoints: Timepoint[];
  enhancedPrompt: string;
}

export default function TimepointTimeline({ timepoints, enhancedPrompt }: Props) {
  return (
    <div className="flex flex-col gap-4 max-w-md mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-elevated p-4 border border-[var(--border-accent)]"
      >
        <p className="text-xs text-[var(--accent-violet)] uppercase tracking-wider mb-2 font-medium">Enhanced Music Prompt</p>
        <p className="text-sm text-[var(--text-primary)] leading-relaxed">{enhancedPrompt}</p>
      </motion.div>

      <div className="flex flex-col gap-2">
        <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
          Dramatic Timeline — {timepoints.length} scenes
        </p>

        <div className="relative pl-6">
          {/* Connecting line behind cards */}
          <div className="absolute left-[9px] top-3 bottom-3 w-px bg-gradient-to-b from-violet-500/40 via-violet-500/20 to-violet-500/5 pointer-events-none" />

          <div className="flex flex-col gap-2">
            {timepoints.map((tp, i) => {
              const config = INTENSITY[tp.intensity];
              const IntensityIcon = config.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -14 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07, duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
                  whileHover={{ x: 3, transition: { duration: 0.15 } }}
                  className={`card-glass p-3.5 flex flex-col gap-2 border transition-all duration-200 ${config.borderClass}`}
                >
                  {/* Timeline dot — positioned relative to the pl-6 container */}
                  <div className={`absolute left-[5px] w-3 h-3 rounded-full border-2 border-[var(--bg-primary)] ${config.dotClass}`}
                    style={{ marginTop: "0.9rem" }}
                  />

                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-[var(--accent-violet)] bg-violet-500/10 px-2 py-0.5 rounded-md">
                        {tp.timestamp}
                      </span>
                      <span className="text-sm font-medium text-[var(--text-primary)]">{tp.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <IntensityIcon className={`w-3.5 h-3.5 ${config.iconClass}`} />
                      <Badge color={config.badgeColor}>{tp.intensity}</Badge>
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
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
