import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Zap, CreditCard } from "lucide-react";
import { apiFetch } from "../lib/api.ts";

interface Package {
  id: string;
  name: string;
  subtitle: string;
  price: string;
  badge?: string;
  badgeColor?: "violet" | "amber";
  highlight?: boolean;
}

const PACKAGES: Package[] = [
  { id: "starter",      name: "Starter",   subtitle: "5 gift card",                  price: "Rp15rb" },
  { id: "creator",      name: "Creator",   subtitle: "15 gift card · paling hemat",  price: "Rp35rb",      badge: "POPULER",  badgeColor: "violet", highlight: true },
  { id: "unlimited_mo", name: "Unlimited", subtitle: "30 gift/bulan",                price: "Rp75rb/bulan", badge: "TERBAIK",  badgeColor: "amber" },
];

interface CreditsModalProps {
  open: boolean;
  credits: number;
  token: string;
  onClose: () => void;
  onPurchased?: () => void;
}

export default function CreditsModal({ open, credits, token, onClose, onPurchased }: CreditsModalProps) {
  const [purchasing, setPurchasing] = useState(false);

  async function handlePurchase(pkg: Package) {
    if (purchasing) return;
    setPurchasing(true);
    try {
      const res = await apiFetch("/api/credits/purchase", token, {
        method: "POST",
        body: JSON.stringify({ packageName: pkg.id }),
      });
      const data = await res.json() as { paymentUrl?: string; externalId?: string; error?: string };
      if (data.paymentUrl) {
        if (data.externalId) sessionStorage.setItem("kreasi_pending_payment", data.externalId);
        window.location.href = data.paymentUrl;
      } else {
        alert(data.error ?? "Failed to create payment link");
      }
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setPurchasing(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            key="modal"
            initial={{ opacity: 0, y: 32, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
            className="fixed inset-x-4 bottom-4 sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 z-50 w-auto sm:w-full sm:max-w-sm"
          >
            <div className="card-glass p-5 shadow-glow-lg">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[var(--accent-violet)]" />
                  <span className="font-semibold text-sm">Top Up Credits</span>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="card-elevated p-3 flex items-center justify-between mb-4">
                <span className="text-xs text-[var(--text-muted)]">Sisa hadiah</span>
                <span className="text-sm font-semibold text-[var(--accent-violet)]">{credits} hadiah tersisa</span>
              </div>

              <div className="flex flex-col gap-2 mb-4">
                {PACKAGES.map(pkg => (
                  <button
                    key={pkg.id}
                    onClick={() => handlePurchase(pkg)}
                    disabled={purchasing}
                    className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed ${
                      pkg.highlight
                        ? "bg-violet-500/10 border-[var(--accent-violet)]/30 shadow-glow"
                        : "bg-[var(--bg-elevated)] border-[var(--border-subtle)] hover:border-[var(--border-accent)]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <CreditCard className={`w-4 h-4 ${pkg.highlight ? "text-[var(--accent-violet)]" : "text-[var(--text-muted)]"}`} />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-[var(--text-primary)]">{pkg.name}</p>
                          {pkg.badge && pkg.badgeColor === "violet" && (
                            <span className="text-[10px] font-bold text-violet-400 bg-violet-400/10 border border-violet-400/20 rounded px-1.5 py-0.5">{pkg.badge}</span>
                          )}
                          {pkg.badge && pkg.badgeColor === "amber" && (
                            <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded px-1.5 py-0.5">{pkg.badge}</span>
                          )}
                        </div>
                        <p className="text-xs text-[var(--text-muted)]">{pkg.subtitle}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${pkg.highlight ? "text-[var(--accent-violet)]" : "text-[var(--accent-red)]"}`}>
                        {pkg.price}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
