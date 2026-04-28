import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import CreditsBadge from "../CreditsBadge.tsx";
import Stage1Form from "./Stage1/Stage1Form.tsx";
import Stage1Result from "./Stage1/Stage1Result.tsx";
import Stage2Storyboard from "./Stage2/Stage2Storyboard.tsx";
import Stage3Assembly from "./Stage3/Stage3Assembly.tsx";

type WizardStep =
  | "stage1_form"
  | "stage1_result"
  | "stage2_storyboard"
  | "stage3_assembly";

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

const STEP_LABELS: Record<WizardStep, string> = {
  stage1_form:      "Describe",
  stage1_result:    "Review Plan",
  stage2_storyboard:"Storyboard",
  stage3_assembly:  "Music Video",
};

export default function WizardShell({ token, phone, credits, onCreditsUpdate, onTopUp }: WizardShellProps) {
  const [step, setStep] = useState<WizardStep>("stage1_form");
  const [loading, setLoading] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [enhancedPrompt, setEnhancedPrompt] = useState("");
  const [timepoints, setTimepoints] = useState<Timepoint[]>([]);
  const [assemblyJobId, setAssemblyJobId] = useState<string | null>(null);

  async function handleStage1Submit(params: {
    characterImageBase64: string | null;
    characterDesc: string;
    theme: string;
    musicVibe: string;
  }) {
    setLoading(true);
    try {
      const res = await fetch("/api/stage1/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
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
      setStep("stage1_result");
    } catch (err: any) {
      console.error(err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleStage1Approve() {
    setStep("stage2_storyboard");
  }

  async function handleStage2Approve() {
    if (!projectId) return;
    // Approve storyboard on server
    await fetch("/api/stage2/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ projectId }),
    });
    // Start stage 3 assembly
    const res = await fetch("/api/stage3/assemble", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ projectId }),
    });
    const data = await res.json() as { assemblyJobId?: string; error?: string };
    if (!res.ok) { alert(data.error ?? "Assembly failed to start"); return; }
    setAssemblyJobId(data.assemblyJobId!);
    onCreditsUpdate(credits - 30); // optimistic
    setStep("stage3_assembly");
  }

  const steps: WizardStep[] = ["stage1_form", "stage1_result", "stage2_storyboard", "stage3_assembly"];
  const currentIdx = steps.indexOf(step);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] sticky top-0 z-10 bg-[var(--bg-primary)]/80 backdrop-blur-sm">
        <h1 className="heading-display text-sm text-gradient-studio">Kreasi AI</h1>
        <CreditsBadge credits={credits} onTopUp={onTopUp} />
      </header>

      {/* Step indicator */}
      <div className="flex border-b border-[var(--border-subtle)] overflow-x-auto">
        {steps.map((s, i) => (
          <div
            key={s}
            className={`flex-1 min-w-fit px-3 py-2.5 text-xs text-center whitespace-nowrap transition-all ${
              i === currentIdx
                ? "text-[var(--accent-violet)] border-b-2 border-[var(--accent-violet)]"
                : i < currentIdx
                ? "text-[var(--text-muted)]"
                : "text-[var(--text-faint)]"
            }`}
          >
            <span className="mr-1.5">{i + 1}.</span>
            {STEP_LABELS[s]}
          </div>
        ))}
      </div>

      {/* Content */}
      <main className="flex-1 px-4 py-6 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {step === "stage1_form" && (
              <Stage1Form onSubmit={handleStage1Submit} loading={loading} />
            )}
            {step === "stage1_result" && (
              <Stage1Result
                enhancedPrompt={enhancedPrompt}
                timepoints={timepoints}
                onApprove={handleStage1Approve}
                onEdit={() => setStep("stage1_form")}
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
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
