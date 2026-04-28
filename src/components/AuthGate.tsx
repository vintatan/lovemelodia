import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Phone, KeyRound, ArrowRight } from "lucide-react";
import { Button, Input } from "./UI.tsx";

interface AuthGateProps {
  onAuth: (token: string, phone: string, credits: number) => void;
}

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
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-10 max-w-xs"
      >
        <div className="inline-flex items-center gap-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-full px-3 py-1.5 mb-4">
          <Sparkles className="w-3.5 h-3.5 text-[var(--accent-violet)]" />
          <span className="text-xs text-[var(--text-muted)]">AI Music Video Novel</span>
        </div>
        <h1 className="heading-display text-3xl mb-2">
          <span className="text-gradient">Kreasi AI</span>
        </h1>
        <p className="text-sm text-[var(--text-muted)]">
          Turn your character &amp; music vibe into a cinematic music video — photorealistic scenes, AI music, dramatic transitions.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="w-full max-w-xs card-glass p-5"
      >
        <AnimatePresence mode="wait">
          {step === "phone" ? (
            <motion.div key="phone" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-4">
              <div className="flex items-center gap-2 mb-1">
                <Phone className="w-4 h-4 text-[var(--accent-violet)]" />
                <span className="text-sm font-medium">Login with WhatsApp</span>
              </div>
              <Input
                label="WhatsApp Number"
                type="tel"
                placeholder="08123456789"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendOtp()}
              />
              {error && <p className="text-xs text-red-400">{error}</p>}
              <Button loading={loading} onClick={sendOtp} size="lg" className="w-full">
                Send OTP <ArrowRight className="w-4 h-4" />
              </Button>
              <p className="text-xs text-[var(--text-faint)] text-center">
                New users get <span className="text-[var(--accent-green)]">100 free credits</span>
              </p>
            </motion.div>
          ) : (
            <motion.div key="otp" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-4">
              <div className="flex items-center gap-2 mb-1">
                <KeyRound className="w-4 h-4 text-[var(--accent-violet)]" />
                <span className="text-sm font-medium">Enter OTP</span>
              </div>
              <p className="text-xs text-[var(--text-muted)]">Code sent to {phone} via WhatsApp</p>
              <Input
                label="6-digit code"
                type="number"
                placeholder="123456"
                value={otp}
                onChange={e => setOtp(e.target.value)}
                onKeyDown={e => e.key === "Enter" && verifyOtp()}
              />
              {error && <p className="text-xs text-red-400">{error}</p>}
              <Button loading={loading} onClick={verifyOtp} size="lg" className="w-full">
                Login <ArrowRight className="w-4 h-4" />
              </Button>
              <button onClick={() => setStep("phone")} className="text-xs text-[var(--text-faint)] hover:text-[var(--text-muted)] underline text-center">
                Use different number
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
