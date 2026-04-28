import { motion } from "motion/react";
import { Download, Share2 } from "lucide-react";
import { Button } from "../../UI.tsx";

export default function VideoPlayer({ videoUrl }: { videoUrl: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-3"
    >
      <div className="rounded-xl overflow-hidden border border-[var(--border-subtle)] shadow-glow-lg">
        <video
          src={videoUrl}
          controls
          autoPlay
          loop
          playsInline
          className="w-full max-h-[70vh] object-contain bg-black"
        />
      </div>
      <div className="flex gap-2">
        <a href={videoUrl} download="kreasi-ai-music-video.mp4" className="flex-1">
          <Button variant="violet" size="md" className="w-full">
            <Download className="w-4 h-4" /> Download MP4
          </Button>
        </a>
        <Button
          variant="outline"
          size="md"
          onClick={() => navigator.share?.({ url: videoUrl, title: "My Kreasi AI Music Video" })}
        >
          <Share2 className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  );
}
