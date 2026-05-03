import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { apiFetch } from "../lib/api.ts";
import CreditsBadge from "./CreditsBadge.tsx";
import CreditsModal from "./CreditsModal.tsx";
import NewMemberModal from "./NewMemberModal.tsx";
import MusicCreator from "./music/MusicCreator.tsx";
import MusicHistory from "./music/MusicHistory.tsx";

type Mode = "music" | "history";

const NAV_MODES: {
  id: Mode;
  icon: string;
  label: string;
  desc: string;
  soon?: boolean;
  live?: boolean;
}[] = [
  { id: "music",   icon: "🎵", label: "Musik",   desc: "Buat lagu baru", live: true },
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
    const shown = sessionStorage.getItem("lm_welcome_shown");
    if (shown) return false;
    sessionStorage.setItem("lm_welcome_shown", "1");
    return true;
  });
  const [showPromoPopup, setShowPromoPopup] = useState(false);
  const [promoJoining, setPromoJoining] = useState(false);
  const [promoToast, setPromoToast] = useState<number | null>(null);

  useEffect(() => {
    const shown = sessionStorage.getItem("lm_promo_checked");
    if (shown) return;
    sessionStorage.setItem("lm_promo_checked", "1");
    apiFetch("/api/credits/promo-status", token)
      .then(r => r.json())
      .then((d: { redeemed?: boolean }) => { if (!d.redeemed) setShowPromoPopup(true); })
      .catch(() => {});
  }, [token]);

  async function handleJoinAndClaim() {
    if (promoJoining) return;
    window.open("https://chat.whatsapp.com/FJfjQ5OJsge1hhCgYkY9dP", "_blank");
    setPromoJoining(true);
    try {
      const res = await apiFetch("/api/credits/redeem-promo", token, {
        method: "POST",
        body: JSON.stringify({ code: "IMAJIEASY" }),
      });
      const data = await res.json() as { success?: boolean; creditsAdded?: number; credits?: number };
      if (data.success) {
        if (data.credits !== undefined) onCreditsUpdate(data.credits);
        if (data.creditsAdded) {
          setPromoToast(data.creditsAdded);
          setTimeout(() => setPromoToast(null), 6000);
        }
      }
    } catch { /* ignore */ } finally {
      setPromoJoining(false);
      setShowPromoPopup(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Rainbow top accent */}
      <div className="h-[2px] rainbow-line" />

      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] sticky top-0 z-20 bg-[var(--bg-primary)]/90 backdrop-blur-xl">
        <img src="/logo.png" alt="Lovemelodia" className="h-7 object-contain" style={{ mixBlendMode: "screen" }} />

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
          onClose={() => setNewMemberOpen(false)}
        />
      )}

      {/* Free credits popup — join WA group to claim */}
      <AnimatePresence>
        {showPromoPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center p-5"
            style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
            onClick={() => setShowPromoPopup(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 16 }}
              transition={{ type: "spring", damping: 18, stiffness: 260 }}
              onClick={e => e.stopPropagation()}
              className="relative w-full max-w-sm rounded-3xl overflow-hidden text-center"
              style={{
                background: "linear-gradient(160deg, #0f0e1c 0%, #07070f 100%)",
                border: "1px solid rgba(139,92,246,0.4)",
                boxShadow: "0 0 60px rgba(99,102,241,0.25)",
              }}
            >
              <div className="absolute top-0 left-0 right-0 h-px"
                style={{ background: "linear-gradient(90deg, transparent, rgba(139,92,246,0.8), transparent)" }} />
              <button
                onClick={() => setShowPromoPopup(false)}
                className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <div className="p-7 flex flex-col items-center gap-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
                  style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)" }}>
                  🎁
                </div>
                <div>
                  <p className="text-white font-black text-lg leading-snug">Coba Lovemelodia gratis!</p>
                  <p className="text-zinc-400 text-sm mt-1.5 leading-relaxed">
                    Gabung grup WhatsApp kami dan kami akan menambahkan <span className="text-violet-400 font-semibold">50 kredit gratis</span> ke akunmu.
                  </p>
                </div>
                <button
                  onClick={handleJoinAndClaim}
                  disabled={promoJoining}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm transition-opacity hover:opacity-90 disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg, #25D366, #128C7E)", color: "white" }}
                >
                  {promoJoining ? (
                    "Menambahkan kredit..."
                  ) : (
                    <>
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      Gabung & Dapatkan 50 Kredit
                    </>
                  )}
                </button>
                <p className="text-zinc-600 text-[10px]">Satu kali per akun.</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Credits toast */}
      <AnimatePresence>
        {promoToast !== null && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[400] flex items-center gap-3 rounded-2xl px-5 py-3.5 shadow-xl"
            style={{ background: "#1c1a17", border: "1px solid rgba(139,92,246,0.4)" }}
          >
            <span className="text-lg">🎉</span>
            <div>
              <p className="text-violet-300 font-bold text-sm leading-none">+{promoToast} kredit ditambahkan!</p>
              <p className="text-zinc-500 text-[10px] mt-0.5">Selamat berkreasi!</p>
            </div>
            <button onClick={() => setPromoToast(null)} className="ml-2 text-zinc-500 hover:text-white transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

