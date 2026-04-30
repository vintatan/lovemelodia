import { useRef } from "react";
import { motion } from "motion/react";

const YT_VIDEO_ID = "5gxn7Lho9yg";
const YT_CHANNEL   = "https://www.youtube.com/@ImajiAI-z8k";

interface LandingPageProps {
  onStart: () => void;
}

function FloatingOrb({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`absolute rounded-full pointer-events-none blur-3xl ${className}`}
      style={style}
    />
  );
}

function HowStep({ n, icon, title, desc }: { n: number; icon: string; title: string; desc: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: n * 0.15 }}
      className="flex flex-col items-center text-center gap-3"
    >
      <div className="relative">
        <div className="w-14 h-14 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center text-2xl shadow-glow">
          {icon}
        </div>
        <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-gradient-violet flex items-center justify-center text-white text-[10px] font-bold">
          {n}
        </div>
      </div>
      <div className="space-y-1">
        <p className="font-semibold text-[var(--text-primary)] text-sm">{title}</p>
        <p className="text-xs text-[var(--text-muted)] leading-relaxed max-w-[160px] mx-auto">{desc}</p>
      </div>
    </motion.div>
  );
}

export default function LandingPage({ onStart }: LandingPageProps) {
  const featuresRef = useRef<HTMLElement>(null);

  function scrollDown() {
    featuresRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="min-h-screen overflow-x-hidden">

      {/* ── Navbar ─────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 py-4 bg-[var(--bg-primary)]/80 backdrop-blur-xl border-b border-[var(--border-subtle)]">
        <span className="heading-display text-lg text-gradient-studio">KREASI AI</span>
        <button
          onClick={onStart}
          className="px-5 py-2 rounded-full bg-gradient-violet text-white text-sm font-semibold shadow-glow transition-transform active:scale-95"
        >
          Mulai Gratis →
        </button>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-5 pt-24 pb-16 text-center overflow-hidden">
        {/* Orbs */}
        <FloatingOrb className="w-96 h-96 float-anim" style={{ background: "rgba(139,92,246,0.18)", top: "10%", left: "50%", transform: "translateX(-50%)", animationDelay: "0s" }} />
        <FloatingOrb className="w-64 h-64" style={{ background: "rgba(236,72,153,0.12)", top: "20%", right: "-5%", animationDelay: "1s", animation: "float-y 5s ease-in-out infinite" }} />
        <FloatingOrb className="w-72 h-72" style={{ background: "rgba(34,211,238,0.08)", bottom: "15%", left: "-8%", animation: "float-y 6s ease-in-out infinite 2s" }} />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.25, 1, 0.5, 1] }}
          className="relative z-10 space-y-6 max-w-2xl"
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--accent-violet)]/30 bg-[var(--accent-violet)]/5 text-xs text-[var(--accent-violet)] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-violet)] glow-pulse" />
            Didukung Google Lyria AI ✦
          </div>

          {/* Headline */}
          <h1 className="heading-display leading-[1.05] text-[var(--text-primary)]" style={{ fontSize: "clamp(2.8rem, 8vw, 5rem)" }}>
            Bikin Musik{" "}
            <span className="text-gradient">Pake AI</span>
            <br />
            <span style={{ fontSize: "clamp(1.4rem, 4vw, 2.2rem)", fontWeight: 400, letterSpacing: "-0.01em" }} className="text-[var(--text-muted)]">
              Gak perlu studio. Gak perlu instrumen.
            </span>
          </h1>

          {/* Sub */}
          <p className="text-base text-[var(--text-muted)] max-w-lg mx-auto leading-relaxed">
            Tulis vibe lo, AI yang garap sisanya.{" "}
            <span className="text-[var(--text-primary)]">Hasilnya? Lagu beneran</span>{" "}
            dalam hitungan menit. Gas!
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={onStart}
              className="px-8 py-4 rounded-2xl bg-gradient-violet text-white font-bold text-base shadow-glow-lg transition-transform active:scale-95 hover:scale-[1.02]"
            >
              Gas Bikin Musik 🎵
            </button>
            <button
              onClick={scrollDown}
              className="px-6 py-4 rounded-2xl border border-[var(--border-subtle)] text-[var(--text-muted)] text-sm hover:text-[var(--text-primary)] hover:border-[var(--accent-violet)]/30 transition-all"
            >
              Lihat karya kami ↓
            </button>
          </div>

          {/* Social proof */}
          <p className="text-xs text-[var(--text-faint)]">
            ✓ Gratis 100 kredit · ✓ No kartu kredit · ✓ Langsung jadi
          </p>
        </motion.div>

        {/* Animated waveform decoration */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="relative z-10 flex items-end justify-center gap-0.5 mt-12 h-12"
        >
          {Array.from({ length: 60 }, (_, i) => (
            <div
              key={i}
              className="w-1 rounded-full waveform-bar opacity-40"
              style={{
                height: `${15 + Math.sin(i * 0.4) * 12 + Math.cos(i * 0.7) * 8}%`,
                background: `hsl(${260 + i * 3}, 70%, 65%)`,
                animationDelay: `${i * 0.04}s`,
              }}
            />
          ))}
        </motion.div>
      </section>

      {/* ── How it works ───────────────────────────────────────────── */}
      <section className="px-5 py-16 max-w-lg mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10 space-y-2"
        >
          <p className="text-xs text-[var(--accent-violet)] uppercase tracking-widest font-semibold">Gimana Caranya?</p>
          <h2 className="heading-display text-2xl text-[var(--text-primary)]">3 Langkah Doang 🔥</h2>
        </motion.div>
        <div className="grid grid-cols-3 gap-4">
          <HowStep n={1} icon="✍️" title="Tulis Vibe" desc="Deskripsiin mood, genre, atau nuansa yang lo mau" />
          <HowStep n={2} icon="🤖" title="AI Garap" desc="Google Lyria AI bikin musiknya dalam hitungan menit" />
          <HowStep n={3} icon="🚀" title="Gas Share" desc="Download & share ke mana aja lo mau" />
        </div>
      </section>

      {/* ── 3 Modes ────────────────────────────────────────────────── */}
      <section ref={featuresRef} className="px-5 py-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10 space-y-2 max-w-lg mx-auto"
        >
          <p className="text-xs text-[var(--accent-pink)] uppercase tracking-widest font-semibold">Fitur</p>
          <h2 className="heading-display text-2xl text-[var(--text-primary)]">Tiga Cara Berkreasi</h2>
          <p className="text-sm text-[var(--text-muted)]">Dari lagu doang sampai musik video penuh — semua bisa lo bikin</p>
        </motion.div>

        <div className="max-w-lg mx-auto space-y-4">
          {[
            {
              icon: "🎵",
              title: "Musik",
              desc: "Tulis vibenya, Lyria AI yang bikin lagunya. Dari pop sampe gamelan modern — semua bisa.",
              accent: "var(--accent-violet)",
              accentBg: "rgba(139,92,246,0.08)",
              active: true,
              cta: "Coba Sekarang",
            },
            {
              icon: "📖",
              title: "Musik Novel",
              desc: "Musikmu jadi storyboard visual. Setiap beat punya cerita visualnya sendiri yang gokil.",
              accent: "var(--accent-cyan)",
              accentBg: "rgba(34,211,238,0.08)",
              active: false,
            },
            {
              icon: "🎬",
              title: "Musik Video",
              desc: "Dari audio ke video sinematik AI. Nonton hasilnya bikin melongo — dijamin.",
              accent: "var(--accent-pink)",
              accentBg: "rgba(236,72,153,0.08)",
              active: false,
            },
          ].map((feat, i) => (
            <motion.div
              key={feat.title}
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12 }}
              className="card-glass p-5 flex gap-4 items-start"
              style={{ borderColor: feat.active ? `${feat.accent}33` : undefined }}
            >
              <div className="w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center text-2xl" style={{ background: feat.accentBg }}>
                {feat.icon}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-[var(--text-primary)]">{feat.title}</h3>
                  {feat.active ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: feat.accent }}>
                      LIVE
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--bg-elevated)] text-[var(--text-faint)]">
                      SEGERA HADIR
                    </span>
                  )}
                </div>
                <p className="text-sm text-[var(--text-muted)] leading-relaxed">{feat.desc}</p>
                {feat.active && feat.cta && (
                  <button onClick={onStart} className="text-xs font-semibold mt-2 transition-opacity" style={{ color: feat.accent }}>
                    {feat.cta} →
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── YouTube / Karya Terbaru ─────────────────────────────────── */}
      <section className="px-5 py-16 max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-8 space-y-2"
        >
          <p className="text-xs text-[var(--accent-amber)] uppercase tracking-widest font-semibold">Karya Terbaru</p>
          <h2 className="heading-display text-2xl text-[var(--text-primary)]">Ini yang Udah Dibikin ✨</h2>
          <p className="text-sm text-[var(--text-muted)]">Bukti nyata AI bisa bikin musik yang beneran bagus</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="card-glass overflow-hidden"
        >
          {/* YouTube embed */}
          <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
            <iframe
              src={`https://www.youtube.com/embed/${YT_VIDEO_ID}?rel=0&modestbranding=1`}
              title="Kreasi AI — Karya Terbaru"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
              className="absolute inset-0 w-full h-full"
            />
          </div>

          {/* Channel link */}
          <div className="p-4 flex items-center justify-between border-t border-[var(--border-subtle)]">
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Imaji AI</p>
              <p className="text-xs text-[var(--text-muted)]">Musik AI original Indonesia</p>
            </div>
            <a
              href={YT_CHANNEL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105 active:scale-95"
              style={{ background: "rgba(255,0,0,0.15)", color: "#ff4444" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21.582 7.2s-.21-1.47-.85-2.12c-.81-.85-1.72-.85-2.13-.9C15.97 4 12 4 12 4s-3.97 0-6.6.18c-.41.05-1.32.05-2.13.9-.64.65-.85 2.12-.85 2.12S2.2 8.9 2.2 10.6v1.6c0 1.7.22 3.4.22 3.4s.21 1.47.85 2.12c.81.85 1.88.82 2.35.91C7 18.8 12 18.8 12 18.8s3.97 0 6.6-.18c.41-.05 1.32-.06 2.13-.91.64-.65.85-2.12.85-2.12s.22-1.7.22-3.4v-1.6c0-1.7-.22-3.4-.22-3.4zM9.74 14.85V8.66l5.76 3.1-5.76 3.09z"/>
              </svg>
              Tonton Lebih Banyak
            </a>
          </div>
        </motion.div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────────── */}
      <section className="px-5 py-20 text-center relative overflow-hidden">
        <FloatingOrb className="w-80 h-80 float-anim" style={{ background: "rgba(139,92,246,0.15)", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }} />
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative z-10 space-y-6 max-w-sm mx-auto"
        >
          <div className="text-5xl">🎵</div>
          <h2 className="heading-display text-3xl text-[var(--text-primary)]">
            Siap{" "}
            <span className="text-gradient">Gas</span>
            {" "}Bikin Musik?
          </h2>
          <p className="text-sm text-[var(--text-muted)]">
            Daftar gratis, dapat 100 kredit langsung. <br />
            Gak perlu kartu kredit, gak perlu pengalaman musik.
          </p>
          <button
            onClick={onStart}
            className="w-full py-4 rounded-2xl bg-gradient-brand text-white font-bold text-base shadow-glow-lg transition-transform hover:scale-[1.02] active:scale-95"
          >
            Mulai Gratis Sekarang 🚀
          </button>
          <p className="text-xs text-[var(--text-faint)]">Daftar via WhatsApp · Langsung bisa pakai</p>
        </motion.div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="border-t border-[var(--border-subtle)] px-5 py-8 text-center space-y-3">
        <p className="heading-display text-sm text-gradient-studio">KREASI AI</p>
        <p className="text-xs text-[var(--text-faint)]">by Imaji AI · UEN 202615181W · Dibuat dengan ❤️ di Indonesia</p>
        <div className="flex items-center justify-center gap-4 text-xs text-[var(--text-faint)]">
          <a href={YT_CHANNEL} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--text-muted)] transition-colors">YouTube</a>
          <span>·</span>
          <span className="opacity-40 cursor-not-allowed">Spotify (soon)</span>
          <span>·</span>
          <span className="opacity-40 cursor-not-allowed">TikTok (soon)</span>
        </div>
        <p className="text-xs text-[var(--text-faint)]">© 2025 Imaji AI. All rights reserved.</p>
      </footer>
    </div>
  );
}
