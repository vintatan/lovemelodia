import { useRef } from "react";
import { motion } from "motion/react";

const YT_VIDEO_ID = "5gxn7Lho9yg";
const YT_CHANNEL   = "https://www.youtube.com/@ImajiAI-z8k";

interface LandingPageProps {
  onStart: () => void;
}

function FloatingOrb({ style }: { style?: React.CSSProperties }) {
  return <div className="absolute rounded-full pointer-events-none blur-3xl" style={style} />;
}

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.55, delay, ease: [0.25, 1, 0.5, 1] as const },
});

/* Noise Indonesia — curved arc mark approximating their actual logo */
function NoiseIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Left curved arc */}
      <path
        d="M 28 72 C 28 72 14 58 14 50 C 14 42 28 28 28 28 L 40 28 C 40 28 24 42 24 50 C 24 58 40 72 40 72 Z"
        fill="#1a1a1a"
      />
      {/* Right curved arc */}
      <path
        d="M 52 72 C 52 72 72 58 72 50 C 72 42 52 28 52 28 L 64 28 C 64 28 86 42 86 50 C 86 58 64 72 64 72 Z"
        fill="#1a1a1a"
      />
    </svg>
  );
}

export default function LandingPage({ onStart }: LandingPageProps) {
  const featuresRef = useRef<HTMLElement>(null);

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: "var(--bg-primary)" }}>

      {/* ── Navbar ─────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]/80 backdrop-blur-xl">
        <div className="h-[2px] rainbow-line" />
        <div className="flex items-center justify-between px-5 sm:px-8 lg:px-12 py-3.5 max-w-7xl mx-auto">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-red flex items-center justify-center shadow-glow">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                <path d="M9 18V5l12-2v13M6 21a3 3 0 100-6 3 3 0 000 6zm12-2a3 3 0 100-6 3 3 0 000 6z"/>
              </svg>
            </div>
            <span className="heading-display text-base text-gradient-studio">KREASI AI</span>
          </div>
          <button onClick={onStart} className="btn-primary py-2 px-5 text-sm rounded-xl">
            Mulai Gratis →
          </button>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-5 sm:px-8 pt-24 pb-16 text-center overflow-hidden">
        <FloatingOrb style={{ width: 700, height: 700, top: 0, left: "50%", transform: "translateX(-50%)", background: "radial-gradient(circle at 50% 30%, rgba(255,45,85,0.13) 0%, transparent 65%)", animation: "float-y 7s ease-in-out infinite" }} />
        <FloatingOrb style={{ width: 400, height: 400, top: "25%", right: "-8%", background: "radial-gradient(circle, rgba(251,146,60,0.1) 0%, transparent 70%)", animation: "float-y 9s ease-in-out infinite 2s" }} />
        <FloatingOrb style={{ width: 300, height: 300, bottom: "18%", left: "-5%", background: "radial-gradient(circle, rgba(220,38,38,0.09) 0%, transparent 70%)", animation: "float-y 6s ease-in-out infinite 1s" }} />

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 w-full max-w-4xl"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.1, ease: [0.34, 1.56, 0.64, 1] }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--accent-red)]/30 bg-[var(--accent-red)]/5 text-xs font-semibold label-caps mb-6"
            style={{ color: "var(--accent-coral)" }}
          >
            <span className="w-1.5 h-1.5 rounded-full glow-pulse" style={{ background: "var(--accent-red)" }} />
            AI Music Generator #1 Indonesia ✦
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.15, ease: [0.25, 1, 0.5, 1] }}
          >
            <h1
              className="heading-display text-[var(--text-primary)] leading-[0.92]"
              style={{ fontSize: "clamp(4rem, 14vw, 9rem)", letterSpacing: "-0.05em" }}
            >
              BIKIN<br />
              MUSIK<br />
              <span className="text-gradient-fire">PAKE AI</span>
            </h1>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.45 }}
            className="text-[var(--text-muted)] mt-7 mb-8 leading-relaxed max-w-lg mx-auto"
            style={{ fontSize: "clamp(0.95rem, 2vw, 1.15rem)" }}
          >
            Gak perlu studio. Gak perlu instrumen.{" "}
            <span className="text-[var(--text-primary)] font-semibold">Tulis vibe lo, lagu beneran jadi dalam menit.</span>
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.55, ease: [0.34, 1.56, 0.64, 1] }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8"
          >
            <button onClick={onStart} className="btn-primary text-base px-9 py-4 rounded-2xl w-full sm:w-auto">
              Gas Bikin Musik 🎵
            </button>
            <button
              onClick={() => featuresRef.current?.scrollIntoView({ behavior: "smooth" })}
              className="px-7 py-4 rounded-2xl border border-[var(--border-subtle)] text-[var(--text-muted)] text-sm font-medium hover:border-[var(--accent-red)]/30 hover:text-[var(--text-primary)] transition-all duration-200 w-full sm:w-auto"
            >
              Lihat Karya ↓
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.75 }}
            className="flex flex-wrap items-center justify-center gap-2"
          >
            {["✓ 100 kredit gratis", "✓ Tanpa kartu kredit", "✓ Langsung jadi"].map(t => (
              <span key={t} className="text-xs text-[var(--text-faint)] px-3 py-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">{t}</span>
            ))}
          </motion.div>
        </motion.div>

        {/* Waveform decoration */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="relative z-10 flex items-end justify-center gap-px mt-16 w-full max-w-4xl"
          style={{ height: 44 }}
        >
          {Array.from({ length: 80 }, (_, i) => (
            <div
              key={i}
              className="flex-1 rounded-full waveform-bar"
              style={{
                height: `${16 + Math.sin(i * 0.38) * 14 + Math.cos(i * 0.62) * 8}%`,
                background: `hsl(${350 - i * 1.3}, 88%, ${52 + Math.sin(i * 0.45) * 11}%)`,
                opacity: 0.35,
                animationDelay: `${i * 0.025}s`,
              }}
            />
          ))}
        </motion.div>
      </section>

      <div className="section-rule mx-5 sm:mx-8 lg:mx-12" />

      {/* ── How it works ───────────────────────────────────────── */}
      <section className="px-5 sm:px-8 lg:px-12 py-20 max-w-7xl mx-auto">
        <motion.div {...fadeUp(0)} className="mb-12">
          <p className="label-caps mb-2" style={{ color: "var(--accent-red)" }}>Gimana Caranya?</p>
          <h2 className="heading-display text-[var(--text-primary)]" style={{ fontSize: "clamp(2.4rem, 6vw, 4.5rem)", letterSpacing: "-0.04em" }}>
            3 Langkah<br className="sm:hidden" /> Doang.
          </h2>
        </motion.div>

        {/* Desktop: 3-col cards */}
        <div className="hidden md:grid md:grid-cols-3 gap-6">
          {[
            { n: "01", emoji: "✍️", title: "Tulis Vibe",  desc: "Deskripsiin mood, genre, atau nuansa yang lo mau. Makin spesifik makin gokil hasilnya." },
            { n: "02", emoji: "🤖", title: "AI Garap",    desc: "AI bikin lagunya dalam 1–2 menit. Lo tinggal tunggu sambil ngemil." },
            { n: "03", emoji: "🚀", title: "Gas Share",   desc: "Download lagunya dan share ke mana aja — TikTok, Reels, YouTube, ke siapa aja." },
          ].map(({ n, emoji, title, desc }, i) => (
            <motion.div key={n} {...fadeUp(i * 0.12)} className="card-elevated p-7 space-y-4">
              <div className="num-editorial" style={{ fontSize: "clamp(3rem, 4vw, 4.5rem)" }}>{n}</div>
              <div>
                <p className="font-bold text-[var(--text-primary)] text-lg mb-2">{emoji} {title}</p>
                <p className="text-sm text-[var(--text-muted)] leading-relaxed">{desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Mobile: editorial rows */}
        <div className="md:hidden divide-y divide-[var(--border-subtle)]">
          {[
            { n: "01", emoji: "✍️", title: "Tulis Vibe",  desc: "Deskripsiin mood, genre, atau nuansa yang lo mau. Makin spesifik makin gokil hasilnya." },
            { n: "02", emoji: "🤖", title: "AI Garap",    desc: "AI bikin lagunya dalam 1–2 menit. Lo tinggal tunggu sambil ngemil." },
            { n: "03", emoji: "🚀", title: "Gas Share",   desc: "Download lagunya dan share ke mana aja — TikTok, Reels, YouTube, ke siapa aja." },
          ].map(({ n, emoji, title, desc }, i) => (
            <motion.div key={n} {...fadeUp(i * 0.14)} className="flex items-start gap-4 py-7">
              <div className="num-editorial flex-shrink-0 leading-none" style={{ fontSize: "clamp(3.5rem, 10vw, 5.5rem)", minWidth: "4.5rem" }}>{n}</div>
              <div className="pt-1">
                <p className="font-bold text-[var(--text-primary)] text-base mb-1">{emoji} {title}</p>
                <p className="text-sm text-[var(--text-muted)] leading-relaxed">{desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <div className="section-rule mx-5 sm:mx-8 lg:mx-12" />

      {/* ── 3 Modes ────────────────────────────────────────────── */}
      <section ref={featuresRef} className="px-5 sm:px-8 lg:px-12 py-20 max-w-7xl mx-auto">
        <motion.div {...fadeUp(0)} className="mb-12">
          <p className="label-caps mb-2" style={{ color: "var(--accent-coral)" }}>Fitur</p>
          <h2 className="heading-display text-[var(--text-primary)]" style={{ fontSize: "clamp(2.4rem, 6vw, 4.5rem)", letterSpacing: "-0.04em" }}>
            Tiga Cara<br />Berkreasi.
          </h2>
          <p className="text-[var(--text-muted)] text-sm mt-3">Dari lagu doang sampai musik video penuh</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Featured: Musik LIVE */}
          <motion.div {...fadeUp(0.05)} className="card-glass-red overflow-hidden md:col-span-1" style={{ padding: 0 }}>
            <div className="flex items-end gap-px h-14 px-6 pt-4">
              {Array.from({ length: 40 }, (_, i) => (
                <div key={i} className="flex-1 rounded-full waveform-bar"
                  style={{
                    height: `${25 + Math.sin(i * 0.6) * 18 + Math.cos(i * 0.3) * 10}%`,
                    background: `rgba(255,45,85,${0.3 + Math.sin(i * 0.4) * 0.15})`,
                    animationDelay: `${i * 0.05}s`,
                  }}
                />
              ))}
            </div>
            <div className="px-6 pb-6 pt-4 flex gap-4 items-start">
              <div className="w-14 h-14 rounded-2xl flex-shrink-0 flex items-center justify-center text-3xl" style={{ background: "rgba(255,45,85,0.12)" }}>🎵</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="heading-section text-xl text-[var(--text-primary)]">Musik</h3>
                  <span className="label-caps px-2 py-0.5 rounded-full text-white bg-gradient-red shadow-glow text-[9px]">LIVE</span>
                </div>
                <p className="text-sm text-[var(--text-muted)] leading-relaxed mb-4">
                  Tulis vibenya, AI yang bikin lagunya. Dari pop sampe gamelan modern — semua bisa. Gas langsung.
                </p>
                <button onClick={onStart} className="btn-primary text-sm py-2.5 px-5 rounded-xl">
                  Coba Sekarang — Gratis →
                </button>
              </div>
            </div>
          </motion.div>

          {[
            { icon: "📖", title: "Musik Novel", desc: "Musikmu jadi storyboard visual gokil. Setiap beat punya cerita visualnya sendiri.", card: "card-glass-amber", dotColor: "var(--accent-amber)" },
            { icon: "🎬", title: "Musik Video", desc: "Dari audio ke video sinematik AI. Nonton hasilnya bikin melongo.", card: "card-glass-coral", dotColor: "var(--accent-coral)" },
          ].map((feat, i) => (
            <motion.div key={feat.title} {...fadeUp(0.12 + i * 0.1)} className={`${feat.card} p-6 flex flex-col gap-4`}>
              <div className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center text-2xl" style={{ background: `${feat.dotColor}14` }}>{feat.icon}</div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-[var(--text-primary)]">{feat.title}</h3>
                  <span className="label-caps px-2 py-0.5 rounded-full bg-[var(--bg-elevated)] text-[var(--text-faint)] text-[8px]">SEGERA HADIR</span>
                </div>
                <p className="text-sm text-[var(--text-muted)] leading-relaxed">{feat.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <div className="section-rule mx-5 sm:mx-8 lg:mx-12" />

      {/* ── YouTube ─────────────────────────────────────────────── */}
      <section className="px-5 sm:px-8 lg:px-12 py-20 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <motion.div {...fadeUp(0)}>
            <p className="label-caps mb-2" style={{ color: "var(--accent-amber)" }}>Karya Terbaru</p>
            <h2 className="heading-display text-[var(--text-primary)]" style={{ fontSize: "clamp(2.4rem, 5vw, 4rem)", letterSpacing: "-0.04em" }}>
              Ini yang Udah<br />Dibikin. ✨
            </h2>
            <p className="text-sm text-[var(--text-muted)] mt-4 leading-relaxed max-w-sm">
              Bukti nyata AI bisa bikin musik yang beneran bagus. Dengerin sendiri, judging boleh.
            </p>
            <a
              href={YT_CHANNEL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-6 px-5 py-3 rounded-xl text-sm font-semibold transition-all hover:scale-105 active:scale-95"
              style={{ background: "rgba(255,0,0,0.1)", color: "#ff4444", border: "1px solid rgba(255,0,0,0.2)" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21.582 7.2s-.21-1.47-.85-2.12c-.81-.85-1.72-.85-2.13-.9C15.97 4 12 4 12 4s-3.97 0-6.6.18c-.41.05-1.32.05-2.13.9-.64.65-.85 2.12-.85 2.12S2.2 8.9 2.2 10.6v1.6c0 1.7.22 3.4.22 3.4s.21 1.47.85 2.12c.81.85 1.88.82 2.35.91C7 18.8 12 18.8 12 18.8s3.97 0 6.6-.18c.41-.05 1.32-.06 2.13-.91.64-.65.85-2.12.85-2.12s.22-1.7.22-3.4v-1.6c0-1.7-.22-3.4-.22-3.4zM9.74 14.85V8.66l5.76 3.1-5.76 3.09z"/>
              </svg>
              Tonton Lebih Banyak di YouTube
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, delay: 0.1, ease: [0.25, 1, 0.5, 1] }}
            className="card-glass overflow-hidden"
          >
            <div className="h-[2px] rainbow-line" />
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
            <div className="p-4 border-t border-[var(--border-subtle)]">
              <p className="font-semibold text-[var(--text-primary)] text-sm">Imaji AI</p>
              <p className="text-xs text-[var(--text-muted)]">Musik AI original Indonesia</p>
            </div>
          </motion.div>
        </div>
      </section>

      <div className="section-rule mx-5 sm:mx-8 lg:mx-12" />

      {/* ── Platform Distribution ───────────────────────────────── */}
      <section className="px-5 sm:px-8 lg:px-12 py-20 max-w-7xl mx-auto">
        <motion.div {...fadeUp(0)} className="mb-12">
          <p className="label-caps mb-2" style={{ color: "var(--accent-red)" }}>Distribusi Musik</p>
          <h2 className="heading-display text-[var(--text-primary)]" style={{ fontSize: "clamp(2.4rem, 6vw, 4.5rem)", letterSpacing: "-0.04em" }}>
            Segera Hadir<br />Di Mana-Mana.
          </h2>
          <p className="text-[var(--text-muted)] text-sm mt-3">Musikmu akan bisa langsung kita publish ke semua platform</p>
        </motion.div>

        <div className="space-y-3">
          {/* YouTube — full width featured */}
          <motion.div
            {...fadeUp(0.05)}
            className="relative overflow-hidden rounded-2xl p-5 sm:p-6 flex items-center gap-5"
            style={{ background: "linear-gradient(135deg, rgba(255,0,0,0.08), rgba(255,0,0,0.03))", border: "1px solid rgba(255,0,0,0.2)" }}
          >
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,0,0,0.12)" }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="#FF0000">
                <path d="M21.582 7.2s-.21-1.47-.85-2.12c-.81-.85-1.72-.85-2.13-.9C15.97 4 12 4 12 4s-3.97 0-6.6.18c-.41.05-1.32.05-2.13.9-.64.65-.85 2.12-.85 2.12S2.2 8.9 2.2 10.6v1.6c0 1.7.22 3.4.22 3.4s.21 1.47.85 2.12c.81.85 1.88.82 2.35.91C7 18.8 12 18.8 12 18.8s3.97 0 6.6-.18c.41-.05 1.32-.06 2.13-.91.64-.65.85-2.12.85-2.12s.22-1.7.22-3.4v-1.6c0-1.7-.22-3.4-.22-3.4zM9.74 14.85V8.66l5.76 3.1-5.76 3.09z"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-[var(--text-primary)]">YouTube Music</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Upload langsung ke channel · Monetize dari hari pertama</p>
            </div>
            <span className="label-caps px-2.5 py-1 rounded-full text-[8px] flex-shrink-0" style={{ background: "rgba(255,0,0,0.1)", color: "#FF0000", border: "1px solid rgba(255,0,0,0.2)" }}>SEGERA</span>
            <div className="absolute right-24 sm:right-32 top-0 bottom-0 flex items-center gap-px opacity-10 pointer-events-none">
              {Array.from({ length: 20 }, (_, i) => (
                <div key={i} className="w-1 rounded-full" style={{ height: `${20 + Math.sin(i * 0.8) * 16}px`, background: "#FF0000" }} />
              ))}
            </div>
          </motion.div>

          {/* 4 platforms: 2×2 mobile, 4-col desktop */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

            {/* TikTok */}
            <motion.div {...fadeUp(0.1)} className="relative overflow-hidden rounded-2xl p-4 sm:p-5 flex flex-col gap-3"
              style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))", border: "1px solid rgba(255,255,255,0.1)" }}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.06)" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                  <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.73a4.84 4.84 0 01-1.01-.04z"/>
                </svg>
              </div>
              <div>
                <p className="font-bold text-[var(--text-primary)] text-sm">TikTok</p>
                <p className="text-xs text-[var(--text-muted)] leading-tight mt-0.5">Viral lewat For You Page</p>
              </div>
              <span className="label-caps text-[7px] px-2 py-0.5 rounded-full self-start" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>SEGERA</span>
            </motion.div>

            {/* Spotify */}
            <motion.div {...fadeUp(0.13)} className="relative overflow-hidden rounded-2xl p-4 sm:p-5 flex flex-col gap-3"
              style={{ background: "linear-gradient(135deg, rgba(30,215,96,0.07), rgba(30,215,96,0.02))", border: "1px solid rgba(30,215,96,0.18)" }}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: "rgba(30,215,96,0.1)" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="#1ED760">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                </svg>
              </div>
              <div>
                <p className="font-bold text-[var(--text-primary)] text-sm">Spotify</p>
                <p className="text-xs text-[var(--text-muted)] leading-tight mt-0.5">Streaming ke jutaan pendengar</p>
              </div>
              <span className="label-caps text-[7px] px-2 py-0.5 rounded-full self-start" style={{ background: "rgba(30,215,96,0.08)", color: "#1ED760", border: "1px solid rgba(30,215,96,0.2)" }}>SEGERA</span>
            </motion.div>

            {/* Instagram */}
            <motion.div {...fadeUp(0.16)} className="relative overflow-hidden rounded-2xl p-4 sm:p-5 flex flex-col gap-3"
              style={{ background: "linear-gradient(135deg, rgba(225,48,108,0.07), rgba(193,53,132,0.03))", border: "1px solid rgba(225,48,108,0.18)" }}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, rgba(225,48,108,0.15), rgba(193,53,132,0.1))" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="url(#ig-grad)">
                  <defs>
                    <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#f09433"/>
                      <stop offset="50%" stopColor="#dc2743"/>
                      <stop offset="100%" stopColor="#bc1888"/>
                    </linearGradient>
                  </defs>
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </div>
              <div>
                <p className="font-bold text-[var(--text-primary)] text-sm">Instagram</p>
                <p className="text-xs text-[var(--text-muted)] leading-tight mt-0.5">Reels & Stories langsung</p>
              </div>
              <span className="label-caps text-[7px] px-2 py-0.5 rounded-full self-start" style={{ background: "rgba(225,48,108,0.08)", color: "#E1306C", border: "1px solid rgba(225,48,108,0.2)" }}>SEGERA</span>
            </motion.div>

            {/* Noise Indonesia — yellow brand */}
            <motion.div {...fadeUp(0.19)} className="relative overflow-hidden rounded-2xl p-4 sm:p-5 flex flex-col gap-3"
              style={{ background: "linear-gradient(135deg, rgba(245,209,0,0.1), rgba(245,209,0,0.03))", border: "1px solid rgba(245,209,0,0.25)" }}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "#F5D100" }}>
                {/* Noise Indonesia curved arc mark */}
                <svg width="24" height="24" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Left thick curved arc */}
                  <path d="M 42 78 C 42 78 18 64 18 50 C 18 36 42 22 42 22 L 54 22 C 54 22 28 36 28 50 C 28 64 54 78 54 78 Z" fill="#1a1a1a"/>
                  {/* Right curved arc */}
                  <path d="M 58 78 C 58 78 82 64 82 50 C 82 36 58 22 58 22 L 70 22 C 70 22 94 36 94 50 C 94 64 70 78 70 78 Z" fill="#1a1a1a"/>
                </svg>
              </div>
              <div>
                <p className="font-bold text-[var(--text-primary)] text-sm">Noise Indonesia</p>
                <p className="text-xs text-[var(--text-muted)] leading-tight mt-0.5">Platform musik lokal #1</p>
              </div>
              <span className="label-caps text-[7px] px-2 py-0.5 rounded-full self-start" style={{ background: "rgba(245,209,0,0.1)", color: "#F5D100", border: "1px solid rgba(245,209,0,0.3)" }}>SEGERA</span>
            </motion.div>

          </div>
        </div>

        <motion.p {...fadeUp(0.25)} className="text-center text-xs text-[var(--text-faint)] mt-6">
          Distribusi otomatis — lo bikin, kita yang urus sisanya 🚀
        </motion.p>
      </section>

      <div className="section-rule mx-5 sm:mx-8 lg:mx-12" />

      {/* ── Final CTA ───────────────────────────────────────────── */}
      <section className="px-5 sm:px-8 py-24 text-center relative overflow-hidden">
        <FloatingOrb style={{ width: 600, height: 600, top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "radial-gradient(circle, rgba(255,45,85,0.11) 0%, transparent 65%)" }} />
        <motion.div {...fadeUp(0)} className="relative z-10 max-w-2xl mx-auto">
          <h2 className="heading-display text-[var(--text-primary)] mb-6" style={{ fontSize: "clamp(2.8rem, 8vw, 6rem)", letterSpacing: "-0.05em", lineHeight: 0.92 }}>
            Siap Gas<br />
            <span className="text-gradient-fire">Bikin Musik?</span>
          </h2>
          <p className="text-[var(--text-muted)] text-sm leading-relaxed mb-8 max-w-sm mx-auto">
            Daftar gratis, dapat 100 kredit langsung.<br />
            Gak perlu kartu kredit. Gak perlu pengalaman musik.
          </p>
          <button onClick={onStart} className="btn-primary rounded-2xl py-4 px-12 text-base">
            Mulai Gratis Sekarang 🚀
          </button>
          <p className="text-xs text-[var(--text-faint)] mt-4">Daftar via WhatsApp · Langsung bisa pakai</p>
        </motion.div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-[var(--border-subtle)] px-5 sm:px-8 lg:px-12 py-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-red flex items-center justify-center shadow-glow">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                <path d="M9 18V5l12-2v13M6 21a3 3 0 100-6 3 3 0 000 6zm12-2a3 3 0 100-6 3 3 0 000 6z"/>
              </svg>
            </div>
            <span className="heading-display text-sm text-gradient-studio">KREASI AI</span>
          </div>
          <p className="text-xs text-[var(--text-faint)] text-center">by Imaji AI · UEN 202615181W · Dibuat dengan ❤️ di Indonesia</p>
          <div className="flex items-center gap-4 text-xs text-[var(--text-faint)]">
            <a href={YT_CHANNEL} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--text-muted)] transition-colors">YouTube</a>
            <span>·</span><span className="opacity-40">Spotify (soon)</span>
            <span>·</span><span className="opacity-40">TikTok (soon)</span>
          </div>
        </div>
        <p className="text-xs text-[var(--text-faint)] text-center mt-6">© 2025 Imaji AI. All rights reserved.</p>
      </footer>
    </div>
  );
}
