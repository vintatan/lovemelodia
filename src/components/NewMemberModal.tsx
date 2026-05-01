import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { apiFetch } from "../lib/api.ts";

interface NewMemberModalProps {
  token: string;
  onClose: () => void;
  onPurchased: () => void;
}

export default function NewMemberModal({ token, onClose, onPurchased }: NewMemberModalProps) {
  const [loading, setLoading] = useState(false);

  async function handleGetStarter() {
    setLoading(true);
    try {
      const res = await apiFetch("/api/credits/purchase", token, {
        method: "POST",
        body: JSON.stringify({ packageName: "starter" }),
      });
      const data = await res.json() as { paymentUrl?: string; error?: string };
      if (data.paymentUrl) {
        window.open(data.paymentUrl, "_blank");
        onPurchased();
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        key="nm-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          key="nm-card"
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.97 }}
          transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
          className="w-full max-w-sm relative"
          onClick={e => e.stopPropagation()}
        >
          {/* Green glow */}
          <div
            className="absolute inset-0 rounded-2xl blur-xl opacity-40 pointer-events-none"
            style={{ background: "radial-gradient(circle at 50% 40%, #22c55e 0%, transparent 65%)" }}
          />

          <div
            className="relative rounded-2xl p-6 border"
            style={{
              background: "linear-gradient(135deg, #0d2818 0%, #0a1f12 100%)",
              borderColor: "rgba(34,197,94,0.35)",
              boxShadow: "0 0 40px rgba(34,197,94,0.15), 0 20px 60px rgba(0,0,0,0.5)",
            }}
          >
            {/* Confetti emoji */}
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.15, type: "spring", stiffness: 260, damping: 18 }}
              className="text-5xl text-center mb-4"
            >
              🎉
            </motion.div>

            <h2 className="text-xl font-bold text-center text-white mb-1">
              Selamat datang, kreator!
            </h2>
            <p className="text-sm text-center mb-5" style={{ color: "rgba(255,255,255,0.65)" }}>
              Akun lo udah aktif. Top up Starter buat mulai bikin musik AI pertama lo.
            </p>

            {/* Package highlight */}
            <div
              className="rounded-xl p-4 mb-5 flex items-center justify-between"
              style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)" }}
            >
              <div>
                <p className="text-sm font-semibold text-white">Starter Pack</p>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>20 credits · cukup buat 1 lagu AI</p>
              </div>
              <div className="text-right">
                <p className="text-xs line-through" style={{ color: "rgba(255,255,255,0.35)" }}>Rp 25.000</p>
                <p className="text-base font-bold" style={{ color: "#4ade80" }}>Rp 10.000</p>
              </div>
            </div>

            <button
              onClick={handleGetStarter}
              disabled={loading}
              className="w-full py-3.5 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-60"
              style={{
                background: loading ? "rgba(34,197,94,0.4)" : "linear-gradient(135deg, #22c55e, #16a34a)",
                color: "#fff",
                boxShadow: "0 4px 20px rgba(34,197,94,0.35)",
              }}
            >
              {loading ? "Memproses..." : "Mulai dengan Rp 10.000 →"}
            </button>

            <a
              href="https://chat.whatsapp.com/FJfjQ5OJsge1hhCgYkY9dP"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full mt-3 py-2.5 rounded-xl text-xs font-semibold transition-all hover:opacity-90"
              style={{ background: "rgba(37,211,102,0.12)", border: "1px solid rgba(37,211,102,0.25)", color: "#25d366" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Gabung Grup Kreasi AI
            </a>

            <button
              onClick={onClose}
              className="w-full mt-2 text-xs text-center transition-opacity hover:opacity-70"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              Nanti aja
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
