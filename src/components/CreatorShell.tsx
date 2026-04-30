import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import CreditsBadge from "./CreditsBadge.tsx";
import CreditsModal from "./CreditsModal.tsx";
import MusicCreator from "./music/MusicCreator.tsx";

type Mode = "music" | "novel" | "video";

const MODES: { id: Mode; icon: string; label: string; soon?: boolean }[] = [
  { id: "music",  icon: "🎵", label: "Musik" },
  { id: "novel",  icon: "📖", label: "Musik Novel", soon: true },
  { id: "video",  icon: "🎬", label: "Musik Video", soon: true },
];

interface CreatorShellProps {
  token: string;
  phone: string;
  credits: number;
  onCreditsUpdate: (n: number) => void;
}

export default function CreatorShell({ token, phone, credits, onCreditsUpdate }: CreatorShellProps) {
  const [mode, setMode] = useState<Mode>("music");
  const [creditsModalOpen, setCreditsModalOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] sticky top-0 z-20 bg-[var(--bg-primary)]/90 backdrop-blur-md">
        <h1 className="heading-display text-base text-gradient-studio">Kreasi AI</h1>
        <CreditsBadge credits={credits} onTopUp={() => setCreditsModalOpen(true)} />
      </header>

      {/* Mode tabs */}
      <div className="flex border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]/60">
        {MODES.map(m => {
          const isActive = m.id === mode;
          return (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`relative flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-sm transition-all duration-200 ${
                isActive ? "text-[var(--accent-violet)]" : "text-[var(--text-faint)] hover:text-[var(--text-muted)]"
              }`}
            >
              <span>{m.icon}</span>
              <span className="font-medium whitespace-nowrap">{m.label}</span>
              {m.soon && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--accent-amber)]/15 text-[var(--accent-amber)] uppercase tracking-wide">
                  Soon
                </span>
              )}
              {isActive && (
                <motion.div
                  layoutId="mode-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent-violet)]"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <main className="flex-1 px-4 py-6 overflow-y-auto">
        <AnimatePresence mode="wait">
          {mode === "music" && (
            <motion.div key="music" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22 }}>
              <MusicCreator
                token={token}
                credits={credits}
                onCreditsUpdate={onCreditsUpdate}
                onTopUp={() => setCreditsModalOpen(true)}
              />
            </motion.div>
          )}

          {mode === "novel" && (
            <motion.div key="novel" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22 }}>
              <ComingSoon
                icon="📖"
                title="Musik Novel"
                desc="Musikmu bakal jadi storyboard visual yang gokil. Setiap beat punya visual sendiri."
                teaser="Bikin musik dulu, lalu kita visualisasi ceritanya"
              />
            </motion.div>
          )}

          {mode === "video" && (
            <motion.div key="video" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22 }}>
              <ComingSoon
                icon="🎬"
                title="Musik Video"
                desc="Dari audio ke video sinematik penuh efek. Hasilnya bikin melongo."
                teaser="Music Novel harus ada dulu sebelum video dibuat"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <CreditsModal
        open={creditsModalOpen}
        credits={credits}
        token={token}
        onClose={() => setCreditsModalOpen(false)}
      />
    </div>
  );
}

function ComingSoon({ icon, title, desc, teaser }: { icon: string; title: string; desc: string; teaser: string }) {
  return (
    <div className="max-w-sm mx-auto text-center py-16 space-y-4">
      <div className="text-5xl float-anim">{icon}</div>
      <h3 className="heading-display text-xl text-[var(--text-primary)]">{title}</h3>
      <p className="text-sm text-[var(--text-muted)] leading-relaxed">{desc}</p>
      <div className="card-glass p-3 mt-4">
        <p className="text-xs text-[var(--text-faint)]">💡 {teaser}</p>
      </div>
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--accent-amber)]/30 bg-[var(--accent-amber)]/5 text-xs text-[var(--accent-amber)]">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-amber)] glow-pulse" />
        Segera Hadir
      </div>
    </div>
  );
}
