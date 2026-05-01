import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";

interface SocialProofItem {
  name: string;
  city: string;
  action: string;
  package?: string;
}

interface Stats {
  creatorCount: number;
  recentActivity: SocialProofItem[];
}

function actionLabel(item: SocialProofItem): string {
  if (item.action === "upgrade") return `${item.name} dari ${item.city} upgrade kredit`;
  return `${item.name} dari ${item.city} baru bergabung`;
}

export default function TopBanner({ onStart }: { onStart: () => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [tickerIdx, setTickerIdx] = useState(0);

  useEffect(() => {
    fetch("/api/public/stats")
      .then(r => r.json())
      .then((d: Stats) => setStats(d))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!stats?.recentActivity.length) return;
    const t = setInterval(() => {
      setTickerIdx(i => (i + 1) % stats.recentActivity.length);
    }, 3200);
    return () => clearInterval(t);
  }, [stats?.recentActivity.length]);

  const items = stats?.recentActivity ?? [];
  const count = stats?.creatorCount ?? 0;

  return (
    <div
      className="w-full flex items-center justify-center gap-2 sm:gap-4 px-4 py-2 text-xs sm:text-sm font-semibold overflow-hidden"
      style={{ background: "linear-gradient(90deg, #f59e0b 0%, #fbbf24 50%, #f59e0b 100%)", color: "#1a0a00", minHeight: 36 }}
    >
      {/* Creator count */}
      <span className="whitespace-nowrap flex-shrink-0">
        50+ kreator sudah bikin musik
        {" —"}
      </span>

      {/* Scrolling ticker */}
      {items.length > 0 && (
        <span className="relative overflow-hidden flex-1 min-w-0 max-w-xs sm:max-w-sm h-5 flex items-center">
          <AnimatePresence mode="wait">
            <motion.span
              key={tickerIdx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
              className="absolute inset-0 flex items-center whitespace-nowrap truncate text-[#4a1a00]/80"
            >
              ✦ {actionLabel(items[tickerIdx])}
            </motion.span>
          </AnimatePresence>
        </span>
      )}

      {/* CTA */}
      <button
        onClick={onStart}
        className="flex-shrink-0 font-bold underline underline-offset-2 hover:opacity-70 transition-opacity whitespace-nowrap"
        style={{ color: "#1a0a00" }}
      >
        Mulai Sekarang →
      </button>
    </div>
  );
}
