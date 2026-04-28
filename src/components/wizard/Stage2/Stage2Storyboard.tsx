import { useState, useEffect, useRef } from "react";
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
  const abortRef = useRef<AbortController | null>(null);

  async function generateFrame(idx: number, isRegen = false, signal?: AbortSignal) {
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
    } catch (err: any) {
      if (err.name === "AbortError") return;
      setFrames(prev => prev.map((f, i) => i === idx ? { ...f, loading: false, error: err.message } : f));
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;

    async function generateAll() {
      setGenerating(true);
      for (let i = 0; i < timepoints.length; i++) {
        if (controller.signal.aborted) break;
        await generateFrame(i, false, controller.signal);
      }
      setGenerating(false);
    }
    generateAll();

    return () => controller.abort();
  }, [projectId, token]);

  const generatedCount = frames.filter(f => f.imageUrl).length;
  const allFramesHaveImages = generatedCount === timepoints.length;

  return (
    <div className="flex flex-col gap-5">
      <SectionHeading
        step={2}
        title="Storyboard"
        subtitle={generating
          ? `Generating scenes… ${generatedCount}/${timepoints.length}`
          : "Review and regenerate any scene (5 credits each)"
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {timepoints.map((tp, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
          >
            <StoryboardFrame
              timepoint={tp}
              imageUrl={frames[i].imageUrl}
              loading={frames[i].loading}
              error={frames[i].error}
              onRegen={() => generateFrame(i, true)}
              creditsRemaining={creditsRemaining}
            />
          </motion.div>
        ))}
      </div>

      {allFramesHaveImages && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-green-400 text-sm">
            <CheckCircle2 className="w-4 h-4" />
            All scenes generated
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
