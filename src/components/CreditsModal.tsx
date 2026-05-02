import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Zap, CreditCard, Gift } from "lucide-react";
import { apiFetch } from "../lib/api.ts";

interface Package {
  name: string;
  credits: number;
  price: string;
  priceSgd?: string;
  originalPrice?: string;
  highlight?: boolean;
}

const PACKAGES: Package[] = [
  { name: "Starter", credits: 20,  price: "Rp 10.000",  priceSgd: "SGD 1",  originalPrice: "Rp 25.000" },
  { name: "Creator", credits: 50,  price: "Rp 55.000",  priceSgd: "SGD 6",  highlight: true },
  { name: "Studio",  credits: 120, price: "Rp 115.000", priceSgd: "SGD 12" },
];

const CREDIT_COSTS: Array<{ action: string; cost: string }> = [
  { action: "Musik AI (solo)",              cost: "20 credits" },
  { action: "Video Musik — Stage 3 only",   cost: "30 credits" },
  { action: "Stage 1 & 2 (storyboard)",     cost: "Gratis" },
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
        body: JSON.stringify({ packageName: pkg.name.toLowerCase() }),
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
                <span className="text-xs text-[var(--text-muted)]">Current balance</span>
                <span className="text-sm font-semibold text-[var(--accent-violet)]">{credits} credits</span>
              </div>

              <div className="flex flex-col gap-2 mb-4">
                {PACKAGES.map(pkg => (
                  <button
                    key={pkg.name}
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
                          {pkg.originalPrice && (
                            <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded px-1.5 py-0.5">PROMO</span>
                          )}
                          {pkg.highlight && !pkg.originalPrice && (
                            <span className="text-[10px] font-bold text-violet-400 bg-violet-400/10 border border-violet-400/20 rounded px-1.5 py-0.5">BEST VALUE</span>
                          )}
                        </div>
                        <p className="text-xs text-[var(--text-muted)]">{pkg.credits} credits</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {pkg.originalPrice && (
                        <p className="text-xs line-through text-[var(--text-faint)]">{pkg.originalPrice}</p>
                      )}
                      <p className={`text-sm font-semibold ${pkg.highlight ? "text-[var(--accent-violet)]" : "text-[var(--accent-red)]"}`}>
                        {pkg.price}
                      </p>
                      {pkg.priceSgd && <p className="text-[10px] text-[var(--text-faint)]">{pkg.priceSgd}</p>}
                    </div>
                  </button>
                ))}
              </div>

              <div className="border-t border-[var(--border-subtle)] pt-4">
                <p className="text-xs text-[var(--text-faint)] flex items-center gap-1.5 mb-2">
                  <Gift className="w-3.5 h-3.5" /> What costs what
                </p>
                <div className="flex flex-col gap-1.5">
                  {CREDIT_COSTS.map(c => (
                    <div key={c.action} className="flex justify-between text-xs">
                      <span className="text-[var(--text-faint)]">{c.action}</span>
                      <span className={`font-mono ${c.cost === "Gratis" ? "text-[var(--accent-green)]" : "text-[var(--text-muted)]"}`}>
                        {c.cost}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <a
                href="https://chat.whatsapp.com/FJfjQ5OJsge1hhCgYkY9dP"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full mt-1 py-2.5 rounded-xl text-xs font-semibold transition-all hover:opacity-90"
                style={{ background: "rgba(37,211,102,0.08)", border: "1px solid rgba(37,211,102,0.2)", color: "#25d366" }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Gabung Grup Kreasi AI
              </a>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
