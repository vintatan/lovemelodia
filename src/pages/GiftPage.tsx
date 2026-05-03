import { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";

interface GiftData {
  shareId: string;
  templateId: string;
  occasion: string;
  templateColor: string;
  message: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  printTagUrl: string | null;
  audioUrl: string | null;
  title: string;
}

interface GiftPageProps {
  shareId: string;
}

function PlayButton({ audioUrl }: { audioUrl: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  function togglePlay() {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play().catch(() => {}); setPlaying(true); }
  }

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setProgress(a.duration ? a.currentTime / a.duration : 0);
    const onEnd = () => setPlaying(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnd);
    return () => { a.removeEventListener("timeupdate", onTime); a.removeEventListener("ended", onEnd); };
  }, []);

  return (
    <div className="flex flex-col items-center gap-3">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      <motion.button
        onClick={togglePlay}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="w-20 h-20 rounded-full flex items-center justify-center text-white shadow-xl text-3xl"
        style={{ background: "linear-gradient(135deg, #9B2335, #E91E8C)" }}
      >
        {playing ? "⏸" : "▶️"}
      </motion.button>
      {/* Progress bar */}
      <div className="w-full max-w-xs h-1.5 bg-rose-200 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-200"
          style={{ width: `${progress * 100}%`, background: "#9B2335" }}
        />
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse space-y-4 max-w-sm mx-auto">
      <div className="w-full aspect-square bg-rose-100 rounded-2xl" />
      <div className="h-4 bg-rose-100 rounded w-3/4 mx-auto" />
      <div className="h-4 bg-rose-100 rounded w-1/2 mx-auto" />
      <div className="w-20 h-20 bg-rose-100 rounded-full mx-auto" />
    </div>
  );
}

export default function GiftPage({ shareId }: GiftPageProps) {
  const [data, setData] = useState<GiftData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/public/gift/${shareId}`)
      .then(r => {
        if (!r.ok) throw new Error("Gift card tidak ditemukan");
        return r.json() as Promise<GiftData>;
      })
      .then(d => { setData(d); setLoading(false); })
      .catch(err => { setError((err as Error).message); setLoading(false); });
  }, [shareId]);

  function copyLink() {
    navigator.clipboard.writeText(`https://lovemelodia.com/gift/${shareId}`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-10"
      style={{
        background: "linear-gradient(160deg, #FFF8F0 0%, #FFE4CC 50%, #FFD4B0 100%)",
      }}
    >
      {loading && (
        <div className="w-full max-w-sm">
          <SkeletonCard />
        </div>
      )}

      {error && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <div className="text-5xl">🎁</div>
          <h2 className="text-xl font-bold text-rose-800">Hmm, link ini tidak valid</h2>
          <p className="text-rose-600 text-sm">{error}</p>
          <a href="/" className="text-rose-700 underline text-sm">
            Buat gift card-mu sendiri →
          </a>
        </motion.div>
      )}

      {!loading && data && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full max-w-sm space-y-6"
        >
          {/* Gift card image */}
          {data.imageUrl ? (
            <motion.img
              src={data.imageUrl}
              alt="Gift Card"
              className="w-full rounded-2xl shadow-2xl"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.4 }}
            />
          ) : (
            <div
              className="w-full aspect-square rounded-2xl flex items-center justify-center text-white shadow-xl"
              style={{ background: `linear-gradient(135deg, ${data.templateColor}, #333)` }}
            >
              <div className="text-center space-y-2">
                <div className="text-5xl">🎁</div>
                <p className="font-bold text-lg px-6">{data.occasion}</p>
              </div>
            </div>
          )}

          {/* Message */}
          {data.message && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="bg-white/80 backdrop-blur rounded-xl px-5 py-4 shadow-sm text-center"
            >
              <p className="text-rose-900 italic text-base leading-relaxed">"{data.message}"</p>
            </motion.div>
          )}

          {/* Audio player */}
          {data.audioUrl && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="space-y-2"
            >
              <p className="text-center text-rose-700 text-sm font-medium">
                Dengerin lagunya 🎧
              </p>
              <PlayButton audioUrl={data.audioUrl} />
              <p className="text-center text-rose-500 text-xs">{data.title}</p>
            </motion.div>
          )}

          {/* Download buttons */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-2.5"
          >
            {data.imageUrl && (
              <a
                href={data.imageUrl}
                download
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-white text-sm font-semibold shadow-sm"
                style={{ background: "#9B2335" }}
              >
                ⬇ Gambar (Feed / WA)
              </a>
            )}
            {data.videoUrl && (
              <a
                href={data.videoUrl}
                download
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-white text-sm font-semibold shadow-sm"
                style={{ background: "#6A1550" }}
              >
                ⬇ Video (Stories / TikTok)
              </a>
            )}
            {data.printTagUrl && (
              <a
                href={data.printTagUrl}
                download
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold shadow-sm"
                style={{ background: "white", color: "#9B2335", border: "1.5px solid #9B2335" }}
              >
                🖨 Print Tag (Buket / Cokelat)
              </a>
            )}
            <button
              onClick={copyLink}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold transition-all"
              style={{ background: copied ? "#e8f5e9" : "#f3f4f6", color: copied ? "#2e7d32" : "#555" }}
            >
              {copied ? "✓ Disalin!" : "🔗 Copy Link"}
            </button>
          </motion.div>

          {/* Print tag helper text */}
          {data.printTagUrl && (
            <p className="text-center text-rose-400 text-xs">
              Print &amp; tempel ke buket atau kotak cokelat kamu!
            </p>
          )}

          {/* Footer */}
          <div className="text-center pt-2">
            <a
              href="/"
              className="text-rose-500 text-xs hover:underline"
            >
              Dibuat dengan Lovemelodia 🎁 · lovemelodia.com
            </a>
          </div>
        </motion.div>
      )}
    </div>
  );
}
