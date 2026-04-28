import { type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

// ── Button ─────────────────────────────────────────────────────────────────────

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "violet" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  children: ReactNode;
}

export function Button({ variant = "violet", size = "md", loading, children, disabled, className = "", ...props }: ButtonProps) {
  const base = "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed";
  const sizes = { sm: "px-3 py-1.5 text-sm", md: "px-4 py-2.5 text-sm", lg: "px-6 py-3 text-base" };
  const variants = {
    violet:  "bg-gradient-violet text-white shadow-glow hover:brightness-110 active:scale-95",
    outline: "border border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]",
    ghost:   "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]",
    danger:  "bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20",
  };
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}

// ── Spinner ────────────────────────────────────────────────────────────────────

export function Spinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const s = { sm: "w-4 h-4", md: "w-6 h-6", lg: "w-8 h-8" };
  return <Loader2 className={`${s[size]} animate-spin text-[var(--accent-violet)]`} />;
}

// ── Card ───────────────────────────────────────────────────────────────────────

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`card-glass p-4 ${className}`}>
      {children}
    </div>
  );
}

// ── Badge ──────────────────────────────────────────────────────────────────────

export function Badge({ children, color = "violet" }: { children: ReactNode; color?: "violet" | "green" | "amber" | "red" | "blue" }) {
  const colors = {
    violet: "bg-violet-500/10 text-violet-300 border border-violet-500/20",
    green:  "bg-green-500/10 text-green-300 border border-green-500/20",
    amber:  "bg-amber-500/10 text-amber-300 border border-amber-500/20",
    red:    "bg-red-500/10 text-red-300 border border-red-500/20",
    blue:   "bg-blue-500/10 text-blue-300 border border-blue-500/20",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[color]}`}>
      {children}
    </span>
  );
}

// ── Toast ──────────────────────────────────────────────────────────────────────

export function Toast({ message, type = "info" }: { message: string; type?: "info" | "error" | "success" }) {
  const colors = {
    info:    "bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-primary)]",
    error:   "bg-red-500/10 border-red-500/20 text-red-300",
    success: "bg-green-500/10 border-green-500/20 text-green-300",
  };
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 border px-4 py-3 rounded-xl text-sm shadow-glow-lg ${colors[type]}`}>
      {message}
    </div>
  );
}

// ── Input ──────────────────────────────────────────────────────────────────────

export function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  const { label, className = "", ...rest } = props;
  return (
    <label className="flex flex-col gap-1.5">
      {label && <span className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider">{label}</span>}
      <input
        {...rest}
        className={`w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-faint)] focus:outline-none focus:border-[var(--accent-violet)] transition-colors ${className}`}
      />
    </label>
  );
}

// ── Textarea ───────────────────────────────────────────────────────────────────

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  const { label, className = "", ...rest } = props;
  return (
    <label className="flex flex-col gap-1.5">
      {label && <span className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider">{label}</span>}
      <textarea
        {...rest}
        className={`w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-faint)] focus:outline-none focus:border-[var(--accent-violet)] transition-colors resize-none ${className}`}
      />
    </label>
  );
}

// ── Section heading ────────────────────────────────────────────────────────────

export function SectionHeading({ step, title, subtitle }: { step: number; title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col gap-1 mb-5">
      <span className="text-xs text-[var(--accent-violet)] font-medium uppercase tracking-widest">Step {step}</span>
      <h2 className="heading-display text-xl text-[var(--text-primary)]">{title}</h2>
      {subtitle && <p className="text-sm text-[var(--text-muted)]">{subtitle}</p>}
    </div>
  );
}
