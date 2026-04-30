import { useState } from "react";

interface ShareButtonProps {
  icon: React.ReactNode;
  label: string;
  color: string;
  bgColor: string;
}

function ShareButton({ icon, label, color, bgColor }: ShareButtonProps) {
  const [showTip, setShowTip] = useState(false);

  return (
    <div className="relative">
      <button
        disabled
        aria-label={label}
        onMouseEnter={() => setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
        onFocus={() => setShowTip(true)}
        onBlur={() => setShowTip(false)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium opacity-45 cursor-not-allowed transition-opacity"
        style={{ backgroundColor: bgColor, color }}
      >
        {icon}
        <span>{label}</span>
      </button>
      {showTip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 text-center text-xs bg-[#1a1a2e] border border-[var(--border-subtle)] text-[var(--text-muted)] px-3 py-2 rounded-lg whitespace-nowrap pointer-events-none z-10">
          Segera hadir — distribusi musik <br />coming soon! 🎵
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#1a1a2e]" />
        </div>
      )}
    </div>
  );
}

interface ShareButtonsProps {
  audioUrl: string;
}

export default function ShareButtons({ audioUrl: _audioUrl }: ShareButtonsProps) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--text-faint)] uppercase tracking-widest font-medium">Share ke</p>
      <div className="flex flex-wrap gap-2">
        <ShareButton
          label="TikTok"
          bgColor="rgba(0,0,0,0.8)"
          color="#ffffff"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.17 8.17 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z"/>
            </svg>
          }
        />
        <ShareButton
          label="YouTube Music"
          bgColor="rgba(255,0,0,0.15)"
          color="#ff4444"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21.582 7.2s-.21-1.47-.85-2.12c-.81-.85-1.72-.85-2.13-.9C15.97 4 12 4 12 4s-3.97 0-6.6.18c-.41.05-1.32.05-2.13.9-.64.65-.85 2.12-.85 2.12S2.2 8.9 2.2 10.6v1.6c0 1.7.22 3.4.22 3.4s.21 1.47.85 2.12c.81.85 1.88.82 2.35.91C7 18.8 12 18.8 12 18.8s3.97 0 6.6-.18c.41-.05 1.32-.06 2.13-.91.64-.65.85-2.12.85-2.12s.22-1.7.22-3.4v-1.6c0-1.7-.22-3.4-.22-3.4zM9.74 14.85V8.66l5.76 3.1-5.76 3.09z"/>
            </svg>
          }
        />
        <ShareButton
          label="Noise Indonesia"
          bgColor="rgba(251,146,60,0.15)"
          color="#fb923c"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18V5l12-2v13"/>
              <circle cx="6" cy="18" r="3"/>
              <circle cx="18" cy="16" r="3"/>
            </svg>
          }
        />
        <ShareButton
          label="Spotify"
          bgColor="rgba(30,215,96,0.15)"
          color="#1ed760"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424a.622.622 0 01-.857.207c-2.348-1.435-5.304-1.76-8.785-.964a.623.623 0 01-.277-1.215c3.809-.87 7.076-.496 9.712 1.115a.623.623 0 01.207.857zm1.223-2.722a.779.779 0 01-1.072.257c-2.687-1.652-6.785-2.13-9.965-1.166a.778.778 0 01-.972-.521.779.779 0 01.52-.972c3.632-1.102 8.147-.568 11.233 1.329a.779.779 0 01.256 1.073zm.105-2.835c-3.223-1.914-8.54-2.09-11.618-1.156a.935.935 0 11-.543-1.79c3.532-1.073 9.404-.866 13.115 1.337a.934.934 0 11-.954 1.609z"/>
            </svg>
          }
        />
      </div>
    </div>
  );
}
