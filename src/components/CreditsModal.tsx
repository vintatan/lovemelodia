import { motion, AnimatePresence } from "motion/react";
import { X, Zap, CreditCard, Gift } from "lucide-react";
import { Button } from "./UI.tsx";

interface Package {
  name: string;
  credits: number;
  price: string;
  highlight?: boolean;
}

const PACKAGES: Package[] = [
  { name: "Starter",    credits: 200,  price: "Rp 20.000" },
  { name: "Creator",    credits: 500,  price: "Rp 45.000", highlight: true },
  { name: "Studio",     credits: 1200, price: "Rp 99.000" },
];

const CREDIT_COSTS = [
  { action: "Stage 1 — Enhance prompt + timeline", cost: "5 credits" },
  { action: "Stage 2 — Per storyboard frame",      cost: "5 credits" },
  { action: "Stage 3 — Music + video assembly",    cost: "30 credits" },
  { action: "New user bonus",                       cost: "+100 free" },
];

interface CreditsModalProps {
  open: boolean;
  credits: number;
  token: string;
  onClose: () => void;
  onPurchased?: () => void;
}

export default function CreditsModal({ open, credits, token, onClose, onPurchased }: CreditsModalProps) {
  async function handlePurchase(pkg: Package) {
    try {
      const res = await fetch("/api/credits/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ packageName: pkg.name.toLowerCase(), amount: pkg.credits }),
      });
      const data = await res.json() as { paymentUrl?: string; error?: string };
      if (data.paymentUrl) {
        window.open(data.paymentUrl, "_blank");
        onPurchased?.();
      } else {
        alert(data.error ?? "Failed to create payment link");
      }
    } catch {
      alert("Network error. Please try again.");
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, y: 32, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
            className="fixed inset-x-4 bottom-4 sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 z-50 w-auto sm:w-full sm:max-w-sm"
          >
            <div className="card-glass p-5 shadow-glow-lg">
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[var(--accent-violet)]" />
                  <span className="font-semibold text-sm">Top Up Credits</span>
                </div>
                <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors">
                  <X className="w-4 h-4 text-[var(--text-muted)]" />
                </button>
              </div>

              {/* Current balance */}
              <div className="card-elevated p-3 flex items-center justify-between mb-4">
                <span className="text-xs text-[var(--text-muted)]">Current balance</span>
                <span className="text-sm font-semibold text-[var(--accent-violet)]">{credits} credits</span>
              </div>

              {/* Packages */}
              <div className="flex flex-col gap-2 mb-4">
                {PACKAGES.map(pkg => (
                  <button
                    key={pkg.name}
                    onClick={() => handlePurchase(pkg)}
                    className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all hover:brightness-110 active:scale-98 ${
                      pkg.highlight
                        ? "bg-violet-500/10 border-[var(--accent-violet)]/30 shadow-glow"
                        : "bg-[var(--bg-elevated)] border-[var(--border-subtle)] hover:border-[var(--border-accent)]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <CreditCard className={`w-4 h-4 ${pkg.highlight ? "text-[var(--accent-violet)]" : "text-[var(--text-muted)]"}`} />
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">{pkg.name}</p>
                        <p className="text-xs text-[var(--text-muted)]">{pkg.credits} credits</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${pkg.highlight ? "text-[var(--accent-violet)]" : "text-[var(--text-primary)]"}`}>
                        {pkg.price}
                      </p>
                      {pkg.highlight && <p className="text-xs text-[var(--accent-violet)]/70">Best value</p>}
                    </div>
                  </button>
                ))}
              </div>

              {/* Credit costs reference */}
              <div className="border-t border-[var(--border-subtle)] pt-4">
                <p className="text-xs text-[var(--text-faint)] flex items-center gap-1.5 mb-2">
                  <Gift className="w-3.5 h-3.5" /> What costs what
                </p>
                <div className="flex flex-col gap-1.5">
                  {CREDIT_COSTS.map(c => (
                    <div key={c.action} className="flex justify-between text-xs">
                      <span className="text-[var(--text-faint)]">{c.action}</span>
                      <span className={`font-mono ${c.cost.startsWith("+") ? "text-[var(--accent-green)]" : "text-[var(--text-muted)]"}`}>{c.cost}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
