import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Play, Pause, ChevronLeft, ChevronRight, Volume2, VolumeX, Music, Film } from "lucide-react";

interface ShowcaseItem {
  type: "video" | "audio";
  title: string;
  theme: string | null;
  url: string;
  music_url: string | null;
}

function truncate(str: string, max = 42): string {
  return str.length > max ? str.slice(0, max).trimEnd() + "…" : str;
}

function AudioCard({ item, isActive }: { item: ShowcaseItem; isActive: boolean }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!isActive && playing) {
      audioRef.current?.pause();
      setPlaying(false);
    }
  }, [isActive]);

  function toggle() {
    const el = audioRef.current;
    if (!el) return;
    if (playing) { el.pause(); setPlaying(false); }
    else { el.play(); setPlaying(true); }
  }

  const bars = Array.from({ length: 28 });

  return (
    <div className="w-56 sm:w-64 flex-shrink-0 rounded-2xl overflow-hidden card-glass border border-[var(--border-subtle)] snap-center group cursor-pointer" onClick={toggle}>
      {/* Waveform visual */}
      <div className="relative h-36 flex items-end justify-center gap-px px-4 pb-4 overflow-hidden"
        style={{ background: "linear-gradient(160deg, rgba(255,45,85,0.12) 0%, rgba(220,38,38,0.06) 100%)" }}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-glow"
            style={{ background: "linear-gradient(135deg, #ff2d55, #dc2626)", boxShadow: "0 0 30px rgba(255,45,85,0.4)" }}
          >
            {playing
              ? <Pause className="w-6 h-6 text-white" />
              : <Play className="w-6 h-6 text-white translate-x-0.5" />
            }
          </div>
        </div>
        {bars.map((_, i) => {
          const h = 20 + Math.sin(i * 0.7 + 1) * 16 + Math.cos(i * 0.4) * 10;
          return (
            <motion.div
              key={i}
              className="flex-1 rounded-full opacity-40"
              style={{ background: "var(--accent-red)" }}
              animate={playing
                ? { scaleY: [0.3, 1, 0.5, 0.8, 0.3], transition: { duration: 1.2 + (i % 5) * 0.15, repeat: Infinity, ease: "easeInOut", delay: i * 0.04 } }
                : { scaleY: h / 46 }
              }
              initial={{ height: h, originY: 1 }}
              transition={{ duration: 0.3 }}
            />
          );
        })}
      </div>

      {/* Info */}
      <div className="p-3.5 border-t border-[var(--border-subtle)]">
        <div className="flex items-start gap-2">
          <Music className="w-3.5 h-3.5 text-[var(--accent-red)] mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--text-primary)] leading-snug truncate">
              {truncate(item.title, 36)}
            </p>
            <p className="text-xs text-[var(--text-faint)] mt-0.5">Musik AI · Kreasi AI</p>
          </div>
        </div>
      </div>

      <audio ref={audioRef} src={item.url} preload="none" onEnded={() => setPlaying(false)} />
    </div>
  );
}

function VideoCard({ item, isActive }: { item: ShowcaseItem; isActive: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [hovered, setHovered] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!isActive) {
      videoRef.current?.pause();
      setPlaying(false);
    }
  }, [isActive]);

  async function handlePlay(e: React.MouseEvent) {
    e.stopPropagation();
    const el = videoRef.current;
    if (!el) return;
    if (playing) { el.pause(); setPlaying(false); }
    else { await el.play(); setPlaying(true); }
  }

  function toggleMute(e: React.MouseEvent) {
    e.stopPropagation();
    if (!videoRef.current) return;
    videoRef.current.muted = !muted;
    setMuted(m => !m);
  }

  return (
    <div
      className="w-56 sm:w-64 flex-shrink-0 rounded-2xl overflow-hidden card-glass border border-[var(--border-subtle)] snap-center group"
      onMouseEnter={() => { setHovered(true); if (videoRef.current && !playing) { videoRef.current.muted = true; setMuted(true); videoRef.current.play().then(() => setPlaying(true)).catch(() => {}); } }}
      onMouseLeave={() => { setHovered(false); if (videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = 0; setPlaying(false); } }}
    >
      {/* Video area */}
      <div className="relative aspect-video bg-black overflow-hidden">
        <video
          ref={videoRef}
          src={item.url}
          className="w-full h-full object-cover"
          muted={muted}
          loop
          playsInline
          preload="metadata"
          onEnded={() => setPlaying(false)}
        />

        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

        {/* Controls overlay */}
        <AnimatePresence>
          {(hovered || !playing) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <button
                onClick={handlePlay}
                className="w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-sm transition-transform hover:scale-110 active:scale-95"
                style={{ background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.3)" }}
              >
                {playing
                  ? <Pause className="w-5 h-5 text-white" />
                  : <Play className="w-5 h-5 text-white translate-x-0.5" />
                }
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mute button */}
        {playing && (
          <button
            onClick={toggleMute}
            className="absolute bottom-2 right-2 p-1.5 rounded-lg backdrop-blur-sm transition-colors hover:bg-white/20"
            style={{ background: "rgba(0,0,0,0.5)" }}
          >
            {muted
              ? <VolumeX className="w-3.5 h-3.5 text-white" />
              : <Volume2 className="w-3.5 h-3.5 text-white" />
            }
          </button>
        )}

        {/* Live badge */}
        <div className="absolute top-2 left-2">
          <span className="label-caps px-2 py-0.5 rounded-full text-[9px] text-white" style={{ background: "rgba(255,45,85,0.85)", backdropFilter: "blur(4px)" }}>
            MUSIK VIDEO
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="p-3.5 border-t border-[var(--border-subtle)]">
        <div className="flex items-start gap-2">
          <Film className="w-3.5 h-3.5 text-[var(--accent-coral)] mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--text-primary)] leading-snug truncate">
              {truncate(item.title, 36)}
            </p>
            <p className="text-xs text-[var(--text-faint)] mt-0.5">
              {item.theme ? `${item.theme} · Kreasi AI` : "Kreasi AI"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ShowcaseCarousel() {
  const [items, setItems] = useState<ShowcaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/public/showcase")
      .then(r => r.json())
      .then((d: { items: ShowcaseItem[] }) => { setItems(d.items ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function scroll(dir: -1 | 1) {
    const track = trackRef.current;
    if (!track) return;
    const cardWidth = (track.firstElementChild as HTMLElement)?.offsetWidth ?? 240;
    track.scrollBy({ left: dir * (cardWidth + 16), behavior: "smooth" });
  }

  function onScroll() {
    const track = trackRef.current;
    if (!track) return;
    const cardWidth = (track.firstElementChild as HTMLElement)?.offsetWidth ?? 240;
    setActiveIdx(Math.round(track.scrollLeft / (cardWidth + 16)));
  }

  if (loading) {
    return (
      <div className="flex gap-4 px-5 sm:px-8 lg:px-12 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="w-56 sm:w-64 flex-shrink-0 rounded-2xl overflow-hidden shimmer" style={{ height: 220 }} />
        ))}
      </div>
    );
  }

  if (!items.length) return null;

  return (
    <div className="relative">
      {/* Arrow: left */}
      <button
        onClick={() => scroll(-1)}
        className="absolute left-1 sm:left-4 top-[40%] -translate-y-1/2 z-10 w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 hidden sm:flex"
        style={{ background: "rgba(7,7,15,0.85)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(8px)" }}
      >
        <ChevronLeft className="w-4 h-4 text-[var(--text-primary)]" />
      </button>

      {/* Arrow: right */}
      <button
        onClick={() => scroll(1)}
        className="absolute right-1 sm:right-4 top-[40%] -translate-y-1/2 z-10 w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 hidden sm:flex"
        style={{ background: "rgba(7,7,15,0.85)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(8px)" }}
      >
        <ChevronRight className="w-4 h-4 text-[var(--text-primary)]" />
      </button>

      {/* Track */}
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory px-5 sm:px-12 pb-3"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {items.map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.4, delay: Math.min(i * 0.07, 0.4), ease: [0.25, 1, 0.5, 1] }}
          >
            {item.type === "video"
              ? <VideoCard item={item} isActive={i === activeIdx} />
              : <AudioCard item={item} isActive={i === activeIdx} />
            }
          </motion.div>
        ))}
        {/* Trailing spacer */}
        <div className="flex-shrink-0 w-1" />
      </div>

      {/* Dot indicators */}
      <div className="flex items-center justify-center gap-1.5 mt-3">
        {items.map((_, i) => (
          <button
            key={i}
            onClick={() => {
              const track = trackRef.current;
              if (!track) return;
              const cardWidth = (track.firstElementChild as HTMLElement)?.offsetWidth ?? 240;
              track.scrollTo({ left: i * (cardWidth + 16), behavior: "smooth" });
            }}
            className={`rounded-full transition-all duration-300 ${i === activeIdx ? "w-4 h-1.5 bg-[var(--accent-red)]" : "w-1.5 h-1.5 bg-[var(--text-faint)]"}`}
          />
        ))}
      </div>
    </div>
  );
}
