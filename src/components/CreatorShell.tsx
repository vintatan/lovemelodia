import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import CreditsBadge from "./CreditsBadge.tsx";
import CreditsModal from "./CreditsModal.tsx";
import NewMemberModal from "./NewMemberModal.tsx";
import MusicCreator from "./music/MusicCreator.tsx";
import MusicHistory from "./music/MusicHistory.tsx";
import NovelTab from "./music/NovelTab.tsx";

type Mode = "music" | "history" | "novel" | "video";

const MODES: { id: Mode; icon: string; label: string; soon?: boolean; live?: boolean }[] = [
  { id: "music",   icon: "🎵", label: "Musik" },
  { id: "history", icon: "🕓", label: "Riwayat" },
  { id: "novel",   icon: "📖", label: "Musik Novel", live: true },
  { id: "video",   icon: "🎬", label: "Musik Video", soon: true },
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
  const [newMemberOpen, setNewMemberOpen] = useState(() => {
    if (credits > 0) return false;
    const shown = sessionStorage.getItem("kreasi_welcome_shown");
    if (shown) return false;
    sessionStorage.setItem("kreasi_welcome_shown", "1");
    return true;
  });

  return (
    <div className="min-h-screen flex flex-col">
      {/* Rainbow top accent */}
      <div className="h-[2px] rainbow-line" />

      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] sticky top-0 z-20 bg-[var(--bg-primary)]/90 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-red flex items-center justify-center shadow-glow">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="white">
              <path d="M9 18V5l12-2v13M6 21a3 3 0 100-6 3 3 0 000 6zm12-2a3 3 0 100-6 3 3 0 000 6z"/>
            </svg>
          </div>
          <h1 className="heading-display text-sm text-gradient-studio">KREASI AI</h1>
        </div>
        <CreditsBadge credits={credits} onTopUp={() => setCreditsModalOpen(true)} />
      </header>

      {/* Mode tabs */}
      <div className="flex justify-center border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]/60 overflow-x-auto">
        {MODES.map(m => {
          const isActive = m.id === mode;
          return (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`relative flex-shrink-0 flex items-center justify-center gap-1.5 min-w-[72px] px-3 py-3.5 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "text-[var(--accent-red)]"
                  : "text-[var(--text-faint)] hover:text-[var(--text-muted)]"
              }`}
            >
              <span>{m.icon}</span>
              <span className="whitespace-nowrap">{m.label}</span>
              {m.live && (
                <span className="label-caps px-1.5 py-0.5 rounded-full text-[8px] font-bold" style={{ background: "rgba(245,158,11,0.18)", color: "#f59e0b" }}>
                  LIVE
                </span>
              )}
              {m.soon && (
                <span className="label-caps px-1.5 py-0.5 rounded-full bg-[var(--accent-amber)]/12 text-[var(--accent-amber)] text-[8px]">
                  Soon
                </span>
              )}
              {isActive && (
                <motion.div
                  layoutId="mode-indicator"
                  className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-red"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <main className="flex-1 px-4 sm:px-8 lg:px-12 py-6 overflow-y-auto">
        <AnimatePresence mode="wait">
          {mode === "music" && (
            <motion.div key="music" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}>
              <MusicCreator
                token={token}
                credits={credits}
                onCreditsUpdate={onCreditsUpdate}
                onTopUp={() => setCreditsModalOpen(true)}
              />
            </motion.div>
          )}

          {mode === "history" && (
            <motion.div key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}>
              <MusicHistory token={token} phone={phone} />
            </motion.div>
          )}

          {mode === "novel" && (
            <motion.div key="novel" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22 }}>
              <NovelTab
                token={token}
                credits={credits}
                onCreditsUpdate={onCreditsUpdate}
                onTopUp={() => setCreditsModalOpen(true)}
              />
            </motion.div>
          )}

          {mode === "video" && (
            <motion.div key="video" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22 }}>
              <ComingSoon icon="🎬" title="Musik Video" desc="Dari audio ke video sinematik penuh efek. Hasilnya bikin melongo." teaser="Music Novel harus ada dulu sebelum video dibuat" color="var(--accent-coral)" />
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

      {newMemberOpen && (
        <NewMemberModal
          token={token}
          onClose={() => setNewMemberOpen(false)}
          onPurchased={() => setNewMemberOpen(false)}
        />
      )}
    </div>
  );
}

function ComingSoon({ icon, title, desc, teaser, color }: {
  icon: string; title: string; desc: string; teaser: string; color: string;
}) {
  return (
    <div className="max-w-sm mx-auto text-center py-16 space-y-5">
      <div className="text-5xl float-anim">{icon}</div>
      <h3 className="heading-display text-xl text-[var(--text-primary)]">{title}</h3>
      <p className="text-sm text-[var(--text-muted)] leading-relaxed">{desc}</p>
      <div className="card-elevated p-3.5 mt-2">
        <p className="text-xs text-[var(--text-faint)]">💡 {teaser}</p>
      </div>
      <div
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-semibold label-caps"
        style={{ borderColor: `${color}30`, background: `${color}08`, color }}
      >
        <span className="w-1.5 h-1.5 rounded-full glow-pulse" style={{ background: color }} />
        Segera Hadir
      </div>
    </div>
  );
}
