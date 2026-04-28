import { Coins } from "lucide-react";

interface CreditsBadgeProps {
  credits: number;
  onTopUp: () => void;
}

export default function CreditsBadge({ credits, onTopUp }: CreditsBadgeProps) {
  const isLow = credits < 50;
  return (
    <button
      onClick={onTopUp}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-all hover:brightness-110 ${
        isLow
          ? "bg-red-500/10 border-red-500/20 text-red-300"
          : "bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-muted)]"
      }`}
    >
      <Coins className="w-3.5 h-3.5" />
      {credits} credits
    </button>
  );
}
