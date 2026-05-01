import { useState, useEffect, useRef, useMemo } from "react";
import { motion } from "motion/react";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { Button, SectionHeading } from "../../UI.tsx";
import StoryboardFrame from "./StoryboardFrame.tsx";
import { apiFetch } from "../../../lib/api.ts";

interface Timepoint {
  timestamp: string;
  label: string;
  mood: string;
  intensity: "low" | "medium" | "high";
}

interface FrameState {
  imageUrl: string | null;
  loading: boolean;
  error: string | null;
}

interface Stage2Props {
  projectId: string;
  timepoints: Timepoint[];
  token: string;
  onApprove: () => void;
  onCreditsUpdate: (credits: number) => void;
  creditsRemaining: number;
}

export default function Stage2Storyboard({ projectId, timepoints, token, onApprove, onCreditsUpdate, creditsRemaining }: Stage2Props) {
  const [frames, setFrames] = useState<FrameState[]>(
    timepoints.map(() => ({ imageUrl: null, loading: false, error: null }))
  );
  const [generating, setGenerating] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Pick 3 representative timepoints: intro (0), climax (mid), outro (last)
  const storyboardIndices = useMemo(() => {
    const n = timepoints.length;
    if (n <= 3) return timepoints.map((_, i) => i);
    return [0, Math.floor((n - 1) / 2), n - 1];
  }, [timepoints.length]);

  async function generateFrame(idx: number, isRegen = false, signal?: AbortSignal): Promise<boolean> {
    setFrames(prev => prev.map((f, i) => i === idx ? { ...f, loading: true, error: null } : f));
    try {
      const endpoint = isRegen ? "/api/stage2/regenerate-frame" : "/api/stage2/generate-frame";
      const res = await apiFetch(endpoint, token, {
        method: "POST",
        body: JSON.stringify({ projectId, timepointIndex: idx }),
        signal,
      });
      const data = await res.json() as {
        imageUrl?: string; creditsRemaining?: number; allFramesDone?: boolean; error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setFrames(prev => prev.map((f, i) => i === idx ? { imageUrl: data.imageUrl!, loading: false, error: null } : f));
      if (data.creditsRemaining !== undefined) onCreditsUpdate(data.creditsRemaining);
      return true;
    } catch (err: any) {
      if (err.name === "AbortError") return false;
      setFrames(prev => prev.map((f, i) => i === idx ? { ...f, loading: false, error: err.message } : f));
      return false;
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;

    async function generateAll() {
      setGenerating(true);
      setRetrying(false);
      const succeeded = new Set<number>();

      // Initial pass
      for (const idx of storyboardIndices) {
        if (controller.signal.aborted) break;
        if (await generateFrame(idx, false, controller.signal)) succeeded.add(idx);
      }

      // Retry loop: keep retrying failures until all 3 succeed (up to 5 extra attempts)
      if (succeeded.size < storyboardIndices.length && !controller.signal.aborted) {
        setRetrying(true);
        for (let attempt = 0; attempt < 5 && succeeded.size < storyboardIndices.length && !controller.signal.aborted; attempt++) {
          for (const idx of storyboardIndices) {
            if (controller.signal.aborted) break;
            if (!succeeded.has(idx)) {
              if (await generateFrame(idx, false, controller.signal)) succeeded.add(idx);
            }
          }
        }
        setRetrying(false);
      }

      setGenerating(false);
    }

    generateAll();
    return () => controller.abort();
  }, [projectId, token]);

  const generatedCount = storyboardIndices.filter(i => frames[i]?.imageUrl).length;
  const allFramesHaveImages = generatedCount === storyboardIndices.length;

  const subtitle = !generating && !retrying
    ? "Review your 3 scenes and regenerate any (5 credits each)"
    : retrying
    ? `Retrying failed scenes… ${generatedCount}/3`
    : `Generating scenes… ${generatedCount}/3`;

  return (
    <div className="flex flex-col gap-5">
      <SectionHeading
        step={2}
        title="Storyboard"
        subtitle={subtitle}
      />

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {storyboardIndices.map((tpIdx) => (
          <motion.div
            key={tpIdx}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: storyboardIndices.indexOf(tpIdx) * 0.07 }}
          >
            <StoryboardFrame
              timepoint={timepoints[tpIdx]}
              imageUrl={frames[tpIdx]?.imageUrl ?? null}
              loading={frames[tpIdx]?.loading ?? false}
              error={frames[tpIdx]?.error ?? null}
              onRegen={() => generateFrame(tpIdx, true)}
              creditsRemaining={creditsRemaining}
            />
          </motion.div>
        ))}
      </div>

      {allFramesHaveImages && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-2"
        >
          <div className="flex items-center gap-2 text-green-400 text-sm">
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <CheckCircle2 className="w-4 h-4" />
            </motion.div>
            All 3 scenes generated
          </div>
          <Button onClick={onApprove} size="lg" className="w-full">
            Approve Storyboard → Create Music Video <ArrowRight className="w-4 h-4" />
          </Button>
          <p className="text-xs text-[var(--text-faint)] text-center">Uses 30 credits</p>
        </motion.div>
      )}
    </div>
  );
}
