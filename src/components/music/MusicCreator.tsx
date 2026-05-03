import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mic } from "lucide-react";
import { apiFetch } from "../../lib/api.ts";
import { RotatingText } from "../UI.tsx";
import GiftCardCreator from "./GiftCardCreator.tsx";

/* ── Loading messages ────────────────────────────────────────────── */
const GIFT_LOADING_MSGS = [
  "AI lagi bikin lagunya untukmu... 🎵",
  "Merangkai melodi yang tepat...",
  "Nuansin emosi di setiap nada...",
  "Hampir jadi, sebentar lagi! 🎁",
  "Finishing touches...",
];

/* ── Occasion definitions ────────────────────────────────────────── */
interface Occasion {
  id: string;
  emoji: string;
  label: string;
  prompt: string;
}

const OCCASIONS: Occasion[] = [
  { id: "birthday",    emoji: "🎂", label: "Ulang Tahun",  prompt: "Upbeat birthday song with warm celebratory feeling, joyful and personal, energetic pop style" },
  { id: "lover",       emoji: "💕", label: "Untuk Kekasih", prompt: "Romantic ballad with tender emotional depth, intimate and heartfelt, soft piano and strings" },
  { id: "mother",      emoji: "🌸", label: "Untuk Ibu",    prompt: "Warm nurturing melody with gratitude and deep love, gentle and emotional, acoustic guitar" },
  { id: "friendship",  emoji: "🤝", label: "Persahabatan", prompt: "Uplifting song about bonds and shared memories, nostalgic and joyful, indie pop feel" },
  { id: "anniversary", emoji: "💍", label: "Anniversary",  prompt: "Elegant romantic piece with timeless quality, sophisticated and loving, orchestral pop" },
  { id: "father",      emoji: "👨", label: "Untuk Ayah",   prompt: "Strong yet tender melody expressing gratitude and admiration, warm acoustic folk" },
  { id: "graduation",  emoji: "🎓", label: "Wisuda",       prompt: "Triumphant celebratory melody with hope and new beginnings, cinematic and uplifting" },
  { id: "wedding",     emoji: "💒", label: "Pernikahan",   prompt: "Beautiful wedding ballad with eternal love theme, orchestral and deeply emotional" },
  { id: "gratitude",   emoji: "🙏", label: "Terima Kasih", prompt: "Heartfelt gratitude song with warmth and sincerity, gentle acoustic and vocal" },
  { id: "ramadan",     emoji: "🌙", label: "Ramadan",      prompt: "Spiritual and peaceful Ramadan melody with reverence and community warmth, soft and devotional" },
  { id: "christmas",   emoji: "🎄", label: "Natal",        prompt: "Joyful Christmas song with warmth and family feeling, festive and heartwarming" },
  { id: "custom",      emoji: "✨", label: "Bebas",         prompt: "" },
];

const BURGUNDY = "#9B2335";
const MAX_RECORD_SECONDS = 30;

/* ── Story question sets ─────────────────────────────────────────── */
const STORY_QUESTIONS: Record<string, string[]> = {
  birthday: [
    "Apa pencapaian terbesar orang ini yang kamu paling bangga?",
    "Ceritain satu momen lucu atau tak terlupakan bersama dia.",
    "Kalau bisa kasih satu kalimat semangat buat dia, apa yang mau kamu bilang?",
  ],
  mother: [
    "Apa kenangan paling berkesan yang kamu punya bersama ibumu?",
    "Kalimat atau nasihat ibu yang selalu kamu ingat sampai sekarang?",
    "Momen apa yang paling bikin kamu merasa ibumu benar-benar ada buat kamu?",
    "Kalau bisa bilang satu hal ke ibu sekarang, apa itu?",
  ],
  lover: [
    "Momen pertama kamu sadar kamu jatuh cinta sama dia?",
    "Hal terkecil yang dia lakuin yang bikin kamu senyum sendiri?",
    "Kalau harus describe dia dalam satu lagu, genre apa dan kenapa?",
  ],
  friendship: [
    "Kenangan paling lucu atau berkesan kalian berdua?",
    "Apa yang kamu paling syukuri dari persahabatan ini?",
    "Kalau dia lagi jauh, apa yang paling kamu kangen?",
  ],
  anniversary: [
    "Momen paling berkesan dari perjalanan kalian bersama?",
    "Hal apa yang paling kamu cintai dari dia sekarang — yang mungkin tidak kamu lihat di awal?",
    "Kalau bisa ulang satu hari bersama dia, hari apa itu?",
  ],
  graduation: [
    "Perjalanan terberat apa yang dia lalui untuk sampai di sini?",
    "Apa yang bikin kamu paling bangga sama dia?",
    "Harapan apa yang kamu doakan buat masa depannya?",
  ],
  father: [
    "Momen paling berkesan bersama ayahmu yang tidak bisa kamu lupakan?",
    "Hal apa yang kamu pelajari dari ayah yang masih kamu bawa sampai sekarang?",
    "Apa yang pengen kamu bilang ke ayah yang belum pernah terucap?",
  ],
};

const STORY_QUESTIONS_DEFAULT = [
  "Siapa yang ingin kamu kirimi lagu ini?",
  "Momen apa yang ingin kamu rayakan atau kenang?",
  "Perasaan apa yang ingin kamu sampaikan lewat lagu ini?",
];

/* ── Audio Player ────────────────────────────────────────────────── */
function AudioPlayer({ audioUrl }: { audioUrl: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.load();
    const onTime   = () => setCurrentTime(a.currentTime);
    const onLoaded = () => setDuration(a.duration);
    const onEnded  = () => setPlaying(false);
    const onError  = () => setLoadError(true);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onLoaded);
    a.addEventListener("ended", onEnded);
    a.addEventListener("error", onError);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onLoaded);
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("error", onError);
    };
  }, [audioUrl]);

  async function togglePlay() {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      try {
        await a.play();
        setPlaying(true);
      } catch (err) {
        console.error("Audio play failed:", err);
        setLoadError(true);
      }
    }
  }

  function seek(e: React.ChangeEvent<HTMLInputElement>) {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Number(e.target.value);
  }

  function fmt(s: number) {
    if (!isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    return `${m}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
  }

  if (loadError) {
    return (
      <div className="card-glass-red p-4 text-center space-y-2">
        <p className="text-sm text-[var(--text-muted)]">Gagal load audio. Coba download langsung.</p>
      </div>
    );
  }

  return (
    <div className="card-glass-red p-4 space-y-3">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} src={audioUrl} preload="auto" crossOrigin="anonymous" />

      <div className="flex items-end justify-center gap-px h-12 px-2">
        {Array.from({ length: 48 }, (_, i) => (
          <div
            key={i}
            className={`flex-1 rounded-full ${playing ? "waveform-bar" : ""}`}
            style={{
              height: `${20 + Math.sin(i * 0.6) * 14 + Math.cos(i * 0.3) * 8}%`,
              background: playing
                ? `hsl(${350 - i * 1.5}, 88%, ${52 + Math.sin(i * 0.5) * 14}%)`
                : `rgba(255,45,85,${0.15 + Math.sin(i * 0.4) * 0.1})`,
              transition: "background 0.35s ease",
              animationDelay: `${i * 0.038}s`,
            }}
          />
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => void togglePlay()}
          className="w-11 h-11 rounded-full bg-gradient-red flex items-center justify-center shadow-glow flex-shrink-0 transition-transform active:scale-90"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="white">
              <rect x="6" y="4" width="4" height="16" rx="1.5"/>
              <rect x="14" y="4" width="4" height="16" rx="1.5"/>
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="white" style={{ marginLeft: 2 }}>
              <polygon points="5,3 19,12 5,21"/>
            </svg>
          )}
        </button>

        <div className="flex-1 space-y-1.5">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={seek}
            className="w-full"
            style={{ accentColor: "var(--accent-red)", height: 3 }}
          />
          <div className="flex justify-between text-[11px] text-[var(--text-faint)] font-mono">
            <span>{fmt(currentTime)}</span>
            <span>{fmt(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Voice Recorder Component ────────────────────────────────────── */
type RecorderState = "idle" | "permission_denied" | "recording" | "recorded";

interface VoiceRecorderProps {
  onBlobReady: (blob: Blob, mimeType: string) => void;
}

function VoiceRecorder({ onBlobReady }: VoiceRecorderProps) {
  const [recorderState, setRecorderState] = useState<RecorderState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedMime, setRecordedMime] = useState<string>("");
  const [waveBars, setWaveBars] = useState<number[]>(Array(32).fill(8));

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopAllRefs();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopAllRefs() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (autoStopRef.current) { clearTimeout(autoStopRef.current); autoStopRef.current = null; }
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }

  function animateWaveform() {
    if (!analyserRef.current) return;
    const data = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(data);

    // Sample 32 evenly-spaced bins from the frequency data
    const bars: number[] = [];
    const step = Math.floor(data.length / 32);
    for (let i = 0; i < 32; i++) {
      const val = data[i * step] ?? 0;
      // Map 0–255 to 4–60px
      bars.push(4 + (val / 255) * 56);
    }
    setWaveBars(bars);
    animFrameRef.current = requestAnimationFrame(animateWaveform);
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Set up AnalyserNode for waveform visualisation
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // mimeType fallback: Chrome/Firefox/Android → webm+opus; iOS Safari → mp4
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "audio/webm"; // final fallback

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stopAllRefs();
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setRecordedBlob(blob);
        setRecordedMime(mimeType);
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setRecorderState("recorded");
        setWaveBars(Array(32).fill(8));
      };

      recorder.start();
      setRecorderState("recording");
      setElapsed(0);

      // Elapsed timer
      timerRef.current = setInterval(() => {
        setElapsed(prev => prev + 1);
      }, 1000);

      // Auto-stop at MAX_RECORD_SECONDS
      autoStopRef.current = setTimeout(() => {
        stopRecording();
      }, MAX_RECORD_SECONDS * 1000);

      // Start waveform animation
      animFrameRef.current = requestAnimationFrame(animateWaveform);

    } catch (err: any) {
      console.error("[VoiceRecorder] getUserMedia failed:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setRecorderState("permission_denied");
      }
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (autoStopRef.current) { clearTimeout(autoStopRef.current); autoStopRef.current = null; }
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; }
  }

  function handleButtonClick() {
    if (recorderState === "idle") {
      void startRecording();
    } else if (recorderState === "recording") {
      stopRecording();
    }
  }

  function handleReRecord() {
    if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
    setRecordedBlob(null);
    setRecordedMime("");
    setElapsed(0);
    setWaveBars(Array(32).fill(8));
    setRecorderState("idle");
  }

  function handleUseRecording() {
    if (recordedBlob) {
      onBlobReady(recordedBlob, recordedMime);
    }
  }

  function fmtElapsed(s: number) {
    return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
  }

  // ── Permission denied state ─────────────────────────────────────
  if (recorderState === "permission_denied") {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <div className="text-4xl">🎤</div>
        <p className="text-sm font-medium text-[var(--text-primary)]">
          Izinkan akses mikrofon untuk merekam nada
        </p>
        <button
          onClick={() => { setRecorderState("idle"); void startRecording(); }}
          className="px-5 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: BURGUNDY }}
        >
          Buka pengaturan
        </button>
      </div>
    );
  }

  // ── Recorded state ──────────────────────────────────────────────
  if (recorderState === "recorded") {
    return (
      <div className="flex flex-col items-center gap-4">
        {/* Duration badge */}
        <div
          className="px-4 py-1.5 rounded-full text-sm font-mono font-bold text-white"
          style={{ background: BURGUNDY }}
        >
          {fmtElapsed(elapsed)}
        </div>

        {/* Native audio preview */}
        {previewUrl && (
          /* eslint-disable-next-line jsx-a11y/media-has-caption */
          <audio controls src={previewUrl} className="w-full" style={{ borderRadius: "0.75rem" }} />
        )}

        {/* Actions */}
        <div className="flex gap-3 w-full">
          <button
            onClick={handleReRecord}
            className="flex-1 py-2.5 rounded-xl card-elevated text-sm font-semibold transition-all active:scale-95"
            style={{ color: "var(--text-muted)" }}
          >
            ✓ Rekam ulang
          </button>
          <button
            onClick={handleUseRecording}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold transition-all active:scale-95"
            style={{ background: BURGUNDY }}
          >
            Pakai Nada Ini 🎵
          </button>
        </div>
      </div>
    );
  }

  // ── Idle + Recording states ─────────────────────────────────────
  return (
    <div className="flex flex-col items-center gap-5 py-4">

      {/* Caption */}
      {recorderState === "idle" && (
        <div className="text-center space-y-1">
          <p className="text-sm font-medium text-[var(--text-primary)]">Nyanyikan atau bersenandung melodinya</p>
          <p className="text-xs text-[var(--text-faint)]">Maks. {MAX_RECORD_SECONDS} detik</p>
        </div>
      )}

      {/* Recording: countdown + waveform */}
      {recorderState === "recording" && (
        <div className="w-full space-y-3">
          {/* Countdown */}
          <p className="text-center font-mono font-bold text-2xl" style={{ color: BURGUNDY }}>
            {MAX_RECORD_SECONDS - elapsed}s
          </p>

          {/* Real-time waveform — 32 bars driven by AnalyserNode */}
          <div className="w-full h-16 flex items-end justify-center gap-[3px]">
            {waveBars.map((h, i) => (
              <div
                key={i}
                style={{
                  width: 6,
                  height: h,
                  maxHeight: 60,
                  background: BURGUNDY,
                  borderRadius: 3,
                  transition: "height 0.08s ease",
                }}
              />
            ))}
          </div>

          <p className="text-center text-sm font-semibold" style={{ color: BURGUNDY }}>
            Rekam...
          </p>
        </div>
      )}

      {/* Record / Stop button */}
      <button
        onClick={handleButtonClick}
        aria-label={recorderState === "recording" ? "Stop recording" : "Start recording"}
        className="relative w-20 h-20 rounded-full flex items-center justify-center transition-transform active:scale-90 shadow-glow"
        style={{
          background: recorderState === "recording" ? "#dc2626" : BURGUNDY,
        }}
      >
        {/* Pulsing ring when recording */}
        {recorderState === "recording" && (
          <span
            className="absolute inset-0 rounded-full"
            style={{
              border: `3px solid rgba(220,38,38,0.5)`,
              animation: "waveform-bounce 1s ease-in-out infinite",
              transform: "scale(1.25)",
            }}
          />
        )}
        {recorderState === "recording" ? (
          // Stop icon
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
            <rect x="5" y="5" width="14" height="14" rx="2" />
          </svg>
        ) : (
          <Mic size={28} color="white" />
        )}
      </button>
    </div>
  );
}

/* ── Music Creator ───────────────────────────────────────────────── */
interface MusicCreatorProps {
  token: string;
  credits: number;
  onCreditsUpdate: (n: number) => void;
  onTopUp: () => void;
}

type Phase = "idle" | "selecting_occasion" | "uploading" | "generating" | "done" | "failed";
type InputMode = "text" | "voice" | "story";
type StoryStep = "select_occasion" | "questions" | "summary" | "building";

export default function MusicCreator({ token, credits, onCreditsUpdate, onTopUp }: MusicCreatorProps) {
  const [inputMode, setInputMode] = useState<InputMode>("text");
  const [phase, setPhase] = useState<Phase>("idle");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [customText, setCustomText] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [trackTitle, setTrackTitle] = useState("");
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [showGiftCard, setShowGiftCard] = useState(false);

  // Voice mode state
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [voiceMime, setVoiceMime] = useState<string>("");
  const [voiceReady, setVoiceReady] = useState(false); // true when blob chosen and occasion selected

  // Story mode state
  const [storyStep, setStoryStep] = useState<StoryStep>("select_occasion");
  const [storyOccasionId, setStoryOccasionId] = useState<string | null>(null);
  const [storyAnswers, setStoryAnswers] = useState<string[]>([]);
  const [storyCurrentQ, setStoryCurrentQ] = useState(0);
  const [storyInput, setStoryInput] = useState("");
  const [storyTypedQuestion, setStoryTypedQuestion] = useState("");
  const [storyIsTyping, setStoryIsTyping] = useState(false);
  const [fromStory, setFromStory] = useState(false); // true = show personalization chip

  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearTimeout(pollRef.current); pollRef.current = null; }
  }, []);
  useEffect(() => () => stopPolling(), [stopPolling]);

  const selectedOccasion = OCCASIONS.find(o => o.id === selectedId) ?? null;

  // ── Story typing animation ──────────────────────────────────────
  const storyQuestions = storyOccasionId
    ? (STORY_QUESTIONS[storyOccasionId] ?? STORY_QUESTIONS_DEFAULT)
    : STORY_QUESTIONS_DEFAULT;

  useEffect(() => {
    if (storyStep !== "questions") return;
    const fullQuestion = storyQuestions[storyCurrentQ] ?? "";
    setStoryTypedQuestion("");
    setStoryIsTyping(true);
    let i = 0;
    function typeNext() {
      i++;
      setStoryTypedQuestion(fullQuestion.slice(0, i));
      if (i < fullQuestion.length) {
        typingRef.current = setTimeout(typeNext, 40);
      } else {
        setStoryIsTyping(false);
      }
    }
    typingRef.current = setTimeout(typeNext, 40);
    return () => { if (typingRef.current) clearTimeout(typingRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyCurrentQ, storyStep]);

  function selectStoryOccasion(id: string) {
    setStoryOccasionId(id);
    setStoryAnswers([]);
    setStoryCurrentQ(0);
    setStoryInput("");
    setStoryStep("questions");
  }

  function handleStoryNext() {
    const trimmed = storyInput.trim();
    const newAnswers = [...storyAnswers, trimmed || "(dilewati)"];
    setStoryAnswers(newAnswers);
    setStoryInput("");
    if (storyCurrentQ + 1 < storyQuestions.length) {
      setStoryCurrentQ(storyCurrentQ + 1);
    } else {
      setStoryStep("summary");
    }
  }

  function handleStorySkip() {
    const newAnswers = [...storyAnswers, "(dilewati)"];
    setStoryAnswers(newAnswers);
    setStoryInput("");
    if (storyCurrentQ + 1 < storyQuestions.length) {
      setStoryCurrentQ(storyCurrentQ + 1);
    } else {
      setStoryStep("summary");
    }
  }

  function resetStory() {
    setStoryStep("select_occasion");
    setStoryOccasionId(null);
    setStoryAnswers([]);
    setStoryCurrentQ(0);
    setStoryInput("");
    setStoryTypedQuestion("");
    setStoryIsTyping(false);
  }

  async function handleGenerateFromStory() {
    if (!storyOccasionId || credits < 1) { if (credits < 1) onTopUp(); return; }
    setStoryStep("building");
    setFromStory(true);

    let enhancedPrompt = OCCASIONS.find(o => o.id === storyOccasionId)?.prompt ?? "";

    try {
      const buildRes = await apiFetch("/api/music/build-story", token, {
        method: "POST",
        body: JSON.stringify({ occasion: storyOccasionId, answers: storyAnswers }),
      });
      if (buildRes.ok) {
        const buildData = await buildRes.json() as { enhancedPrompt?: string; lyricHints?: string };
        if (buildData.enhancedPrompt) enhancedPrompt = buildData.enhancedPrompt;
      }
    } catch {
      // fallback to default occasion prompt — already set above
    }

    const occasion = OCCASIONS.find(o => o.id === storyOccasionId);
    const label = occasion?.label ?? storyOccasionId;
    const title = `${label} — Lovemelodia`;

    setPhase("generating");
    setErrorMsg("");
    setAudioUrl(null);

    try {
      const res = await apiFetch("/api/music/generate", token, {
        method: "POST",
        body: JSON.stringify({
          prompt: label,
          enhancedPrompt,
          title,
        }),
      });
      const data = await res.json() as { jobId?: string; creditsRemaining?: number; error?: string };
      if (res.status === 402) { onTopUp(); setPhase("idle"); return; }
      if (!res.ok) throw new Error(data.error ?? "Gagal memulai generasi");
      if (data.creditsRemaining !== undefined) onCreditsUpdate(data.creditsRemaining);
      setCurrentJobId(data.jobId!);
      setTrackTitle(title);
      pollStatus(data.jobId!);
    } catch (err: any) {
      setPhase("failed");
      setErrorMsg(err.message);
    }
  }

  function selectOccasion(id: string) {
    setSelectedId(id);
    setPhase("selecting_occasion");
    if (id !== "custom") setCustomText("");
  }

  const effectivePrompt = selectedOccasion?.id === "custom" ? customText.trim() : (selectedOccasion?.prompt ?? "");
  const canGenerate = selectedOccasion !== null && (selectedOccasion.id !== "custom" || customText.trim().length > 0);

  // Voice mode: can generate when blob exists and occasion is selected
  const canGenerateVoice = voiceBlob !== null && selectedOccasion !== null;

  // Called by VoiceRecorder when user has a recording ready
  function handleBlobReady(blob: Blob, mime: string) {
    setVoiceBlob(blob);
    setVoiceMime(mime);
    setVoiceReady(true);
  }

  // ── Text mode generation ────────────────────────────────────────
  async function handleGenerate() {
    if (!selectedOccasion || !canGenerate) return;
    if (credits < 1) { onTopUp(); return; }

    setPhase("generating");
    setErrorMsg("");
    setAudioUrl(null);

    const label = selectedOccasion.label;
    const title = `${label} — Lovemelodia`;

    try {
      const res = await apiFetch("/api/music/generate", token, {
        method: "POST",
        body: JSON.stringify({
          prompt: label,
          enhancedPrompt: effectivePrompt,
          title,
        }),
      });
      const data = await res.json() as { jobId?: string; creditsRemaining?: number; error?: string };
      if (res.status === 402) { onTopUp(); setPhase("selecting_occasion"); return; }
      if (!res.ok) throw new Error(data.error ?? "Gagal memulai generasi");
      if (data.creditsRemaining !== undefined) onCreditsUpdate(data.creditsRemaining);
      setCurrentJobId(data.jobId!);
      setTrackTitle(title);
      pollStatus(data.jobId!);
    } catch (err: any) {
      setPhase("failed");
      setErrorMsg(err.message);
    }
  }

  // ── Voice mode generation ───────────────────────────────────────
  async function handleGenerateFromMelody() {
    if (!voiceBlob || !selectedOccasion) return;
    if (credits < 1) { onTopUp(); return; }

    setPhase("uploading");
    setErrorMsg("");
    setAudioUrl(null);

    try {
      // Step 1: upload the recording
      const ext = voiceMime.includes("mp4") || voiceMime.includes("m4a") ? "mp4" : "webm";
      const formData = new FormData();
      formData.append("recording", voiceBlob, `melody.${ext}`);

      const uploadRes = await apiFetch("/api/music/upload-recording", token, {
        method: "POST",
        body: formData,
      });
      const uploadData = await uploadRes.json() as { url?: string; error?: string };
      if (!uploadRes.ok) throw new Error(uploadData.error ?? "Upload rekaman gagal");
      const recordingUrl = uploadData.url!;

      // Step 2: kick off generation
      setPhase("generating");
      const genRes = await apiFetch("/api/music/generate-from-melody", token, {
        method: "POST",
        body: JSON.stringify({
          recordingUrl,
          occasion: selectedOccasion.id,
          duration: 30,
        }),
      });
      const genData = await genRes.json() as { jobId?: string; creditsRemaining?: number; error?: string };
      if (genRes.status === 402) { onTopUp(); setPhase("selecting_occasion"); return; }
      if (!genRes.ok) throw new Error(genData.error ?? "Gagal memulai generasi");
      if (genData.creditsRemaining !== undefined) onCreditsUpdate(genData.creditsRemaining);
      setCurrentJobId(genData.jobId!);
      setTrackTitle(`${selectedOccasion.label} — Lovemelodia (Melodi)`);
      pollStatus(genData.jobId!);
    } catch (err: any) {
      setPhase("failed");
      setErrorMsg(err.message);
    }
  }

  function pollStatus(id: string) {
    pollRef.current = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/music/status/${id}`, token, { method: "GET" });
        const data = await res.json() as { status: string; audioUrl?: string; error?: string };
        if (data.status === "completed" && data.audioUrl) {
          setAudioUrl(data.audioUrl);
          setPhase("done");
        } else if (data.status === "failed") {
          setPhase("failed");
          setErrorMsg(data.error ?? "Generasi musik gagal. Kredit dikembalikan.");
        } else {
          pollStatus(id);
        }
      } catch {
        pollStatus(id);
      }
    }, 3000);
  }

  function handleReset() {
    stopPolling();
    setPhase("idle");
    setSelectedId(null);
    setCustomText("");
    setAudioUrl(null);
    setCurrentJobId(null);
    setErrorMsg("");
    setTrackTitle("");
    setShowGiftCard(false);
    setVoiceBlob(null);
    setVoiceMime("");
    setVoiceReady(false);
    setFromStory(false);
    resetStory();
  }

  const isActivePhase = phase === "generating" || phase === "uploading" || phase === "done" || phase === "failed";

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-2">
      {/* Header */}
      <div className="text-center space-y-1.5">
        <h2 className="heading-display text-gradient-fire" style={{ fontSize: "clamp(1.6rem, 5vw, 2.2rem)" }}>
          Bikin Musik Gift
        </h2>
        <p className="text-sm text-[var(--text-muted)]">Pilih momen, AI yang bikin lagunya 🎁</p>
      </div>

      {/* ── Mode Toggle (hidden during generation/done/failed) ── */}
      {!isActivePhase && (
        <div
          className="flex rounded-2xl p-1 gap-1"
          style={{ background: "var(--card-bg, rgba(255,255,255,0.05))", border: "1.5px solid rgba(155,35,53,0.15)" }}
        >
          {(["text", "story", "voice"] as const).map((mode) => {
            const isActive = inputMode === mode;
            return (
              <button
                key={mode}
                onClick={() => { setInputMode(mode); if (mode !== "story") resetStory(); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
                style={{
                  background: isActive ? BURGUNDY : "transparent",
                  color: isActive ? "#fff" : "var(--text-muted)",
                }}
              >
                {mode === "text" ? "✏️ Tulis Momen" : mode === "story" ? "📖 Ceritakan" : "🎤 Hum Lagumu"}
              </button>
            );
          })}
        </div>
      )}

      <AnimatePresence mode="wait">

        {/* ── TEXT MODE: IDLE / SELECTING OCCASION ── */}
        {inputMode === "text" && (phase === "idle" || phase === "selecting_occasion") && (
          <motion.div
            key="text-selector"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
            className="space-y-5"
          >
            {/* Occasion grid */}
            <div className="space-y-2">
              <p className="label-caps text-[var(--text-faint)]">Pilih Momen</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                {OCCASIONS.map(occ => {
                  const isSelected = selectedId === occ.id;
                  return (
                    <button
                      key={occ.id}
                      onClick={() => selectOccasion(occ.id)}
                      className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl transition-all duration-200 active:scale-95"
                      style={{
                        background: isSelected ? "rgba(155,35,53,0.10)" : "var(--card-bg, rgba(255,255,255,0.04))",
                        border: isSelected
                          ? `2px solid ${BURGUNDY}`
                          : "2px solid transparent",
                        outline: isSelected ? `0 0 0 2px rgba(155,35,53,0.25)` : "none",
                        boxShadow: isSelected ? `0 0 0 2px rgba(155,35,53,0.20)` : "none",
                      }}
                    >
                      <span style={{ fontSize: "1.75rem", lineHeight: 1 }}>{occ.emoji}</span>
                      <span className="text-[11px] font-semibold text-center leading-tight" style={{ color: isSelected ? BURGUNDY : "var(--text-muted)" }}>
                        {occ.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom textarea — only when "Bebas" selected */}
            <AnimatePresence>
              {selectedId === "custom" && (
                <motion.div
                  key="custom-textarea"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-1.5 pt-1">
                    <p className="label-caps text-[var(--text-faint)]">Deskripsiin musiknya</p>
                    <textarea
                      value={customText}
                      onChange={e => setCustomText(e.target.value.slice(0, 120))}
                      placeholder="Contoh: lagu galau tentang rindu kampung halaman..."
                      rows={3}
                      maxLength={120}
                      className="w-full card-elevated px-4 py-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-faint)] resize-none focus:outline-none transition-colors"
                      style={{ borderRadius: "1rem" }}
                      onFocus={e => (e.target.style.borderColor = `rgba(155,35,53,0.35)`)}
                      onBlur={e => (e.target.style.borderColor = "")}
                    />
                    <div className="text-right text-xs text-[var(--text-faint)]">{customText.length}/120</div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Generate CTA */}
            <button
              onClick={() => void handleGenerate()}
              disabled={!canGenerate}
              className="btn-primary w-full rounded-2xl py-4 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Bikin Lagu 🎵
            </button>

            {/* Credit info */}
            <p className="text-center text-xs text-[var(--text-faint)]">
              Biaya: <span className="font-bold" style={{ color: BURGUNDY }}>1 kredit</span>
              {" · "}
              Saldo: <span className={credits < 2 ? "text-red-400 font-bold" : "text-[var(--text-primary)] font-medium"}>{credits} kredit</span>
            </p>
          </motion.div>
        )}

        {/* ── VOICE MODE: IDLE / SELECTING OCCASION ── */}
        {inputMode === "voice" && (phase === "idle" || phase === "selecting_occasion") && (
          <motion.div
            key="voice-selector"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
            className="space-y-6"
          >
            {/* Voice Recorder */}
            <div
              className="rounded-2xl p-5"
              style={{ background: "var(--card-bg, rgba(255,255,255,0.04))", border: "1.5px solid rgba(155,35,53,0.12)" }}
            >
              <VoiceRecorder onBlobReady={handleBlobReady} />
            </div>

            {/* Occasion grid (shared, same as text mode) */}
            <div className="space-y-2">
              <p className="label-caps text-[var(--text-faint)]">Pilih Momen</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                {OCCASIONS.map(occ => {
                  if (occ.id === "custom") return null; // custom not supported for melody mode
                  const isSelected = selectedId === occ.id;
                  return (
                    <button
                      key={occ.id}
                      onClick={() => selectOccasion(occ.id)}
                      className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl transition-all duration-200 active:scale-95"
                      style={{
                        background: isSelected ? "rgba(155,35,53,0.10)" : "var(--card-bg, rgba(255,255,255,0.04))",
                        border: isSelected
                          ? `2px solid ${BURGUNDY}`
                          : "2px solid transparent",
                        boxShadow: isSelected ? `0 0 0 2px rgba(155,35,53,0.20)` : "none",
                      }}
                    >
                      <span style={{ fontSize: "1.75rem", lineHeight: 1 }}>{occ.emoji}</span>
                      <span className="text-[11px] font-semibold text-center leading-tight" style={{ color: isSelected ? BURGUNDY : "var(--text-muted)" }}>
                        {occ.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Generate from melody CTA */}
            <button
              onClick={() => void handleGenerateFromMelody()}
              disabled={!canGenerateVoice}
              className="btn-primary w-full rounded-2xl py-4 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Bikin dari Melodi 🎵
            </button>

            {/* Credit info */}
            <p className="text-center text-xs text-[var(--text-faint)]">
              Biaya: <span className="font-bold" style={{ color: BURGUNDY }}>1 kredit</span>
              {" · "}
              Saldo: <span className={credits < 2 ? "text-red-400 font-bold" : "text-[var(--text-primary)] font-medium"}>{credits} kredit</span>
            </p>
          </motion.div>
        )}

        {/* ── STORY MODE: SELECT OCCASION ── */}
        {inputMode === "story" && (phase === "idle" || phase === "selecting_occasion") && storyStep === "select_occasion" && (
          <motion.div
            key="story-select"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
            className="space-y-5"
          >
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-[var(--text-primary)]">Ceritakan momenmu, AI yang bikin lagunya 💌</p>
              <p className="text-xs text-[var(--text-faint)]">Pilih dulu jenis lagunya</p>
            </div>
            <div className="space-y-2">
              <p className="label-caps text-[var(--text-faint)]">Pilih Momen</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                {OCCASIONS.filter(o => o.id !== "custom").map(occ => (
                  <button
                    key={occ.id}
                    onClick={() => selectStoryOccasion(occ.id)}
                    className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl transition-all duration-200 active:scale-95"
                    style={{
                      background: "var(--card-bg, rgba(255,255,255,0.04))",
                      border: "2px solid transparent",
                    }}
                  >
                    <span style={{ fontSize: "1.75rem", lineHeight: 1 }}>{occ.emoji}</span>
                    <span className="text-[11px] font-semibold text-center leading-tight" style={{ color: "var(--text-muted)" }}>
                      {occ.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── STORY MODE: QUESTION FLOW ── */}
        {inputMode === "story" && (phase === "idle" || phase === "selecting_occasion") && storyStep === "questions" && (
          <motion.div
            key={`story-q-${storyCurrentQ}`}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.28, ease: [0.25, 1, 0.5, 1] }}
            className="space-y-5"
          >
            {/* Progress */}
            <div className="flex items-center justify-between">
              <button
                onClick={resetStory}
                className="text-xs text-[var(--text-faint)] hover:text-[var(--text-muted)] transition-colors"
              >
                ← Ganti momen
              </button>
              <span className="text-xs font-medium" style={{ color: BURGUNDY }}>
                {storyCurrentQ + 1} dari {storyQuestions.length} pertanyaan
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-1 rounded-full" style={{ background: "rgba(155,35,53,0.12)" }}>
              <div
                className="h-1 rounded-full transition-all duration-500"
                style={{ width: `${((storyCurrentQ + 1) / storyQuestions.length) * 100}%`, background: BURGUNDY }}
              />
            </div>

            {/* Animated question */}
            <div
              className="rounded-2xl px-5 py-4 min-h-[72px]"
              style={{ background: "rgba(155,35,53,0.06)", border: "1.5px solid rgba(155,35,53,0.12)" }}
            >
              <p className="text-base font-semibold leading-relaxed" style={{ color: "var(--text-primary)" }}>
                {storyTypedQuestion}
                {storyIsTyping && (
                  <span
                    className="inline-block w-0.5 h-4 ml-0.5 align-middle"
                    style={{ background: BURGUNDY, animation: "waveform-bounce 0.7s ease-in-out infinite" }}
                  />
                )}
              </p>
            </div>

            {/* Answer input */}
            <div className="space-y-1.5">
              <textarea
                value={storyInput}
                onChange={e => setStoryInput(e.target.value.slice(0, 200))}
                placeholder="Ceritain di sini..."
                rows={4}
                maxLength={200}
                className="w-full card-elevated px-4 py-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-faint)] resize-none focus:outline-none transition-colors"
                style={{ borderRadius: "1rem" }}
                onFocus={e => (e.target.style.borderColor = `rgba(155,35,53,0.35)`)}
                onBlur={e => (e.target.style.borderColor = "")}
              />
              <div className="flex justify-between items-center">
                <button
                  onClick={handleStorySkip}
                  className="text-xs text-[var(--text-faint)] hover:text-[var(--text-muted)] transition-colors"
                >
                  Lewati →
                </button>
                <span className="text-xs text-[var(--text-faint)]">{storyInput.length}/200</span>
              </div>
            </div>

            {/* Next button */}
            <button
              onClick={handleStoryNext}
              disabled={storyInput.trim().length === 0}
              className="btn-primary w-full rounded-2xl py-4 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {storyCurrentQ + 1 < storyQuestions.length ? "Lanjut →" : "Lihat Rangkuman"}
            </button>
          </motion.div>
        )}

        {/* ── STORY MODE: SUMMARY ── */}
        {inputMode === "story" && (phase === "idle" || phase === "selecting_occasion") && storyStep === "summary" && (
          <motion.div
            key="story-summary"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
            className="space-y-5"
          >
            <div className="text-center space-y-1">
              <p className="text-sm font-bold text-[var(--text-primary)]">Ceritamu sudah siap ✨</p>
              <p className="text-xs text-[var(--text-faint)]">AI akan merangkai lagumu dari kisah ini</p>
            </div>

            {/* Q&A summary cards */}
            <div className="space-y-3">
              {storyQuestions.map((q, i) => (
                <div
                  key={i}
                  className="rounded-xl px-4 py-3 space-y-1.5"
                  style={{ background: "var(--card-bg, rgba(255,255,255,0.04))", border: "1px solid rgba(155,35,53,0.08)" }}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: BURGUNDY }}>
                    Pertanyaan {i + 1}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">{q}</p>
                  <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                    {storyAnswers[i] === "(dilewati)" ? <span className="italic text-[var(--text-faint)]">Dilewati</span> : storyAnswers[i]}
                  </p>
                </div>
              ))}
            </div>

            {/* CTA */}
            <button
              onClick={() => void handleGenerateFromStory()}
              disabled={credits < 1}
              className="btn-primary w-full rounded-2xl py-4 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Bikin Lagu dari Ceritamu 🎵
            </button>

            <div className="flex items-center justify-between">
              <button
                onClick={resetStory}
                className="text-xs text-[var(--text-faint)] hover:text-[var(--text-muted)] transition-colors"
              >
                ← Mulai ulang
              </button>
              <p className="text-xs text-[var(--text-faint)]">
                Biaya: <span className="font-bold" style={{ color: BURGUNDY }}>1 kredit</span>
                {" · "}
                Saldo: <span className={credits < 2 ? "text-red-400 font-bold" : "text-[var(--text-primary)] font-medium"}>{credits} kredit</span>
              </p>
            </div>
          </motion.div>
        )}

        {/* ── STORY MODE: BUILDING (waiting for build-story API) ── */}
        {inputMode === "story" && storyStep === "building" && (
          <motion.div
            key="story-building"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="text-center space-y-4 py-10"
          >
            <div
              className="w-12 h-12 rounded-full border-4 border-t-transparent mx-auto"
              style={{
                borderColor: `rgba(155,35,53,0.2)`,
                borderTopColor: BURGUNDY,
                animation: "spin 0.8s linear infinite",
              }}
            />
            <p className="font-medium text-[var(--text-primary)]">Merangkai ceritamu menjadi lagu... ✨</p>
          </motion.div>
        )}

        {/* ── UPLOADING ── */}
        {phase === "uploading" && (
          <motion.div
            key="uploading"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="text-center space-y-4 py-10"
          >
            <div
              className="w-12 h-12 rounded-full border-4 border-t-transparent mx-auto"
              style={{
                borderColor: `rgba(155,35,53,0.2)`,
                borderTopColor: BURGUNDY,
                animation: "spin 0.8s linear infinite",
              }}
            />
            <p className="font-medium text-[var(--text-primary)]">Mengunggah rekaman...</p>
          </motion.div>
        )}

        {/* ── GENERATING ── */}
        {phase === "generating" && (
          <motion.div
            key="loading"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
            className="text-center space-y-7 py-10"
          >
            <div className="flex items-end justify-center gap-0.5 h-20">
              {Array.from({ length: 28 }, (_, i) => (
                <div
                  key={i}
                  className="w-2 rounded-full waveform-bar"
                  style={{
                    height: `${28 + Math.sin(i * 0.7) * 18}%`,
                    background: `hsl(${350 - i * 3}, 90%, ${55 + Math.sin(i * 0.6) * 12}%)`,
                    animationDelay: `${i * 0.07}s`,
                  }}
                />
              ))}
            </div>

            <div className="space-y-2">
              <p className="font-bold text-[var(--text-primary)] text-base">
                <RotatingText messages={GIFT_LOADING_MSGS} interval={3500} />
              </p>
              <p className="text-sm text-[var(--text-muted)]">Biasanya butuh 2–3 menit. Sebentar ya 🎁</p>
              {fromStory && (
                <div className="flex justify-center pt-1">
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                    style={{ background: "rgba(155,35,53,0.10)", color: BURGUNDY, border: "1px solid rgba(155,35,53,0.18)" }}
                  >
                    ✨ Personalisasi dari ceritamu
                  </span>
                </div>
              )}
            </div>

            <div className="flex justify-center gap-1.5">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full"
                  style={{ background: "var(--accent-red)", animation: "waveform-bounce 1s ease-in-out infinite", animationDelay: `${i * 0.18}s` }}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* ── DONE ── */}
        {phase === "done" && audioUrl && (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
            className="space-y-5"
          >
            <div className="text-center space-y-2">
              <div className="text-4xl spring-in">🎉</div>
              <p className="font-bold text-[var(--text-primary)]">{trackTitle || "Lagumu sudah jadi!"}</p>
              <p className="text-sm text-[var(--text-muted)]">Dengerin dulu yuk! 🎧</p>
            </div>

            <AudioPlayer audioUrl={audioUrl} />

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleReset}
                className="flex-1 py-3.5 rounded-2xl card-elevated text-sm font-semibold transition-all hover:scale-[1.01] active:scale-[0.98]"
                style={{ color: "var(--text-muted)" }}
              >
                🔄 Bikin Ulang
              </button>
              <button
                onClick={() => setShowGiftCard(v => !v)}
                className="flex-1 py-3.5 rounded-2xl text-white text-sm font-bold transition-all hover:scale-[1.01] active:scale-[0.98]"
                style={{ background: BURGUNDY }}
              >
                {showGiftCard ? "✕ Tutup Gift Card" : "Buat Gift Card 🎁"}
              </button>
            </div>

            {/* Gift card creator */}
            <AnimatePresence>
              {showGiftCard && currentJobId && (
                <motion.div
                  key="giftcard-creator"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-2xl p-4"
                  style={{ background: "var(--card-bg, rgba(255,255,255,0.04))", border: "1.5px solid rgba(155,35,53,0.15)" }}
                >
                  <GiftCardCreator
                    token={token}
                    musicJobId={currentJobId}
                    trackTitle={trackTitle}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ── FAILED ── */}
        {phase === "failed" && (
          <motion.div
            key="failed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center space-y-4 py-10"
          >
            <div className="text-4xl">😓</div>
            <p className="font-bold text-red-400">Ada yang error nih</p>
            <p className="text-sm text-[var(--text-muted)]">{errorMsg || "Coba lagi ya, kredit udah dikembalikan."}</p>
            <button
              onClick={handleReset}
              className="px-6 py-2.5 rounded-xl card-elevated text-sm font-medium"
            >
              Coba lagi
            </button>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
