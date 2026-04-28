import { useState, useRef } from "react";
import { motion } from "motion/react";
import { Upload, Music2, User, Palette, ArrowRight, X } from "lucide-react";
import { Button, Textarea, Input, SectionHeading } from "../../UI.tsx";

const THEMES = [
  { id: "fairytale", label: "Fairytale", emoji: "🏰" },
  { id: "real life", label: "Real Life", emoji: "🌆" },
  { id: "city",      label: "City",      emoji: "🌃" },
  { id: "sci-fi",    label: "Sci-Fi",    emoji: "🚀" },
  { id: "nature",    label: "Nature",    emoji: "🌿" },
  { id: "fantasy",   label: "Fantasy",   emoji: "✨" },
];

interface Stage1FormProps {
  onSubmit: (params: {
    characterImageBase64: string | null;
    characterDesc: string;
    theme: string;
    musicVibe: string;
  }) => void;
  loading: boolean;
}

export default function Stage1Form({ onSubmit, loading }: Stage1FormProps) {
  const [characterDesc, setCharacterDesc] = useState("");
  const [theme, setTheme] = useState("real life");
  const [musicVibe, setMusicVibe] = useState("");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleImageFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setImagePreview(dataUrl);
      // Strip "data:image/jpeg;base64," prefix
      setImageBase64(dataUrl.split(",")[1]);
    };
    reader.readAsDataURL(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) handleImageFile(file);
  }

  function handleSubmit() {
    if (!musicVibe.trim()) return;
    onSubmit({ characterImageBase64: imageBase64, characterDesc, theme, musicVibe });
  }

  return (
    <div className="flex flex-col gap-5 max-w-md mx-auto">
      <SectionHeading
        step={1}
        title="Set the Scene"
        subtitle="Tell us about your character, pick a theme, and describe the music vibe."
      />

      {/* Character image upload */}
      <div className="flex flex-col gap-2">
        <span className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider">Character Photo (optional)</span>
        {imagePreview ? (
          <div className="relative w-24 h-36 rounded-xl overflow-hidden border border-[var(--border-subtle)]">
            <img src={imagePreview} alt="Character" className="w-full h-full object-cover" />
            <button
              onClick={() => { setImageBase64(null); setImagePreview(null); }}
              className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5"
            >
              <X className="w-3 h-3 text-white" />
            </button>
          </div>
        ) : (
          <div
            onClick={() => fileRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            className="border-2 border-dashed border-[var(--border-accent)] rounded-xl p-6 text-center cursor-pointer hover:bg-[var(--bg-elevated)] transition-colors"
          >
            <Upload className="w-6 h-6 text-[var(--accent-violet)] mx-auto mb-2" />
            <p className="text-xs text-[var(--text-muted)]">Drop photo or click to upload</p>
            <p className="text-xs text-[var(--text-faint)] mt-1">Ensures character consistency across scenes</p>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleImageFile(e.target.files[0])} />
      </div>

      {/* Character description */}
      <Textarea
        label="Character Description"
        placeholder="A young woman with curly auburn hair, wearing a vintage floral dress, warm expressive eyes..."
        value={characterDesc}
        onChange={e => setCharacterDesc(e.target.value)}
        rows={3}
      />

      {/* Theme picker */}
      <div className="flex flex-col gap-2">
        <span className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider flex items-center gap-1.5"><Palette className="w-3.5 h-3.5" /> Theme</span>
        <div className="grid grid-cols-3 gap-2">
          {THEMES.map(t => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-sm transition-all ${
                theme === t.id
                  ? "border-[var(--accent-violet)] bg-violet-500/10 text-[var(--text-primary)]"
                  : "border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]"
              }`}
            >
              <span className="text-lg">{t.emoji}</span>
              <span className="text-xs">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Music vibe */}
      <Textarea
        label={<span className="flex items-center gap-1.5"><Music2 className="w-3.5 h-3.5" /> Music Vibe *</span> as any}
        placeholder="Melancholic cinematic ballad with harp and strings, building to a triumphant orchestral chorus..."
        value={musicVibe}
        onChange={e => setMusicVibe(e.target.value)}
        rows={3}
      />

      <Button
        onClick={handleSubmit}
        loading={loading}
        disabled={!musicVibe.trim()}
        size="lg"
        className="w-full"
      >
        Enhance &amp; Generate Timeline <ArrowRight className="w-4 h-4" />
      </Button>
      <p className="text-xs text-[var(--text-faint)] text-center">Uses 5 credits</p>
    </div>
  );
}
