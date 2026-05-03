import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

interface LandingPageProps {
  onStart: () => void;
}

const C = {
  burgundy:  "#9B2335",
  burgundyLight: "#C23048",
  roseGold:  "#C4A882",
  amber:     "#C4844A",
  amberLight:"#E8A86C",
  cream:     "#FFF8F0",
  creamDark: "#F5EDE0",
  nearBlack: "#1A0A0E",
  darkBg:    "#2D0A12",
  darkMid:   "#3D1020",
  muted:     "#8B7355",
  mutedLight:"#A89070",
  white:     "#FFFFFF",
};

// ─── Ease curves ─────────────────────────────────────────────────────────────
const EASE_OUT = [0.25, 1, 0.5, 1] as const;
const EASE_SPRING = [0.34, 1.56, 0.64, 1] as const;

const fadeUp = (delay = 0, distance = 24) => ({
  initial: { opacity: 0, y: distance },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.65, delay, ease: EASE_OUT },
});

// ─── Grain overlay (film texture) ────────────────────────────────────────────
function GrainOverlay({ opacity = 0.045 }: { opacity?: number }) {
  return (
    <svg
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 2, mixBlendMode: "overlay" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <filter id="grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#grain)" opacity={opacity} />
    </svg>
  );
}

// ─── Ambient waveform ─────────────────────────────────────────────────────────
function AmbientWaveform({ barColor = C.amber, barOpacity = 0.35, count = 48 }: {
  barColor?: string; barOpacity?: number; count?: number;
}) {
  const barsRef = useRef<(HTMLDivElement | null)[]>([]);
  const rafRef  = useRef<number>(0);

  useEffect(() => {
    function tick() {
      const t = Date.now() / 1000;
      barsRef.current.forEach((bar, i) => {
        if (!bar) return;
        const h = (Math.sin(t * 1.2 + i * 0.35) * 0.5 + 0.5) * 40 + 6;
        bar.style.height = `${h}px`;
        bar.style.opacity = String(barOpacity * (0.5 + Math.sin(t + i * 0.4) * 0.5));
      });
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [barOpacity]);

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 48 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          ref={el => { barsRef.current[i] = el; }}
          style={{ width: 3, minHeight: 4, borderRadius: 2, background: barColor, flexShrink: 0 }}
        />
      ))}
    </div>
  );
}

// ─── Decorative QR pattern ────────────────────────────────────────────────────
function FakeQR({ size = 56, fg = C.nearBlack, bg = "transparent" }: { size?: number; fg?: string; bg?: string }) {
  const cell = size / 9;
  const pattern = [
    1,1,1,1,1,1,1,0,1,
    1,0,0,0,0,0,1,0,0,
    1,0,1,1,1,0,1,0,1,
    1,0,1,1,1,0,1,0,1,
    1,0,1,1,1,0,1,0,0,
    1,0,0,0,0,0,1,0,1,
    1,1,1,1,1,1,1,0,1,
    0,0,0,0,0,0,0,0,0,
    1,0,1,1,0,1,0,1,1,
  ];
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} xmlns="http://www.w3.org/2000/svg">
      <rect width={size} height={size} fill={bg} rx={4}/>
      {pattern.map((on, i) =>
        on ? (
          <rect
            key={i}
            x={(i % 9) * cell + 0.5}
            y={Math.floor(i / 9) * cell + 0.5}
            width={cell - 1}
            height={cell - 1}
            fill={fg}
            rx={1}
          />
        ) : null
      )}
    </svg>
  );
}

// ─── Gift card floating mockup (hero) ─────────────────────────────────────────
function HeroGiftCard() {
  const barHeights = Array.from({ length: 24 }, (_, i) => 20 + Math.sin(i * 0.9) * 60);
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, rotate: 3 }}
      animate={{ opacity: 1, y: 0, rotate: 3 }}
      transition={{ duration: 1, delay: 0.5, ease: EASE_OUT }}
      style={{ position: "relative" }}
    >
      {/* Glow behind the card */}
      <div style={{
        position: "absolute",
        inset: -32,
        borderRadius: 48,
        background: `radial-gradient(ellipse at center, rgba(196,132,74,0.25) 0%, transparent 70%)`,
        filter: "blur(24px)",
      }} />

      <div style={{
        width: 300,
        borderRadius: 24,
        background: `linear-gradient(160deg, #3D1020 0%, ${C.nearBlack} 100%)`,
        border: `1px solid rgba(196,168,130,0.2)`,
        padding: "24px",
        boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(196,168,130,0.08) inset",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Subtle inner glow top */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 120,
          background: `linear-gradient(180deg, rgba(196,132,74,0.08) 0%, transparent 100%)`,
          pointerEvents: "none",
        }}/>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{
              display: "inline-flex", gap: 6, alignItems: "center",
              padding: "4px 10px", borderRadius: 9999,
              border: "1px solid rgba(196,168,130,0.2)",
              background: "rgba(196,168,130,0.06)",
              marginBottom: 10,
            }}>
              <span style={{ fontSize: 10, color: C.roseGold, fontWeight: 600, letterSpacing: "0.06em" }}>LOVEMELODIA</span>
            </div>
            <p style={{ fontFamily: "Georgia, serif", fontSize: 18, color: C.white, margin: 0, lineHeight: 1.3 }}>
              Lagu Buat Kamu ♥
            </p>
            <p style={{ fontSize: 11, color: "rgba(196,168,130,0.5)", margin: "4px 0 0" }}>
              Ulang Tahun · 2026
            </p>
          </div>
          {/* Occasion emoji */}
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: `linear-gradient(135deg, rgba(155,35,53,0.6), rgba(196,132,74,0.4))`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24,
          }}>🎂</div>
        </div>

        {/* Waveform */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 40, marginBottom: 20 }}>
          {barHeights.map((h, i) => (
            <div key={i} style={{
              flex: 1, height: `${h}%`,
              background: `linear-gradient(180deg, ${C.amber}cc ${0}%, rgba(196,132,74,0.15) 100%)`,
              borderRadius: 2,
            }}/>
          ))}
        </div>

        {/* Footer row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <FakeQR size={64} fg={C.roseGold} />
            <p style={{ fontSize: 8, color: "rgba(196,168,130,0.4)", marginTop: 4 }}>Scan untuk dengarkan</p>
          </div>
          <div style={{ textAlign: "right" }}>
            {/* Play button */}
            <div style={{
              width: 40, height: 40, borderRadius: "50%",
              background: `linear-gradient(135deg, ${C.amber}, ${C.burgundy})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 0 20px rgba(196,132,74,0.45)`,
              marginBottom: 6,
              marginLeft: "auto",
            }}>
              <svg width="12" height="13" viewBox="0 0 10 12" fill="white">
                <polygon points="1,0.5 9.5,6 1,11.5"/>
              </svg>
            </div>
            <p style={{ fontSize: 9, color: "rgba(255,255,255,0.2)" }}>lovemelodia.com</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Vinyl record mockup ──────────────────────────────────────────────────────
function VinylMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.7, ease: EASE_OUT }}
      animate={{ rotate: 360 }}
      // @ts-ignore framer motion animate+whileInView conflict workaround
      style={{ position: "relative" }}
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        style={{ width: 240, height: 240 }}
      >
        <svg width={240} height={240} viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg">
          {/* Outer disc */}
          <circle cx={120} cy={120} r={118} fill="#1A1A1A"/>
          {/* Groove rings */}
          {[90,80,70,60,50,42,35].map(r => (
            <circle key={r} cx={120} cy={120} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={1.5}/>
          ))}
          {/* Highlight arc */}
          <path d="M 60 50 A 80 80 0 0 1 180 90" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={4} strokeLinecap="round"/>
          {/* Center label */}
          <circle cx={120} cy={120} r={30} fill={C.burgundy}/>
          <circle cx={120} cy={120} r={22} fill={C.darkMid}/>
          {/* Center hole */}
          <circle cx={120} cy={120} r={5} fill="#111"/>
          {/* Label text */}
          <text x={120} y={116} textAnchor="middle" fontSize={6} fill={C.roseGold} fontFamily="sans-serif" fontWeight="600">LOVEMELODIA</text>
          <text x={120} y={126} textAnchor="middle" fontSize={5} fill="rgba(196,168,130,0.5)" fontFamily="sans-serif">Anniversary</text>
        </svg>
      </motion.div>
    </motion.div>
  );
}

// ─── Phone mockup ─────────────────────────────────────────────────────────────
function PhoneMockup() {
  return (
    <motion.div
      {...{
        initial: { opacity: 0, y: 20 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true },
        transition: { duration: 0.7, ease: EASE_OUT },
      }}
      style={{
        width: 200, height: 360,
        borderRadius: 36,
        border: `2.5px solid rgba(196,168,130,0.25)`,
        background: C.nearBlack,
        padding: "14px 10px 10px",
        boxShadow: "0 32px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(196,168,130,0.05) inset",
        display: "flex", flexDirection: "column", gap: 8,
        flexShrink: 0,
      }}
    >
      {/* Notch */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: -4 }}>
        <div style={{ width: 60, height: 8, borderRadius: 9999, background: "rgba(255,255,255,0.06)" }}/>
      </div>
      {/* Status bar */}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "0 4px" }}>
        <span style={{ fontSize: 8, color: "rgba(255,255,255,0.3)" }}>9:41</span>
        <span style={{ fontSize: 8, color: "rgba(255,255,255,0.3)" }}>▲▲▲ WiFi ■</span>
      </div>
      {/* URL bar */}
      <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 8, padding: "5px 10px", display: "flex", alignItems: "center", gap: 4 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4CAF50" }}/>
        <p style={{ fontSize: 7.5, color: "rgba(196,168,130,0.5)", fontFamily: "monospace", margin: 0 }}>lovemelodia.com/gift/…</p>
      </div>
      {/* Gift page preview */}
      <div style={{
        flex: 1, borderRadius: 14,
        background: `linear-gradient(160deg, ${C.nearBlack}, #3D1020)`,
        border: `1px solid rgba(196,168,130,0.15)`,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 10, padding: 14,
      }}>
        <div style={{ width: 72, height: 72, borderRadius: 16, background: `linear-gradient(135deg, ${C.burgundy}, ${C.amber})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 28 }}>🌸</span>
        </div>
        <p style={{ fontFamily: "Georgia, serif", fontSize: 10, color: C.white, textAlign: "center", margin: 0, lineHeight: 1.5 }}>
          Lagu dari anakmu<br/>yang selalu sayang
        </p>
        <p style={{ fontSize: 8, color: C.roseGold, margin: 0 }}>Untuk Ibu · 2026</p>
        {/* Play button */}
        <div style={{
          width: 40, height: 40, borderRadius: "50%",
          background: `linear-gradient(135deg, ${C.amber}, ${C.burgundy})`,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 0 16px rgba(196,132,74,0.4)`,
        }}>
          <svg width="11" height="12" viewBox="0 0 10 12" fill="white">
            <polygon points="1,0.5 9.5,6 1,11.5"/>
          </svg>
        </div>
        {/* Mini waveform */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 1.5, height: 20, width: "100%" }}>
          {Array.from({ length: 28 }, (_, i) => (
            <div key={i} style={{ flex: 1, height: `${25 + Math.sin(i * 0.7) * 55}%`, background: `rgba(196,132,74,${0.2 + Math.sin(i * 0.4) * 0.15})`, borderRadius: 1 }}/>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Bouquet illustration ─────────────────────────────────────────────────────
function BouquetWithTag() {
  return (
    <div style={{ position: "relative", width: 220, height: 300, flexShrink: 0 }}>
      {/* Glow */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 60%, rgba(196,132,74,0.15) 0%, transparent 70%)", borderRadius: "50%" }}/>

      <svg width={220} height={260} viewBox="0 0 220 260" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ position: "absolute", top: 0, left: 0 }}>
        {/* Wrap ribbon */}
        <path d="M 60 220 Q 110 200 160 220" stroke={C.burgundy} strokeWidth={3} fill="none" opacity={0.6}/>
        {/* Stems */}
        <path d="M110 210 Q105 170 90 138" stroke="#5A8A40" strokeWidth={3} strokeLinecap="round"/>
        <path d="M110 210 Q115 165 132 132" stroke="#5A8A40" strokeWidth={3} strokeLinecap="round"/>
        <path d="M110 210 Q110 168 110 125" stroke="#5A8A40" strokeWidth={3.5} strokeLinecap="round"/>
        <path d="M110 210 Q98 172 78 150" stroke="#4A7A30" strokeWidth={2.5} strokeLinecap="round"/>
        <path d="M110 210 Q122 170 142 148" stroke="#4A7A30" strokeWidth={2.5} strokeLinecap="round"/>
        {/* Leaves */}
        <path d="M95 173 Q80 162 87 148 Q102 155 95 173Z" fill="#6A9A50" opacity={0.8}/>
        <path d="M127 167 Q142 156 135 142 Q120 149 127 167Z" fill="#6A9A50" opacity={0.8}/>
        {/* Center flower — rose */}
        {[0,72,144,216,288].map((deg, i) => (
          <ellipse key={i}
            cx={110 + 20 * Math.cos(deg * Math.PI / 180)}
            cy={118 + 20 * Math.sin(deg * Math.PI / 180)}
            rx={11} ry={16}
            fill={i % 2 === 0 ? "#F4A0A0" : "#E87878"}
            transform={`rotate(${deg}, ${110 + 20 * Math.cos(deg * Math.PI / 180)}, ${118 + 20 * Math.sin(deg * Math.PI / 180)})`}
            opacity={0.92}
          />
        ))}
        <circle cx={110} cy={118} r={13} fill="#F59E4A"/>
        <circle cx={110} cy={118} r={7} fill="#E57A20"/>
        {/* Left flower — pink */}
        {[0,72,144,216,288].map((deg, i) => (
          <ellipse key={i}
            cx={74 + 15 * Math.cos(deg * Math.PI / 180)}
            cy={138 + 15 * Math.sin(deg * Math.PI / 180)}
            rx={8} ry={12}
            fill={i % 2 === 0 ? "#F4B0C8" : "#E890A8"}
            transform={`rotate(${deg}, ${74 + 15 * Math.cos(deg * Math.PI / 180)}, ${138 + 15 * Math.sin(deg * Math.PI / 180)})`}
            opacity={0.88}
          />
        ))}
        <circle cx={74} cy={138} r={9} fill="#F5C842"/>
        <circle cx={74} cy={138} r={4.5} fill="#E5A820"/>
        {/* Right flower — rose gold */}
        {[0,72,144,216,288].map((deg, i) => (
          <ellipse key={i}
            cx={146 + 13 * Math.cos(deg * Math.PI / 180)}
            cy={130 + 13 * Math.sin(deg * Math.PI / 180)}
            rx={7} ry={11}
            fill={i % 2 === 0 ? "#C4A882" : "#A88862"}
            transform={`rotate(${deg}, ${146 + 13 * Math.cos(deg * Math.PI / 180)}, ${130 + 13 * Math.sin(deg * Math.PI / 180)})`}
            opacity={0.9}
          />
        ))}
        <circle cx={146} cy={130} r={7} fill="#E57A20"/>
        {/* Wrap */}
        <ellipse cx={110} cy={218} rx={52} ry={12} fill={C.cream} opacity={0.9}/>
        <path d="M 58 218 Q 110 225 162 218 L 162 235 Q 110 242 58 235 Z" fill={C.cream} opacity={0.85}/>
        <path d="M 58 218 Q 110 225 162 218" stroke={C.roseGold} strokeWidth={1.5} fill="none" opacity={0.6}/>
      </svg>

      {/* QR gift tag */}
      <div style={{
        position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: 76, padding: "8px 8px 6px",
        background: C.cream, border: `1.5px solid ${C.burgundy}`,
        borderRadius: 6, textAlign: "center",
        boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
      }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", border: `1.5px solid ${C.burgundy}`, margin: "0 auto 5px" }}/>
        <FakeQR size={44} fg={C.burgundy} bg={C.cream}/>
        <p style={{ fontSize: 7, color: C.muted, marginTop: 3, lineHeight: 1.4 }}>Scan untuk<br/>dengerin 🎵</p>
      </div>
      {/* String */}
      <svg style={{ position: "absolute", bottom: 62, left: "50%", transform: "translateX(-50%)" }} width={2} height={28}>
        <line x1={1} y1={0} x2={1} y2={28} stroke={C.roseGold} strokeWidth={1.2} strokeDasharray="3,2"/>
      </svg>
    </div>
  );
}

// ─── Section 1 : Hero ─────────────────────────────────────────────────────────
function HeroSection({ onStart }: { onStart: () => void }) {
  return (
    <section style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      padding: "80px 24px 64px",
      position: "relative",
      overflow: "hidden",
      background: `radial-gradient(ellipse 120% 100% at 40% 50%, ${C.darkBg} 0%, ${C.nearBlack} 55%)`,
    }}>
      {/* Deep amber underglow */}
      <div style={{
        position: "absolute", bottom: -80, left: "50%", transform: "translateX(-50%)",
        width: "80%", height: 400,
        background: `radial-gradient(ellipse at center, rgba(196,132,74,0.12) 0%, transparent 70%)`,
        pointerEvents: "none",
      }}/>
      {/* Burgundy left glow */}
      <div style={{
        position: "absolute", top: "20%", left: -80, width: 400, height: 400,
        background: `radial-gradient(ellipse at center, rgba(155,35,53,0.15) 0%, transparent 70%)`,
        pointerEvents: "none",
      }}/>

      <GrainOverlay opacity={0.05} />

      <div style={{
        maxWidth: 1200, margin: "0 auto", width: "100%",
        display: "flex", alignItems: "center", gap: 64,
        flexWrap: "wrap", justifyContent: "center",
      }}>
        {/* Left: text */}
        <div style={{ flex: "1 1 380px", maxWidth: 560, position: "relative", zIndex: 3 }}>
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            style={{
              display: "inline-flex", gap: 6, alignItems: "center",
              padding: "6px 16px", borderRadius: 9999,
              border: `1px solid rgba(196,168,130,0.3)`,
              background: "rgba(196,168,130,0.07)",
              color: C.roseGold, fontSize: 12, fontWeight: 600,
              letterSpacing: "0.04em", marginBottom: 28,
            }}
          >
            ✦ Bikin Musik untuk yang Kau Sayang
          </motion.div>

          {/* Headline */}
          <h1 style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            color: C.white, lineHeight: 1.08, margin: "0 0 24px",
          }}>
            <motion.span
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, delay: 0.2, ease: EASE_OUT }}
              style={{ display: "block", fontSize: "clamp(2.8rem, 8vw, 5.2rem)", letterSpacing: "-0.02em" }}
            >
              Ada lagu yang
            </motion.span>
            <motion.span
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, delay: 0.38, ease: EASE_OUT }}
              style={{
                display: "block",
                fontSize: "clamp(2.8rem, 8vw, 5.2rem)",
                letterSpacing: "-0.02em",
                background: `linear-gradient(90deg, ${C.white} 0%, ${C.roseGold} 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              cuma buat kamu.
            </motion.span>
          </h1>

          {/* Sub */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            style={{
              color: "rgba(196,168,130,0.8)", fontSize: "clamp(1rem, 2.2vw, 1.15rem)",
              lineHeight: 1.65, margin: "0 0 40px",
            }}
          >
            Hadiah yang didengar, bukan hanya dilihat.<br/>
            Pilih momennya — AI bikinkan lagunya.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.75, ease: EASE_SPRING }}
            style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 360 }}
          >
            <button
              onClick={onStart}
              style={{
                background: `linear-gradient(135deg, ${C.amber} 0%, ${C.burgundy} 100%)`,
                color: C.white, fontSize: 17, fontWeight: 700,
                padding: "17px 36px", borderRadius: 9999,
                border: "none", cursor: "pointer", width: "100%",
                boxShadow: `0 6px 32px rgba(155,35,53,0.5), 0 2px 8px rgba(196,132,74,0.25)`,
                transition: "transform 0.15s, box-shadow 0.15s",
                letterSpacing: "0.01em",
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.transform = "scale(1.03) translateY(-1px)";
                el.style.boxShadow = `0 10px 40px rgba(155,35,53,0.6), 0 2px 10px rgba(196,132,74,0.3)`;
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.transform = "scale(1)";
                el.style.boxShadow = `0 6px 32px rgba(155,35,53,0.5), 0 2px 8px rgba(196,132,74,0.25)`;
              }}
            >
              Bikin Lagu untuk Dia →
            </button>

            <a
              href="#stories"
              style={{ color: "rgba(196,168,130,0.65)", fontSize: 14, textDecoration: "none", textAlign: "center", transition: "color 0.15s" }}
              onClick={e => { e.preventDefault(); document.getElementById("stories")?.scrollIntoView({ behavior: "smooth" }); }}
              onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.color = C.roseGold}
              onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.color = "rgba(196,168,130,0.65)"}
            >
              Lihat contoh hadiah ↓
            </a>
          </motion.div>

          {/* Social proof */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ delay: 1.1 }}
            style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 32 }}
          >
            {["✓ Tanpa studio", "✓ Langsung jadi", "✓ Bisa dicetak"].map(t => (
              <span key={t} style={{
                fontSize: 11, color: "rgba(196,168,130,0.55)",
                padding: "4px 12px", borderRadius: 9999,
                border: "1px solid rgba(196,168,130,0.15)",
              }}>{t}</span>
            ))}
          </motion.div>

          {/* Waveform */}
          <div style={{ marginTop: 36 }}>
            <AmbientWaveform barColor={C.amber} barOpacity={0.5} count={40} />
          </div>
        </div>

        {/* Right: floating gift card */}
        <div style={{ flex: "0 0 auto", display: "flex", justifyContent: "center", position: "relative", zIndex: 3 }}>
          <HeroGiftCard />
        </div>
      </div>
    </section>
  );
}

// ─── Section 2 : How It Works ─────────────────────────────────────────────────
function HowItWorksSection() {
  const steps = [
    { num: "01", emoji: "🎵", title: "Pilih momen", desc: "Birthday, Mother's Day, Lebaran, Anniversary, atau sesederhana rasa sayang." },
    { num: "02", emoji: "✨", title: "Ceritakan kisahmu", desc: "Bot kami tanya hal-hal kecil yang bermakna — jawaban kamu jadi liriknya." },
    { num: "03", emoji: "🎁", title: "Kirimkan lagunya", desc: "Share link lewat WA, atau cetak QR card dan selipkan di bouquet." },
  ];

  return (
    <section style={{ background: C.cream, padding: "96px 24px", position: "relative" }}>
      {/* Subtle top border gradient */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${C.burgundy}40, transparent)` }}/>

      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <motion.div {...fadeUp(0)} style={{ textAlign: "center", marginBottom: 64 }}>
          <p style={{ fontSize: 12, letterSpacing: "0.14em", color: C.burgundy, fontWeight: 700, marginBottom: 12, textTransform: "uppercase" }}>
            Cara kerjanya
          </p>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(2rem, 5vw, 3rem)", color: C.nearBlack, margin: 0, lineHeight: 1.2 }}>
            Semudah tiga langkah
          </h2>
        </motion.div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 28 }}>
          {steps.map(({ num, emoji, title, desc }, i) => (
            <motion.div key={num} {...fadeUp(i * 0.1)}
              style={{
                background: C.white, borderRadius: 20, padding: "32px 28px",
                boxShadow: "0 4px 24px rgba(155,35,53,0.06), 0 1px 4px rgba(155,35,53,0.04)",
                border: `1px solid rgba(155,35,53,0.07)`,
                position: "relative", overflow: "hidden",
              }}
            >
              {/* Subtle corner glow */}
              <div style={{ position: "absolute", top: -24, right: -24, width: 80, height: 80, borderRadius: "50%", background: `rgba(196,132,74,0.06)` }}/>
              <div style={{
                width: 44, height: 44, borderRadius: "50%",
                background: `linear-gradient(135deg, ${C.burgundy}, ${C.darkMid})`,
                color: C.white, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700, marginBottom: 20, letterSpacing: "0.04em",
                boxShadow: `0 4px 12px rgba(155,35,53,0.3)`,
              }}>
                {num}
              </div>
              <p style={{ fontSize: 30, margin: "0 0 12px" }}>{emoji}</p>
              <h3 style={{ fontFamily: "Georgia, serif", fontSize: 21, color: C.nearBlack, margin: "0 0 10px" }}>
                {title}
              </h3>
              <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.7, margin: 0 }}>{desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Section 3 : Human Stories ───────────────────────────────────────────────
interface StoryProps {
  headline: string; body: string;
  bg: string; textColor: string; bodyColor: string;
  visual: React.ReactNode; flip?: boolean;
  accent?: string;
}

function StoryVignette({ headline, body, bg, textColor, bodyColor, visual, flip, accent }: StoryProps) {
  return (
    <motion.section
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: "-120px" }}
      transition={{ duration: 0.5 }}
      style={{ background: bg, padding: "80px 24px", position: "relative", overflow: "hidden" }}
    >
      {accent && (
        <div style={{
          position: "absolute", bottom: -60, right: flip ? "auto" : -60, left: flip ? -60 : "auto",
          width: 300, height: 300, borderRadius: "50%",
          background: `radial-gradient(ellipse at center, ${accent} 0%, transparent 70%)`,
          pointerEvents: "none",
        }}/>
      )}
      <div style={{
        maxWidth: 1024, margin: "0 auto",
        display: "flex",
        flexDirection: flip ? "row-reverse" : "row",
        alignItems: "center", gap: 56,
        flexWrap: "wrap", justifyContent: "center",
      }}>
        <motion.div
          initial={{ opacity: 0, x: flip ? 32 : -32 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.1 }}
          style={{ flex: "1 1 320px", maxWidth: 500 }}
        >
          <h2 style={{
            fontFamily: "Georgia, serif",
            fontSize: "clamp(1.7rem, 4vw, 2.5rem)",
            color: textColor, lineHeight: 1.2, margin: "0 0 18px",
          }}>
            {headline}
          </h2>
          <p style={{ fontSize: 16, color: bodyColor, lineHeight: 1.8, margin: 0 }}>{body}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: flip ? -32 : 32 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.2 }}
          style={{ flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          {visual}
        </motion.div>
      </div>
    </motion.section>
  );
}

function StoryPhoto({ src, alt }: { src: string; alt: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8, ease: EASE_OUT }}
      style={{
        width: 320, height: 380, borderRadius: 20, overflow: "hidden", flexShrink: 0,
        boxShadow: "0 24px 64px rgba(0,0,0,0.35)",
      }}
    >
      <img
        src={src} alt={alt}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
    </motion.div>
  );
}

function StoriesSection() {
  return (
    <div id="stories">
      <StoryVignette
        headline="Ibumu membuka link-nya di depan bunga."
        body="Musik mengalun. Dia tidak menyangka ada lagu yang kamu buat khusus buat dia — dari ingatan kecil yang kamu ceritakan."
        bg={`linear-gradient(160deg, #FFF2E0 0%, ${C.cream} 100%)`}
        textColor={C.burgundy}
        bodyColor={C.muted}
        accent="rgba(196,132,74,0.1)"
        visual={<StoryPhoto src="/stories/story-1.jpg" alt="Woman receiving flowers at golden hour" />}
      />
      <StoryVignette
        headline='"Ini buat kamu sebelum kamu pergi."'
        body="Gift card digital — kirim lewat WA, dibuka kapan saja. Lagunya tetap ada, bahkan setelah jarak memisahkan."
        bg={`linear-gradient(160deg, ${C.nearBlack} 0%, ${C.darkMid} 100%)`}
        textColor={C.white}
        bodyColor={`rgba(196,168,130,0.7)`}
        accent="rgba(155,35,53,0.15)"
        visual={<StoryPhoto src="/stories/story-2.jpg" alt="Friends sharing a music gift" />}
        flip
      />
      <StoryVignette
        headline="Bukan bunga lagi. Sebuah lagu."
        body="Cetak vinyl card-nya, selipkan di antara mawar. Scan QR-nya untuk dengarkan — hadiah yang bisa diputar ulang selamanya."
        bg={`linear-gradient(160deg, #1A0A0E 0%, #2D0A12 100%)`}
        textColor={C.roseGold}
        bodyColor="rgba(196,168,130,0.7)"
        accent="rgba(196,132,74,0.08)"
        visual={<StoryPhoto src="/stories/story-3.jpg" alt="Vinyl record on romantic candlelit table" />}
      />
      <StoryVignette
        headline="Dari jauh, tapi terasa dekat."
        body="Kirim link saja. Tidak perlu install apa-apa. Cukup buka, dan dengarkan lagu yang dibuat khusus buat dia."
        bg={`linear-gradient(160deg, #FFF2E0 0%, ${C.cream} 100%)`}
        textColor={C.nearBlack}
        bodyColor={C.muted}
        accent="rgba(196,168,130,0.06)"
        visual={<StoryPhoto src="/stories/story-4.jpg" alt="Grandmother joyfully reading a music gift message" />}
        flip
      />
    </div>
  );
}

// ─── Section 4 : Occasion Grid ───────────────────────────────────────────────
function OccasionGrid({ onStart }: { onStart: () => void }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const occasions = [
    { emoji: "🎂", label: "Ulang Tahun" },
    { emoji: "💕", label: "Untuk Kekasih" },
    { emoji: "🌸", label: "Untuk Ibu" },
    { emoji: "🤝", label: "Persahabatan" },
    { emoji: "💍", label: "Anniversary" },
    { emoji: "👨", label: "Untuk Ayah" },
    { emoji: "🎓", label: "Wisuda" },
    { emoji: "💒", label: "Pernikahan" },
    { emoji: "🙏", label: "Terima Kasih" },
    { emoji: "🌙", label: "Ramadan" },
    { emoji: "🎄", label: "Natal" },
    { emoji: "✨", label: "Bebas" },
  ];

  return (
    <section style={{ background: C.creamDark, padding: "96px 24px" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <motion.div {...fadeUp(0)} style={{ textAlign: "center", marginBottom: 56 }}>
          <p style={{ fontSize: 12, letterSpacing: "0.14em", color: C.burgundy, fontWeight: 700, marginBottom: 12, textTransform: "uppercase" }}>
            Semua momen
          </p>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(1.8rem, 5vw, 2.8rem)", color: C.nearBlack, margin: "0 0 10px" }}>
            Untuk momen apa saja
          </h2>
          <p style={{ color: C.mutedLight, fontSize: 15, margin: 0 }}>Pilih momennya, kita bikinkan lagunya.</p>
        </motion.div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 16 }}>
          {occasions.map(({ emoji, label }, i) => (
            <motion.button key={label}
              {...fadeUp(Math.floor(i / 4) * 0.06)}
              onClick={onStart}
              onHoverStart={() => setHovered(label)}
              onHoverEnd={() => setHovered(null)}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.97 }}
              style={{
                background: hovered === label ? C.white : C.white,
                border: `1.5px solid ${hovered === label ? C.burgundy : "rgba(155,35,53,0.08)"}`,
                borderRadius: 16, padding: "22px 8px 16px",
                cursor: "pointer", display: "flex", flexDirection: "column",
                alignItems: "center", gap: 10,
                boxShadow: hovered === label
                  ? `0 8px 24px rgba(155,35,53,0.15), 0 0 0 1px ${C.burgundy}20 inset`
                  : "0 2px 8px rgba(155,35,53,0.05)",
                transition: "border-color 0.15s, box-shadow 0.15s",
              }}
            >
              <span style={{ fontSize: 34 }}>{emoji}</span>
              <span style={{ fontSize: 11, color: hovered === label ? C.burgundy : C.muted, fontWeight: 600, textAlign: "center", lineHeight: 1.35, transition: "color 0.15s" }}>
                {label}
              </span>
            </motion.button>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Section 5 : Final CTA ───────────────────────────────────────────────────
function FinalCTASection({ onStart }: { onStart: () => void }) {
  return (
    <section style={{
      background: `linear-gradient(160deg, ${C.nearBlack} 0%, ${C.burgundy} 60%, ${C.darkMid} 100%)`,
      padding: "112px 24px", textAlign: "center", position: "relative", overflow: "hidden",
    }}>
      {/* Glow */}
      <div style={{
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: 600, height: 400,
        background: `radial-gradient(ellipse at center, rgba(196,132,74,0.12) 0%, transparent 65%)`,
        pointerEvents: "none",
      }}/>
      <GrainOverlay opacity={0.04}/>

      <motion.div {...fadeUp(0)} style={{ maxWidth: 600, margin: "0 auto", position: "relative", zIndex: 1 }}>
        {/* Music note decorative */}
        <div style={{ fontSize: 40, marginBottom: 24, opacity: 0.8 }}>♫</div>

        <h2 style={{
          fontFamily: "Georgia, serif",
          fontSize: "clamp(1.9rem, 5vw, 3rem)",
          color: C.white, lineHeight: 1.2, margin: "0 0 16px",
        }}>
          Siapa yang ingin kamu kirimkan musiknya hari ini?
        </h2>

        <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 16, margin: "0 0 40px", lineHeight: 1.6 }}>
          3 hadiah gratis untuk mulai.<br/>
          <span style={{ fontSize: 13, opacity: 0.6 }}>Tanpa kartu kredit · Langsung jadi · No install</span>
        </p>

        <motion.button
          onClick={onStart}
          whileHover={{ scale: 1.04, y: -2 }}
          whileTap={{ scale: 0.97 }}
          style={{
            background: C.white,
            color: C.burgundy, fontSize: 18, fontWeight: 700,
            padding: "18px 56px", borderRadius: 9999,
            border: "none", cursor: "pointer",
            boxShadow: `0 8px 40px rgba(0,0,0,0.3), 0 2px 8px rgba(196,168,130,0.2)`,
            letterSpacing: "0.01em",
          }}
        >
          Mulai Sekarang →
        </motion.button>

        {/* Ambient waveform below CTA */}
        <div style={{ marginTop: 48, display: "flex", justifyContent: "center" }}>
          <AmbientWaveform barColor="rgba(255,255,255,0.2)" barOpacity={0.8} count={32} />
        </div>
      </motion.div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function FooterSection() {
  return (
    <footer style={{
      background: C.nearBlack,
      borderTop: `1px solid rgba(196,168,130,0.1)`,
      padding: "40px 24px",
    }}>
      <div style={{
        maxWidth: 900, margin: "0 auto",
        display: "flex", flexDirection: "column", alignItems: "center",
        gap: 8, textAlign: "center",
      }}>
        <img src="/logo.png" alt="Lovemelodia" style={{ height: 32, objectFit: "contain", mixBlendMode: "screen" }} />
        <p style={{ fontSize: 12, color: "rgba(196,168,130,0.4)", margin: 0, letterSpacing: "0.02em" }}>
          Musik untuk yang Kau Sayang
        </p>
        <p style={{ fontSize: 12, color: "rgba(196,168,130,0.3)", margin: "8px 0 0" }}>
          by Imaji AI · lovemelodia.com · Dibuat dengan ❤️ di Indonesia
        </p>
        <p style={{ fontSize: 11, color: "rgba(196,168,130,0.18)", margin: 0 }}>
          © {new Date().getFullYear()} Imaji AI
        </p>
      </div>
    </footer>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function LandingPage({ onStart }: LandingPageProps) {
  return (
    <div style={{ minWidth: 0, overflowX: "hidden" }}>
      <HeroSection onStart={onStart} />
      <HowItWorksSection />
      <StoriesSection />
      <OccasionGrid onStart={onStart} />
      <FinalCTASection onStart={onStart} />
      <FooterSection />
    </div>
  );
}
