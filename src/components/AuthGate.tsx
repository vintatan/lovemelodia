import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Phone, KeyRound, ArrowRight, Film, Music, Clapperboard } from "lucide-react";
import { Button, Input } from "./UI.tsx";

interface AuthGateProps {
  onAuth: (token: string, phone: string, credits: number) => void;
}

const FEATURE_PILLS = [
  { icon: Clapperboard, label: "6–8 cinematic scenes" },
  { icon: Music,        label: "AI-generated score" },
  { icon: Film,         label: "Ken Burns + xfade" },
];

export default function AuthGate({ onAuth }: AuthGateProps) {
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function sendOtp() {
    if (!phone.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!data.success) throw new Error(data.error ?? "Failed to send OTP");
      setStep("otp");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    if (!otp.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp }),
      });
      const data = await res.json() as { success?: boolean; token?: string; phone?: string; credits?: number; error?: string };
      if (!data.success || !data.token) throw new Error(data.error ?? "Invalid OTP");
      onAuth(data.token, data.phone!, data.credits ?? 100);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Background ambient blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute -top-32 -left-32 w-80 h-80 rounded-full bg-violet-600/8 blur-3xl"
          animate={{ scale: [1, 1.15, 1], x: [0, 20, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-pink-600/6 blur-3xl"
          animate={{ scale: [1, 1.2, 1], x: [0, -20, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 3 }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-indigo-500/5 blur-3xl"
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
        />
      </div>

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.25, 1, 0.5, 1] }}
        className="text-center mb-10 max-w-sm relative"
      >
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="inline-flex items-center gap-2 bg-[var(--bg-elevated)] border border-[var(--border-accent)] rounded-full px-3 py-1.5 mb-5"
        >
          <Sparkles className="w-3.5 h-3.5 text-[var(--accent-violet)]" />
          <span className="text-xs text-[var(--text-muted)]">AI Music Video Novel</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="heading-display text-4xl mb-3"
        >
          <span className="text-gradient">Kreasi AI</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="text-sm text-[var(--text-muted)] leading-relaxed mb-6"
        >
          Turn your character &amp; music vibe into a cinematic music video —<br className="hidden sm:block" />
          photorealistic scenes, AI-composed score, dramatic transitions.
        </motion.p>

        {/* Feature pills */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="flex flex-wrap justify-center gap-2"
        >
          {FEATURE_PILLS.map((f, i) => (
            <motion.div
              key={f.label}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 + i * 0.08 }}
              className="flex items-center gap-1.5 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-full px-3 py-1 text-xs text-[var(--text-muted)]"
            >
              <f.icon className="w-3 h-3 text-[var(--accent-violet)]" />
              {f.label}
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      {/* Auth card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
        className="w-full max-w-xs card-glass p-5 shadow-glow"
      >
        <AnimatePresence mode="wait">
          {step === "phone" ? (
            <motion.div key="phone" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }} className="flex flex-col gap-4">
              <div className="flex items-center gap-2 mb-1">
                <Phone className="w-4 h-4 text-[var(--accent-violet)]" />
                <span className="text-sm font-semibold">Login with WhatsApp</span>
              </div>
              <Input
                label="WhatsApp Number"
                type="tel"
                placeholder="08123456789"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendOtp()}
              />
              {error && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-red-400">
                  {error}
                </motion.p>
              )}
              <Button loading={loading} onClick={sendOtp} size="lg" className="w-full">
                Send OTP <ArrowRight className="w-4 h-4" />
              </Button>
              <p className="text-xs text-[var(--text-faint)] text-center">
                New users get <span className="text-[var(--accent-green)] font-medium">100 free credits</span>
              </p>
            </motion.div>
          ) : (
            <motion.div key="otp" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }} className="flex flex-col gap-4">
              <div className="flex items-center gap-2 mb-1">
                <KeyRound className="w-4 h-4 text-[var(--accent-violet)]" />
                <span className="text-sm font-semibold">Enter OTP</span>
              </div>
              <p className="text-xs text-[var(--text-muted)]">Code sent to <span className="text-[var(--text-primary)]">{phone}</span> via WhatsApp</p>
              <Input
                label="6-digit code"
                type="number"
                placeholder="123456"
                value={otp}
                onChange={e => setOtp(e.target.value)}
                onKeyDown={e => e.key === "Enter" && verifyOtp()}
              />
              {error && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-red-400">
                  {error}
                </motion.p>
              )}
              <Button loading={loading} onClick={verifyOtp} size="lg" className="w-full">
                Login <ArrowRight className="w-4 h-4" />
              </Button>
              <button onClick={() => setStep("phone")} className="text-xs text-[var(--text-faint)] hover:text-[var(--text-muted)] underline text-center transition-colors">
                Use different number
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
