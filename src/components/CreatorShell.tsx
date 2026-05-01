import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import CreditsBadge from "./CreditsBadge.tsx";
import CreditsModal from "./CreditsModal.tsx";
import NewMemberModal from "./NewMemberModal.tsx";
import MusicCreator from "./music/MusicCreator.tsx";
import MusicHistory from "./music/MusicHistory.tsx";
import NovelTab from "./music/NovelTab.tsx";
import AlbumCreator from "./music/AlbumCreator.tsx";

type Mode = "music" | "history" | "novel" | "album" | "video";

const NAV_MODES: {
  id: Mode;
  icon: string;
  label: string;
  desc: string;
  soon?: boolean;
  live?: boolean;
}[] = [
  { id: "music",   icon: "🎵", label: "Musik",        desc: "Buat lagu baru" },
  { id: "novel",   icon: "📖", label: "Musik Novel",  desc: "Audio + visual", live: true },
  { id: "album",   icon: "💿", label: "Album",        desc: "Paket 5–10 lagu", live: true },
  { id: "video",   icon: "🎬", label: "Musik Video",  desc: "Video sinematik", soon: true },
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
        <img src="/logo.png" alt="Kreasi AI" className="h-7 object-contain" style={{ mixBlendMode: "screen" }} />

        <div className="flex items-center gap-2">
          {/* History button in navbar */}
          <button
            onClick={() => setMode("history")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
              mode === "history"
                ? "bg-[var(--accent-red)]/10 text-[var(--accent-red)] border border-[var(--accent-red)]/20"
                : "text-[var(--text-faint)] hover:text-[var(--text-muted)] border border-transparent"
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            <span className="hidden sm:inline">Riwayat</span>
          </button>

          <CreditsBadge credits={credits} onTopUp={() => setCreditsModalOpen(true)} />
        </div>
      </header>

      {/* Body: sidebar + content */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── DESKTOP SIDEBAR ── */}
        <aside className="hidden sm:flex flex-col w-52 flex-shrink-0 border-r border-[var(--border-subtle)] bg-[var(--bg-primary)]/60 sticky top-[calc(2px+49px)] self-start h-[calc(100vh-51px)] overflow-y-auto py-4 px-2 gap-1">
          {NAV_MODES.map(m => {
            const isActive = mode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`relative w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all duration-200 group ${
                  isActive
                    ? "bg-[var(--accent-red)]/8 text-[var(--text-primary)]"
                    : "text-[var(--text-faint)] hover:text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]"
                } ${m.soon ? "opacity-50 cursor-not-allowed" : ""}`}
                disabled={m.soon}
              >
                {/* Active left bar */}
                {isActive && (
                  <motion.div
                    layoutId="sidebar-indicator"
                    className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-gradient-red"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}

                {/* Icon bubble */}
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0 transition-all duration-200 ${
                    isActive ? "shadow-glow" : ""
                  }`}
                  style={{
                    background: isActive
                      ? "linear-gradient(135deg, rgba(255,45,85,0.2), rgba(255,107,53,0.15))"
                      : "rgba(255,255,255,0.04)",
                  }}
                >
                  {m.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-sm font-semibold leading-none ${isActive ? "text-[var(--text-primary)]" : ""}`}>
                      {m.label}
                    </span>
                    {m.live && (
                      <span className="text-[8px] font-bold px-1 py-0.5 rounded-full leading-none" style={{ background: "rgba(245,158,11,0.18)", color: "#f59e0b" }}>
                        LIVE
                      </span>
                    )}
                    {m.soon && (
                      <span className="text-[8px] font-bold px-1 py-0.5 rounded-full leading-none" style={{ background: "rgba(255,159,10,0.12)", color: "var(--accent-amber)" }}>
                        Soon
                      </span>
                    )}
                  </div>
                  <p className={`text-[11px] mt-0.5 leading-none ${isActive ? "text-[var(--text-muted)]" : "text-[var(--text-faint)]"}`}>
                    {m.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </aside>

        {/* ── MAIN CONTENT ── */}
        <main className="flex-1 overflow-y-auto pb-20 sm:pb-6">
          <div className="px-4 sm:px-8 lg:px-12 py-6">
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

              {mode === "album" && (
                <motion.div key="album" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22 }}>
                  <AlbumCreator
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
          </div>
        </main>
      </div>

      {/* ── MOBILE BOTTOM NAV ── */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-20 bg-[var(--bg-primary)]/95 backdrop-blur-xl border-t border-[var(--border-subtle)] flex">
        {NAV_MODES.map(m => {
          const isActive = mode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => !m.soon && setMode(m.id)}
              disabled={m.soon}
              className={`relative flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-all duration-200 ${
                isActive ? "text-[var(--accent-red)]" : "text-[var(--text-faint)]"
              } ${m.soon ? "opacity-40" : ""}`}
            >
              {isActive && (
                <motion.div
                  layoutId="bottom-nav-indicator"
                  className="absolute top-0 left-2 right-2 h-[2px] rounded-full bg-gradient-red"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <span className="text-xl leading-none">{m.icon}</span>
              <span className="text-[9px] font-semibold leading-none tracking-wide">{m.label}</span>
              {m.live && (
                <span className="absolute top-1.5 right-[calc(50%-18px)] text-[7px] font-bold px-0.5 rounded leading-none" style={{ color: "#f59e0b" }}>
                  ●
                </span>
              )}
            </button>
          );
        })}
      </nav>

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
