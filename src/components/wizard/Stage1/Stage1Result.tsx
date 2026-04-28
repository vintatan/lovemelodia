import { Button, SectionHeading } from "../../UI.tsx";
import TimepointTimeline from "./TimepointTimeline.tsx";
import { ArrowRight, Pencil } from "lucide-react";

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

interface Stage1ResultProps {
  enhancedPrompt: string;
  timepoints: Timepoint[];
  onApprove: () => void;
  onEdit: () => void;
  creditsRemaining: number;
}

export default function Stage1Result({ enhancedPrompt, timepoints, onApprove, onEdit, creditsRemaining }: Stage1ResultProps) {
  const totalFrameCredits = timepoints.length * 5;

  return (
    <div className="flex flex-col gap-5 max-w-md mx-auto">
      <SectionHeading
        step={1}
        title="Production Plan Ready"
        subtitle="Claude has enhanced your music prompt and mapped out the dramatic arc."
      />

      <TimepointTimeline enhancedPrompt={enhancedPrompt} timepoints={timepoints} />

      <div className="flex flex-col gap-2 pt-2">
        <Button onClick={onApprove} size="lg" className="w-full" disabled={creditsRemaining < totalFrameCredits}>
          Generate Storyboard ({timepoints.length} scenes) <ArrowRight className="w-4 h-4" />
        </Button>
        {creditsRemaining < totalFrameCredits && (
          <p className="text-xs text-red-400 text-center">Need {totalFrameCredits} credits for {timepoints.length} frames</p>
        )}
        <p className="text-xs text-[var(--text-faint)] text-center">Uses {totalFrameCredits} credits ({timepoints.length} × 5)</p>
        <Button onClick={onEdit} variant="ghost" size="sm" className="mx-auto">
          <Pencil className="w-3.5 h-3.5" /> Edit inputs
        </Button>
      </div>
    </div>
  );
}
