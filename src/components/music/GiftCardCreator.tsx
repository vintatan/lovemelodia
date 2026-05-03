import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { apiFetch } from "../../lib/api.ts";

const BURGUNDY = "#9B2335";
const ROSE_GOLD = "#E0B882";

interface Template {
  id: string;
  label: string;
  color: string;
}

interface GiftCardCreatorProps {
  token: string;
  musicJobId: string;
  trackTitle: string;
}

type GCPhase = "selecting" | "generating" | "polling" | "done" | "error";
type PhotoUploadState = "idle" | "uploading" | "done" | "error";
type VinylPhase = "idle" | "generating" | "polling" | "done" | "error";

interface GiftCardResult {
  shareId: string;
  imageUrl: string | null;
  videoUrl: string | null;
  printTagUrl: string | null;
  shareUrl: string;
}

interface VinylResult {
  vinylCardUrl: string | null;
  vinylVideoUrl: string | null;
}

export default function GiftCardCreator({ token, musicJobId, trackTitle }: GiftCardCreatorProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoUploadState, setPhotoUploadState] = useState<PhotoUploadState>("idle");
  const [photoErrorMsg, setPhotoErrorMsg] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [phase, setPhase] = useState<GCPhase>("selecting");
  const [result, setResult] = useState<GiftCardResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const photoErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Vinyl state
  const [vinylPhase, setVinylPhase] = useState<VinylPhase>("idle");
  const [vinylRecipient, setVinylRecipient] = useState("");
  const [vinylResult, setVinylResult] = useState<VinylResult | null>(null);
  const [vinylError, setVinylError] = useState("");
  const vinylPollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load templates on mount
  useEffect(() => {
    fetch("/api/giftcard/templates")
      .then(r => r.json() as Promise<{ templates: Template[] }>)
      .then(d => setTemplates(d.templates))
      .catch(() => {});
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
      if (vinylPollRef.current) clearTimeout(vinylPollRef.current);
    };
  }, []);

  const canGenerate =
    (!!selectedTemplateId || (photoUploadState === "done" && !!photoUrl)) &&
    message.trim().length > 0 &&
    message.trim().length <= 60;

  function showPhotoError(msg: string) {
    setPhotoErrorMsg(msg);
    if (photoErrorTimerRef.current) clearTimeout(photoErrorTimerRef.current);
    photoErrorTimerRef.current = setTimeout(() => setPhotoErrorMsg(null), 3000);
  }

  async function uploadPhoto(file: File) {
    // Client-side size pre-check
    if (file.size > 10 * 1024 * 1024) {
      showPhotoError("Foto terlalu besar (maks 10MB)");
      return;
    }

    setPhotoPreview(URL.createObjectURL(file));
    setPhotoUploadState("uploading");
    setPhotoErrorMsg(null);
    // Deselect any template when photo is selected
    setSelectedTemplateId(null);

    try {
      const formData = new FormData();
      formData.append("photo", file);
      const res = await apiFetch("/api/giftcard/upload-photo", token, {
        method: "POST",
        body: formData,
        headers: {}, // let browser set multipart boundary
      });
      const data = await res.json() as { photoUrl?: string; error?: string };
      if (data.photoUrl) {
        setPhotoUrl(data.photoUrl);
        setPhotoUploadState("done");
      } else {
        throw new Error(data.error ?? "Upload gagal");
      }
    } catch (err: any) {
      setPhotoUploadState("error");
      setPhotoPreview(null);
      showPhotoError(err.message ?? "Gagal upload foto");
    }
  }

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so the same file can be re-selected after removal
    e.target.value = "";
    await uploadPhoto(file);
  }

  function handleRemovePhoto() {
    setPhotoUrl(null);
    setPhotoPreview(null);
    setPhotoUploadState("idle");
    setPhotoErrorMsg(null);
    if (photoErrorTimerRef.current) clearTimeout(photoErrorTimerRef.current);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDraggingOver(true);
  }

  function handleDragLeave() {
    setIsDraggingOver(false);
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await uploadPhoto(file);
  }

  async function handleGenerate() {
    if (!canGenerate) return;
    setPhase("generating");
    setErrorMsg("");
    try {
      const res = await apiFetch("/api/giftcard/generate", token, {
        method: "POST",
        body: JSON.stringify({
          musicJobId,
          // When photo mode is active, fall back to "custom" template for print tag accent color
          templateId: selectedTemplateId ?? "custom",
          message: message.trim(),
          photoUrl: photoUrl ?? undefined,
        }),
      });
      const data = await res.json() as { shareId?: string; error?: string };
      if (!res.ok || !data.shareId) throw new Error(data.error ?? "Gagal membuat gift card");
      setPhase("polling");
      pollStatus(data.shareId);
    } catch (err: any) {
      setPhase("error");
      setErrorMsg(err.message ?? "Terjadi kesalahan");
    }
  }

  function pollStatus(shareId: string) {
    pollRef.current = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/giftcard/status/${shareId}`, token, { method: "GET" });
        const data = await res.json() as {
          status: string;
          shareId: string;
          imageUrl: string | null;
          videoUrl: string | null;
          printTagUrl: string | null;
          shareUrl: string;
        };
        if (data.status === "done") {
          setResult({
            shareId,
            imageUrl: data.imageUrl,
            videoUrl: data.videoUrl,
            printTagUrl: data.printTagUrl,
            shareUrl: `https://lovemelodia.com/gift/${shareId}`,
          });
          setPhase("done");
        } else {
          pollStatus(shareId);
        }
      } catch {
        pollStatus(shareId);
      }
    }, 3000);
  }

  async function handleGenerateVinyl() {
    if (!result?.shareId) return;
    setVinylPhase("generating");
    setVinylError("");
    try {
      const res = await apiFetch("/api/giftcard/generate-vinyl", token, {
        method: "POST",
        body: JSON.stringify({
          shareId: result.shareId,
          recipientName: vinylRecipient.trim() || undefined,
          trackTitle: trackTitle || undefined,
        }),
      });
      const data = await res.json() as { shareId?: string; error?: string };
      if (res.status === 402) {
        setVinylPhase("error");
        setVinylError(data.error ?? "Kredit tidak cukup");
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Gagal membuat vinyl card");
      setVinylPhase("polling");
      pollVinylStatus(result.shareId);
    } catch (err: any) {
      setVinylPhase("error");
      setVinylError(err.message ?? "Terjadi kesalahan");
    }
  }

  function pollVinylStatus(shareId: string) {
    vinylPollRef.current = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/giftcard/vinyl-status/${shareId}`, token, { method: "GET" });
        const data = await res.json() as {
          status: string;
          vinylCardUrl: string | null;
          vinylVideoUrl: string | null;
        };
        if (data.status === "done") {
          setVinylResult({
            vinylCardUrl: data.vinylCardUrl,
            vinylVideoUrl: data.vinylVideoUrl,
          });
          setVinylPhase("done");
        } else {
          pollVinylStatus(shareId);
        }
      } catch {
        pollVinylStatus(shareId);
      }
    }, 3000);
  }

  function copyLink() {
    if (!result) return;
    navigator.clipboard.writeText(result.shareUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleReset() {
    if (pollRef.current) clearTimeout(pollRef.current);
    if (vinylPollRef.current) clearTimeout(vinylPollRef.current);
    if (photoErrorTimerRef.current) clearTimeout(photoErrorTimerRef.current);
    setPhase("selecting");
    setSelectedTemplateId(null);
    setMessage("");
    setPhotoUrl(null);
    setPhotoPreview(null);
    setPhotoUploadState("idle");
    setPhotoErrorMsg(null);
    setResult(null);
    setErrorMsg("");
    setVinylPhase("idle");
    setVinylRecipient("");
    setVinylResult(null);
    setVinylError("");
  }

  return (
    <div className="space-y-5 pt-2">
      <AnimatePresence mode="wait">
        {/* ── SELECTING ── */}
        {(phase === "selecting" || phase === "error") && (
          <motion.div
            key="selecting"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-5"
          >
            {/* Template grid */}
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)] mb-3">
                Pilih Tema Gift Card
              </p>
              <div className="grid grid-cols-4 gap-2">
                {/* Photo tile */}
                <div className="flex flex-col items-center gap-1">
                  <div
                    className="relative w-full aspect-square rounded-xl border-2 transition-all cursor-pointer overflow-hidden flex items-center justify-center text-xl"
                    style={{
                      background: photoPreview ? "transparent" : (isDraggingOver ? "#ede8f0" : "#f3f4f6"),
                      borderColor: photoUploadState === "done" ? BURGUNDY : (isDraggingOver ? BURGUNDY : "transparent"),
                      boxShadow: photoUploadState === "done" ? `0 0 0 2px ${BURGUNDY}` : "none",
                    }}
                    onClick={() => !photoPreview && fileInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    {/* Photo preview */}
                    {photoPreview && (
                      <img src={photoPreview} alt="foto" className="w-full h-full object-cover" />
                    )}

                    {/* Upload spinner overlay */}
                    {photoUploadState === "uploading" && (
                      <div className="absolute inset-0 flex items-center justify-center"
                        style={{ background: "rgba(0,0,0,0.45)" }}>
                        <div
                          className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin"
                        />
                      </div>
                    )}

                    {/* Remove button (shown when photo is done) */}
                    {photoUploadState === "done" && photoPreview && (
                      <button
                        onClick={e => { e.stopPropagation(); handleRemovePhoto(); }}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                        style={{ background: "rgba(0,0,0,0.6)" }}
                        aria-label="Hapus foto"
                      >
                        ✕
                      </button>
                    )}

                    {/* Placeholder icon */}
                    {!photoPreview && <span>📷</span>}
                  </div>
                  <span className="text-[10px] text-[var(--text-muted)] text-center leading-tight">
                    Foto Sendiri
                  </span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handlePhotoSelect}
                />

                {/* Photo error toast */}
                {photoErrorMsg && (
                  <div
                    className="col-span-4 text-xs text-center py-1.5 px-3 rounded-lg"
                    style={{ background: "#fee2e2", color: "#dc2626" }}
                  >
                    {photoErrorMsg}
                  </div>
                )}

                {/* Template tiles */}
                {templates.map(t => (
                  <div
                    key={t.id}
                    onClick={() => { setSelectedTemplateId(t.id); handleRemovePhoto(); }}
                    className="flex flex-col items-center gap-1 cursor-pointer"
                  >
                    <div
                      className="w-full aspect-square rounded-xl transition-all border-2"
                      style={{
                        background: `linear-gradient(135deg, ${t.color}, ${darken(t.color, 0.6)})`,
                        borderColor: selectedTemplateId === t.id ? "#fff" : "transparent",
                        boxShadow: selectedTemplateId === t.id ? `0 0 0 2px ${BURGUNDY}` : "none",
                        opacity: photoUploadState === "done" ? 0.4 : 1,
                        transition: "opacity 0.2s, border-color 0.2s, box-shadow 0.2s",
                      }}
                    />
                    <span className="text-[10px] text-[var(--text-muted)] text-center leading-tight">
                      {t.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Message textarea */}
            <div>
              <label className="text-sm font-semibold text-[var(--text-primary)] block mb-2">
                Tulis pesan kamu
              </label>
              <div className="relative">
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value.slice(0, 60))}
                  placeholder="Selamat ulang tahun, semoga selalu bahagia 🎁"
                  rows={3}
                  className="w-full rounded-xl px-4 py-3 text-sm resize-none outline-none border transition-colors"
                  style={{
                    background: "var(--card-elevated, #f9f9f9)",
                    border: "1.5px solid var(--border, #e5e7eb)",
                    color: "var(--text-primary, #111)",
                  }}
                />
                <span
                  className="absolute bottom-2.5 right-3 text-[11px]"
                  style={{ color: message.length >= 55 ? "#dc2626" : "var(--text-muted, #888)" }}
                >
                  {message.length}/60
                </span>
              </div>
            </div>

            {/* Error */}
            {phase === "error" && errorMsg && (
              <p className="text-sm text-red-500 text-center">{errorMsg}</p>
            )}

            {/* Generate button */}
            <motion.button
              onClick={handleGenerate}
              disabled={!canGenerate}
              whileHover={canGenerate ? { scale: 1.02 } : {}}
              whileTap={canGenerate ? { scale: 0.98 } : {}}
              className="w-full py-3.5 rounded-2xl text-white text-sm font-bold transition-all disabled:opacity-40"
              style={{ background: BURGUNDY }}
            >
              Buat Gift Card 🎁
            </motion.button>
          </motion.div>
        )}

        {/* ── GENERATING / POLLING ── */}
        {(phase === "generating" || phase === "polling") && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-8 space-y-4"
          >
            <div className="text-4xl animate-bounce">🎨</div>
            <p className="font-semibold text-[var(--text-primary)]">
              Lagi bikin gift card-mu...
            </p>
            <div className="flex justify-center gap-1.5">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full"
                  style={{
                    background: BURGUNDY,
                    animation: "waveform-bounce 1s ease-in-out infinite",
                    animationDelay: `${i * 0.18}s`,
                  }}
                />
              ))}
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              Proses ini butuh sekitar 30–60 detik ya 🎁
            </p>
          </motion.div>
        )}

        {/* ── DONE ── */}
        {phase === "done" && result && (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            <div className="text-center space-y-1">
              <div className="text-3xl">🎉</div>
              <p className="font-bold text-[var(--text-primary)]">Gift card siap!</p>
            </div>

            {/* Preview image */}
            {result.imageUrl && (
              <img
                src={result.imageUrl}
                alt="Gift Card"
                className="w-full rounded-2xl shadow-lg"
              />
            )}

            {/* Download / share buttons */}
            <div className="space-y-2">
              {result.imageUrl && (
                <a
                  href={result.imageUrl}
                  download
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-white text-sm font-semibold"
                  style={{ background: BURGUNDY }}
                >
                  ⬇ Gambar (Feed / WA)
                </a>
              )}
              {result.videoUrl && (
                <a
                  href={result.videoUrl}
                  download
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-white text-sm font-semibold"
                  style={{ background: "#6A1550" }}
                >
                  ⬇ Video (Stories / TikTok)
                </a>
              )}
              {result.printTagUrl && (
                <a
                  href={result.printTagUrl}
                  download
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold"
                  style={{ background: "white", color: BURGUNDY, border: `1.5px solid ${BURGUNDY}` }}
                >
                  🖨 Print Tag (Buket / Cokelat)
                </a>
              )}
              <button
                onClick={copyLink}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: copied ? "#e8f5e9" : "#f3f4f6",
                  color: copied ? "#2e7d32" : "#555",
                }}
              >
                {copied ? "✓ Disalin!" : "🔗 Copy Link"}
              </button>
            </div>

            {result.printTagUrl && (
              <p className="text-center text-xs text-[var(--text-muted)]">
                Print &amp; tempel ke buket atau kotak cokelat kamu!
              </p>
            )}

            {/* ── VINYL PREMIUM SECTION ── */}
            <VinylSection
              vinylPhase={vinylPhase}
              vinylRecipient={vinylRecipient}
              vinylResult={vinylResult}
              vinylError={vinylError}
              onRecipientChange={setVinylRecipient}
              onGenerate={handleGenerateVinyl}
            />

            <button
              onClick={handleReset}
              className="w-full py-2.5 rounded-xl text-xs font-medium text-[var(--text-muted)]"
            >
              Buat gift card lain ↺
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Vinyl Section Sub-component ──────────────────────────────────────────────

interface VinylSectionProps {
  vinylPhase: VinylPhase;
  vinylRecipient: string;
  vinylResult: VinylResult | null;
  vinylError: string;
  onRecipientChange: (v: string) => void;
  onGenerate: () => void;
}

function VinylSection({
  vinylPhase,
  vinylRecipient,
  vinylResult,
  vinylError,
  onRecipientChange,
  onGenerate,
}: VinylSectionProps) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #1A1A1A, #2A1A2A)",
        border: `1px solid ${ROSE_GOLD}33`,
      }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-start gap-3">
        {/* Mini vinyl disc illustration */}
        <div
          className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg"
          style={{ background: "#2A2A2A", border: `2px solid ${ROSE_GOLD}66` }}
        >
          🎵
        </div>
        <div>
          <p className="text-sm font-bold" style={{ color: ROSE_GOLD }}>
            Buat Vinyl Card (Premium)
          </p>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>
            Vinyl record-style card yang bisa dicetak. +1 kredit.
          </p>
        </div>
      </div>

      {/* Body — idle or error: show form */}
      {(vinylPhase === "idle" || vinylPhase === "error") && (
        <div className="px-4 pb-4 space-y-3">
          {/* Recipient input */}
          <div>
            <label
              className="text-xs font-semibold block mb-1.5"
              style={{ color: "rgba(255,255,255,0.6)" }}
            >
              Nama penerima (opsional)
            </label>
            <input
              type="text"
              value={vinylRecipient}
              onChange={e => onRecipientChange(e.target.value.slice(0, 30))}
              placeholder="e.g. Buat Tika"
              maxLength={30}
              className="w-full rounded-xl px-3 py-2 text-sm outline-none"
              style={{
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "white",
              }}
            />
            <p className="text-right text-[10px] mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>
              {vinylRecipient.length}/30
            </p>
          </div>

          {vinylError && (
            <p className="text-xs text-center py-1.5 px-3 rounded-lg" style={{ background: "#7f1d1d33", color: "#fca5a5" }}>
              {vinylError}
            </p>
          )}

          <motion.button
            onClick={onGenerate}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="w-full py-3 rounded-xl text-sm font-bold"
            style={{
              background: `linear-gradient(135deg, ${ROSE_GOLD}, #C49060)`,
              color: "#1A1A1A",
            }}
          >
            Buat Vinyl Card
          </motion.button>
        </div>
      )}

      {/* Generating / polling state */}
      {(vinylPhase === "generating" || vinylPhase === "polling") && (
        <div className="px-4 pb-4 text-center space-y-3">
          <div className="flex justify-center gap-1.5 pt-1">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-2 h-2 rounded-full"
                style={{
                  background: ROSE_GOLD,
                  animation: "waveform-bounce 1s ease-in-out infinite",
                  animationDelay: `${i * 0.18}s`,
                }}
              />
            ))}
          </div>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
            Rendering vinyl... ~30 detik
          </p>
        </div>
      )}

      {/* Done state: download buttons */}
      {vinylPhase === "done" && vinylResult && (
        <div className="px-4 pb-4 space-y-2">
          <p className="text-xs text-center mb-3" style={{ color: ROSE_GOLD }}>
            Vinyl card siap didownload!
          </p>
          {vinylResult.vinylCardUrl && (
            <a
              href={vinylResult.vinylCardUrl}
              download
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: ROSE_GOLD, color: "#1A1A1A" }}
            >
              ⬇ Vinyl Card PNG (Cetak 148×148mm)
            </a>
          )}
          {vinylResult.vinylVideoUrl && (
            <a
              href={vinylResult.vinylVideoUrl}
              download
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold"
              style={{
                background: "rgba(255,255,255,0.08)",
                color: ROSE_GOLD,
                border: `1px solid ${ROSE_GOLD}66`,
              }}
            >
              ⬇ Vinyl Video MP4 (Stories / TikTok)
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// simple color darkener (client-side, no server dep)
function darken(hex: string, factor = 0.5): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return hex;
  const r = Math.round(parseInt(result[1], 16) * factor);
  const g = Math.round(parseInt(result[2], 16) * factor);
  const b = Math.round(parseInt(result[3], 16) * factor);
  return `rgb(${r},${g},${b})`;
}
