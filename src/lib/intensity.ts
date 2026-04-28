import { Zap, Wind, Waves, type LucideIcon } from "lucide-react";

export type Intensity = "low" | "medium" | "high";
export type BadgeColor = "green" | "amber" | "red";

interface IntensityConfig {
  icon: LucideIcon;
  iconClass: string;
  badgeColor: BadgeColor;
  dotClass: string;
  glow: string;
  borderClass: string;
}

export const INTENSITY: Record<Intensity, IntensityConfig> = {
  high: {
    icon: Zap,
    iconClass: "text-red-400",
    badgeColor: "red",
    dotClass: "bg-red-400",
    glow: "shadow-[0_0_16px_rgba(239,68,68,0.25)]",
    borderClass: "border-red-500/20 hover:border-red-500/35",
  },
  medium: {
    icon: Waves,
    iconClass: "text-amber-400",
    badgeColor: "amber",
    dotClass: "bg-amber-400",
    glow: "shadow-[0_0_16px_rgba(245,158,11,0.2)]",
    borderClass: "border-amber-500/20 hover:border-amber-500/35",
  },
  low: {
    icon: Wind,
    iconClass: "text-green-400",
    badgeColor: "green",
    dotClass: "bg-green-400",
    glow: "shadow-[0_0_16px_rgba(34,197,94,0.15)]",
    borderClass: "border-green-500/20 hover:border-green-500/35",
  },
};
