import { Coins } from "lucide-react";

interface CreditsBadgeProps {
  credits: number;
  onTopUp: () => void;
}

export default function CreditsBadge({ credits, onTopUp }: CreditsBadgeProps) {
  const isEmpty = credits === 0;
  const isLow = credits > 0 && credits < 3;

  const colorClass = isEmpty
    ? "bg-red-500/10 border-red-500/20 text-red-400"
    : isLow
    ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
    : "bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-muted)]";

  const label = isEmpty ? "Habis" : `${credits} hadiah tersisa`;

  return (
    <button
      onClick={onTopUp}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-all hover:brightness-110 ${colorClass}`}
    >
      <Coins className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}
