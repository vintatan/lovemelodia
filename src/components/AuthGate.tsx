import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

interface AuthGateProps {
  onAuth: (token: string, phone: string, credits: number) => void;
  onBack?: () => void;
}

async function callAuth(url: string, body: object): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export default function AuthGate({ onAuth, onBack }: AuthGateProps) {
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function withLoading(fn: () => Promise<void>) {
    setLoading(true);
    setError("");
    try { await fn(); }
    catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function sendOtp() {
    if (!phone.trim()) return;
    withLoading(async () => {
      const res = await callAuth("/api/auth/send-otp", { phone });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!data.success) throw new Error(data.error ?? "Gagal kirim OTP");
      setStep("otp");
    });
  }

  async function verifyOtp() {
    if (!otp.trim()) return;
    withLoading(async () => {
      const res = await callAuth("/api/auth/verify-otp", { phone, otp });
      const data = await res.json() as { success?: boolean; token?: string; phone?: string; credits?: number; error?: string };
      if (!data.success || !data.token) throw new Error(data.error ?? "Kode OTP salah");
      onAuth(data.token, data.phone!, data.credits ?? 100);
    });
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-12 relative overflow-hidden">

      {/* Grid overlay */}
      <div className="auth-grid-overlay" />
      {/* Radial vignette */}
      <div className="auth-vignette" />

      {/* Aurora fire orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute rounded-full blur-3xl"
          style={{
            width: 520, height: 520,
            top: "-15%", left: "50%", transform: "translateX(-50%)",
            background: "radial-gradient(circle at 40% 40%, rgba(255,45,85,0.18) 0%, rgba(220,38,38,0.08) 45%, transparent 70%)",
            animation: "float-y 8s ease-in-out infinite",
          }}
        />
        <div
          className="absolute rounded-full blur-3xl"
          style={{
            width: 340, height: 340,
            bottom: "5%", right: "-8%",
            background: "radial-gradient(circle, rgba(251,146,60,0.12) 0%, transparent 65%)",
            animation: "float-y 6s ease-in-out infinite 2s",
          }}
        />
        <div
          className="absolute rounded-full blur-3xl"
          style={{
            width: 260, height: 260,
            top: "35%", left: "-6%",
            background: "radial-gradient(circle, rgba(220,38,38,0.1) 0%, transparent 65%)",
            animation: "float-y 10s ease-in-out infinite 1s",
          }}
        />
      </div>

      {/* Back button */}
      {onBack && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={onBack}
          className="absolute top-6 left-5 z-20 flex items-center gap-1.5 text-sm text-[var(--text-faint)] hover:text-[var(--text-muted)] transition-colors"
        >
          ← Kembali
        </motion.button>
      )}

      {/* Logo + headline */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.25, 1, 0.5, 1] }}
        className="text-center mb-8 max-w-xs relative z-10"
      >
        {/* Floating music icon — jiwa-ai style */}
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 4, ease: "easeInOut", repeat: Infinity }}
          className="inline-flex items-center justify-center w-16 h-16 rounded-3xl mb-5 shadow-glow-lg"
          style={{
            background: "linear-gradient(135deg, #ff2d55, #dc2626)",
            boxShadow: "0 0 40px rgba(255,45,85,0.45), 0 0 80px rgba(220,38,38,0.2)",
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
            <path d="M9 18V5l12-2v13M6 21a3 3 0 100-6 3 3 0 000 6zm12-2a3 3 0 100-6 3 3 0 000 6z"/>
          </svg>
        </motion.div>

        <div className="flex items-center justify-center gap-2 mb-4">
          <span className="heading-display text-xl text-gradient-studio">KREASI AI</span>
        </div>

        <h1
          className="heading-display text-[var(--text-primary)] mb-3"
          style={{ fontSize: "clamp(1.9rem, 7vw, 2.6rem)", letterSpacing: "-0.04em" }}
        >
          Masuk &amp;<br />Mulai Bikin
        </h1>
        <p className="text-sm text-[var(--text-muted)] leading-relaxed">
          Login via WhatsApp · Dapat{" "}
          <span className="font-bold" style={{ color: "var(--accent-green)" }}>100 kredit gratis</span>
          {" "}langsung
        </p>
      </motion.div>

      {/* Gradient-border auth card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
        className="card-gradient-border w-full max-w-xs relative z-10"
      >
        <div className="card-gradient-border-inner p-6">
          <AnimatePresence mode="wait">
            {step === "phone" ? (
              <motion.div key="phone" initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 14 }} transition={{ duration: 0.22 }} className="space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--accent-red)" }}>
                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.19 19.79 19.79 0 01.01 4.59 2 2 0 012 2.41h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
                  </svg>
                  <span className="text-sm font-semibold text-[var(--text-primary)]">Nomor WhatsApp</span>
                </div>
                <input
                  type="tel"
                  placeholder="08123456789"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendOtp()}
                  className="w-full card-elevated px-4 py-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-faint)] focus:outline-none transition-colors"
                  style={{ borderRadius: "0.75rem" }}
                  onFocus={e => (e.target.style.borderColor = "rgba(255,45,85,0.4)")}
                  onBlur={e => (e.target.style.borderColor = "")}
                />
                {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-red-400">{error}</motion.p>}
                <button
                  onClick={sendOtp}
                  disabled={loading || !phone.trim()}
                  className="btn-primary w-full rounded-xl py-3 text-sm"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Kirim OTP...
                    </span>
                  ) : "Kirim OTP via WhatsApp →"}
                </button>
              </motion.div>
            ) : (
              <motion.div key="otp" initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -14 }} transition={{ duration: 0.22 }} className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--accent-red)" }}>
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0110 0v4"/>
                    </svg>
                    <span className="text-sm font-semibold text-[var(--text-primary)]">Kode OTP</span>
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">
                    Kode dikirim ke <span className="font-medium text-[var(--text-primary)]">{phone}</span> via WhatsApp
                  </p>
                </div>
                <input
                  type="number"
                  placeholder="123456"
                  value={otp}
                  onChange={e => setOtp(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && verifyOtp()}
                  className="w-full card-elevated px-4 py-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-faint)] focus:outline-none transition-colors"
                  style={{ borderRadius: "0.75rem" }}
                  onFocus={e => (e.target.style.borderColor = "rgba(255,45,85,0.4)")}
                  onBlur={e => (e.target.style.borderColor = "")}
                />
                {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-red-400">{error}</motion.p>}
                <button
                  onClick={verifyOtp}
                  disabled={loading || !otp.trim()}
                  className="btn-primary w-full rounded-xl py-3 text-sm"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Verifikasi...
                    </span>
                  ) : "Masuk →"}
                </button>
                <button onClick={() => setStep("phone")} className="w-full text-xs text-[var(--text-faint)] hover:text-[var(--text-muted)] transition-colors text-center">
                  ← Ganti nomor
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-xs text-[var(--text-faint)] mt-5 text-center relative z-10"
      >
        Dengan masuk, lo setuju sama syarat &amp; ketentuan kami
      </motion.p>
    </div>
  );
}
