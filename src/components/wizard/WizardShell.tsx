import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import CreditsBadge from "../CreditsBadge.tsx";
import Stage1Form from "./Stage1/Stage1Form.tsx";
import Stage1Result from "./Stage1/Stage1Result.tsx";
import Stage2Storyboard from "./Stage2/Stage2Storyboard.tsx";
import Stage3Assembly from "./Stage3/Stage3Assembly.tsx";
import { apiFetch } from "../../lib/api.ts";

type WizardStep = "stage1_form" | "stage1_result" | "stage2_storyboard" | "stage3_assembly";

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

interface WizardShellProps {
  token: string;
  phone: string;
  credits: number;
  onCreditsUpdate: (credits: number) => void;
  onTopUp: () => void;
}

const STEPS: WizardStep[] = ["stage1_form", "stage1_result", "stage2_storyboard", "stage3_assembly"];
const STEP_LABELS: Record<WizardStep, string> = {
  stage1_form:       "Describe",
  stage1_result:     "Review",
  stage2_storyboard: "Storyboard",
  stage3_assembly:   "Music Video",
};
const STEP_ICONS: Record<WizardStep, string> = {
  stage1_form:       "✦",
  stage1_result:     "◈",
  stage2_storyboard: "⬚",
  stage3_assembly:   "▶",
};

export default function WizardShell({ token, phone, credits, onCreditsUpdate, onTopUp }: WizardShellProps) {
  const [step, setStep] = useState<WizardStep>("stage1_form");
  const [stepDir, setStepDir] = useState(1);
  const [loading, setLoading] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [enhancedPrompt, setEnhancedPrompt] = useState("");
  const [timepoints, setTimepoints] = useState<Timepoint[]>([]);
  const [assemblyJobId, setAssemblyJobId] = useState<string | null>(null);

  function goTo(next: WizardStep) {
    const nextIdx = STEPS.indexOf(next);
    const currIdx = STEPS.indexOf(step);
    setStepDir(nextIdx > currIdx ? 1 : -1);
    setStep(next);
  }

  async function handleStage1Submit(params: {
    characterImageBase64: string | null;
    characterDesc: string;
    theme: string;
    musicVibe: string;
  }) {
    setLoading(true);
    try {
      const res = await apiFetch("/api/stage1/enhance", token, {
        method: "POST",
        body: JSON.stringify(params),
      });
      const data = await res.json() as {
        projectId?: string; enhancedPrompt?: string; timepoints?: Timepoint[];
        creditsRemaining?: number; error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Enhancement failed");
      setProjectId(data.projectId!);
      setEnhancedPrompt(data.enhancedPrompt!);
      setTimepoints(data.timepoints!);
      if (data.creditsRemaining !== undefined) onCreditsUpdate(data.creditsRemaining);
      goTo("stage1_result");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleStage2Approve() {
    if (!projectId) return;
    try {
      // Approve and kick off assembly in parallel — approve is a DB-only status update
      const [approveRes, assembleRes] = await Promise.all([
        apiFetch("/api/stage2/approve", token, {
          method: "POST",
          body: JSON.stringify({ projectId }),
        }),
        apiFetch("/api/stage3/assemble", token, {
          method: "POST",
          body: JSON.stringify({ projectId }),
        }),
      ]);
      if (!approveRes.ok) {
        const d = await approveRes.json() as { error?: string };
        throw new Error(d.error ?? "Approve failed");
      }
      const data = await assembleRes.json() as { assemblyJobId?: string; error?: string };
      if (assembleRes.status === 402) { onTopUp(); return; }
      if (!assembleRes.ok) throw new Error(data.error ?? "Assembly failed to start");
      setAssemblyJobId(data.assemblyJobId!);
      onCreditsUpdate(credits - 30);
      goTo("stage3_assembly");
    } catch (err: any) {
      alert(err.message);
    }
  }

  const currentIdx = STEPS.indexOf(step);
  const progressPct = (currentIdx / (STEPS.length - 1)) * 100;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] sticky top-0 z-20 bg-[var(--bg-primary)]/90 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-red flex items-center justify-center shadow-glow">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="white">
              <path d="M9 18V5l12-2v13M6 21a3 3 0 100-6 3 3 0 000 6zm12-2a3 3 0 100-6 3 3 0 000 6z"/>
            </svg>
          </div>
          <h1 className="heading-display text-base text-gradient-studio">Kreasi AI</h1>
        </div>
        <CreditsBadge credits={credits} onTopUp={onTopUp} />
      </header>

      <div className="relative h-0.5 bg-[var(--bg-elevated)] overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 bg-gradient-violet"
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.6, ease: [0.25, 1, 0.5, 1] }}
        />
      </div>

      <div className="flex border-b border-[var(--border-subtle)] overflow-x-auto bg-[var(--bg-primary)]/60">
        {STEPS.map((s, i) => {
          const isActive = i === currentIdx;
          const isDone = i < currentIdx;
          return (
            <div
              key={s}
              className={`relative flex-1 min-w-fit px-3 py-2.5 text-center transition-all duration-300 ${
                isActive ? "text-[var(--accent-red)]" :
                isDone   ? "text-[var(--text-muted)]" :
                           "text-[var(--text-faint)]"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="tab-bg"
                  className="absolute inset-x-1 inset-y-1 rounded-lg bg-[var(--accent-red)]/8"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <span className="relative text-xs whitespace-nowrap">
                <span className="mr-1 font-mono">{STEP_ICONS[s]}</span>
                {STEP_LABELS[s]}
              </span>
              {isActive && (
                <motion.div
                  layoutId="step-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-red"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              {isDone && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent-red)]/30" />
              )}
            </div>
          );
        })}
      </div>

      <main className="flex-1 px-4 py-6 overflow-y-auto">
        <AnimatePresence mode="wait" custom={stepDir}>
          <motion.div
            key={step}
            custom={stepDir}
            initial={{ opacity: 0, x: stepDir * 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: stepDir * -20 }}
            transition={{ duration: 0.28, ease: [0.25, 1, 0.5, 1] }}
          >
            {step === "stage1_form" && (
              <Stage1Form onSubmit={handleStage1Submit} loading={loading} />
            )}
            {step === "stage1_result" && (
              <Stage1Result
                enhancedPrompt={enhancedPrompt}
                timepoints={timepoints}
                onApprove={() => goTo("stage2_storyboard")}
                onEdit={() => goTo("stage1_form")}
                creditsRemaining={credits}
              />
            )}
            {step === "stage2_storyboard" && projectId && (
              <Stage2Storyboard
                projectId={projectId}
                timepoints={timepoints}
                token={token}
                onApprove={handleStage2Approve}
                onCreditsUpdate={onCreditsUpdate}
                creditsRemaining={credits}
              />
            )}
            {step === "stage3_assembly" && assemblyJobId && (
              <Stage3Assembly
                projectId={projectId!}
                assemblyJobId={assemblyJobId}
                token={token}
                onCreditsInsufficient={onTopUp}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
