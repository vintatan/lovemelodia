import { execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import type { Timepoint } from "./db.js";

const execFileAsync = promisify(execFile);

async function downloadFile(url: string, destPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(destPath, buf);
}

function timestampToSeconds(ts: string): number {
  const parts = ts.split(":").map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

function zoomSpeed(intensity: "low" | "medium" | "high"): number {
  if (intensity === "high") return 0.003;
  if (intensity === "medium") return 0.0015;
  return 0.0008;
}

// Alternates pan direction per frame — portrait format so Y axis has more travel room
function panExpr(idx: number): { x: string; y: string } {
  switch (idx % 4) {
    case 0: // center — pure zoom, no pan
      return { x: "iw/2-(iw/zoom/2)", y: "ih/2-(ih/zoom/2)" };
    case 1: // gentle right + pan up (portrait: more vertical room)
      return { x: "iw/2-(iw/zoom/2)+on*0.133", y: "ih/2-(ih/zoom/2)-on*0.3" };
    case 2: // gentle left + pan down
      return { x: "iw/2-(iw/zoom/2)-on*0.133", y: "ih/2-(ih/zoom/2)+on*0.3" };
    default: // slight right + down diagonal
      return { x: "iw/2-(iw/zoom/2)+on*0.1", y: "ih/2-(ih/zoom/2)+on*0.2" };
  }
}

// Mood-based cinematic color grade: curves + saturation/contrast adjustment
function moodColorGrade(mood: string): string {
  switch (mood) {
    case "melancholic":
    case "longing":
      // Cool blue-grey, lifted blacks, desaturated — nostalgic and emotional
      return "curves=r='0/0 0.5/0.46 1/0.92':g='0/0 0.5/0.50 1/1':b='0/0.03 0.5/0.54 1/1.02',eq=saturation=0.82:contrast=0.97";
    case "dreamy":
      // Soft, slightly overexposed, warm-cool neutral — ethereal
      return "curves=r='0/0.02 0.5/0.52 1/0.97':g='0/0.01 0.5/0.51 1/0.98':b='0/0.02 0.5/0.53 1/1',eq=saturation=0.88:contrast=0.92:brightness=0.02";
    case "euphoric":
    case "triumphant":
      // Warm golden, punchy contrast, vibrant — golden hour energy
      return "curves=r='0/0 0.5/0.56 1/1':g='0/0 0.5/0.50 1/0.95':b='0/0 0.5/0.43 1/0.82',eq=saturation=1.2:contrast=1.08";
    case "tense":
      // High contrast, cool shadows, desaturated — suspense and dread
      return "curves=r='0/0 0.3/0.24 0.7/0.76 1/1':g='0/0 0.3/0.27 0.7/0.73 1/0.97':b='0/0 0.3/0.28 0.7/0.72 1/1.04',eq=saturation=0.78:contrast=1.15";
    case "mysterious":
      // Deep shadows, teal-orange split, cinematic noir
      return "curves=r='0/0 0.5/0.51 1/0.98':g='0/0 0.5/0.47 1/0.92':b='0/0.02 0.5/0.52 1/1.04',eq=saturation=0.88:contrast=1.1";
    case "playful":
      // Vibrant, warm, high saturation — bright and energetic
      return "curves=r='0/0 0.5/0.53 1/1':g='0/0 0.5/0.51 1/0.98':b='0/0 0.5/0.47 1/0.90',eq=saturation=1.3:contrast=1.05:brightness=0.02";
    default:
      // Neutral cinematic — subtle warm grade, slight contrast lift
      return "curves=r='0/0 0.5/0.51 1/1':g='0/0 0.5/0.50 1/0.97':b='0/0 0.5/0.48 1/0.93',eq=saturation=1.0:contrast=1.02";
  }
}

export async function assembleVideo(params: {
  frameUrls: string[];
  musicUrl: string;
  timepoints: Timepoint[];
}): Promise<string> {
  const { frameUrls, musicUrl, timepoints } = params;

  if (frameUrls.length !== timepoints.length) {
    throw new Error(`frameUrls length (${frameUrls.length}) must match timepoints length (${timepoints.length})`);
  }

  const tmpDir = await mkdtemp(path.join(tmpdir(), "kreasi-"));

  try {
    // 1. Download frames + music in parallel
    const framePaths: string[] = [];
    await Promise.all(
      frameUrls.map(async (url, i) => {
        const dest = path.join(tmpDir, `frame_${i}.jpg`);
        await downloadFile(url, dest);
        framePaths[i] = dest;
      })
    );
    const musicExt = musicUrl.includes(".wav") ? "wav" : "mp3";
    const musicPath = path.join(tmpDir, `music.${musicExt}`);
    await downloadFile(musicUrl, musicPath);

    // 2. Compute segment durations from timestamps
    const timestamps = timepoints.map(tp => timestampToSeconds(tp.timestamp));
    const segDurations: number[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const next = i + 1 < timestamps.length ? timestamps[i + 1] : timestamps[i] + 20;
      segDurations.push(next - timestamps[i]);
    }
    const totalDuration = segDurations.reduce((a, b) => a + b, 0);

    // 3. Build filter_complex: per-segment Ken Burns + grade + grain + vignette, then xfade chain
    const filterParts: string[] = [];
    const fps = 30;

    for (let i = 0; i < framePaths.length; i++) {
      const tp = timepoints[i];
      const durationFrames = Math.round(segDurations[i] * fps);
      const speed = zoomSpeed(tp.intensity);
      const { x: xExpr, y: yExpr } = panExpr(i);

      filterParts.push(
        `[${i}:v]` +
        // Scale to 2× portrait size to give Ken Burns zoom/pan headroom
        `scale=2160:3840,` +
        // Ken Burns: slow zoom + alternating pan direction (portrait output)
        `zoompan=` +
          `z='min(zoom+${speed},1.5)':` +
          `x='${xExpr}':` +
          `y='${yExpr}':` +
          `d=${durationFrames}:` +
          `s=1080x1920:` +
          `fps=${fps},` +
        `format=yuv420p,` +
        `setsar=1,` +
        // Mood-based color grade (curves + saturation/contrast)
        `${moodColorGrade(tp.mood)},` +
        // Micro-contrast / depth (luma only, no chroma sharpen)
        `unsharp=lx=5:ly=5:la=0.4:ca=0,` +
        // Luma-only film grain (temporal — changes per frame for organic feel)
        `noise=c0s=5:c0f=t+u,` +
        // Vignette: darken edges for cinematic depth
        `vignette=PI/4.5` +
        `[v${i}]`
      );
    }

    // xfade chain — transitions driven by timepoint mood/intensity
    let cumulativeDuration = 0;
    let prevLabel = "[v0]";

    for (let i = 0; i < framePaths.length - 1; i++) {
      cumulativeDuration += segDurations[i];
      const tp = timepoints[i + 1];
      const transitionDur = Math.max(0.3, Math.min(1.2, tp.transitionDuration));
      const xfadeOffset = Math.max(0, cumulativeDuration - transitionDur);
      const isLast = i === framePaths.length - 2;
      const outLabel = isLast ? "[vchained]" : `[vx${i}]`;

      filterParts.push(
        `${prevLabel}[v${i + 1}]xfade=transition=${tp.transition}:duration=${transitionDur}:offset=${xfadeOffset}${outLabel}`
      );
      prevLabel = outLabel;
    }

    // Single frame: just copy to chained label
    if (framePaths.length === 1) {
      filterParts.push("[v0]copy[vchained]");
    }

    // Final pass: portrait safe-zone gradient bars (top/bottom 80px) + video fade in/out
    // Protects content from mobile status bar / navigation UI on reels
    const videoFadeOutStart = Math.max(0, totalDuration - 1.5);
    filterParts.push(
      `[vchained]` +
      `drawbox=x=0:y=0:w=1080:h=80:color=black@0.55:t=fill,` +
      `drawbox=x=0:y=1840:w=1080:h=80:color=black@0.55:t=fill,` +
      `fade=t=in:st=0:d=1.5,` +
      `fade=t=out:st=${videoFadeOutStart}:d=1.5` +
      `[vfinal]`
    );

    // Build input args: -loop 1 so zoompan has enough frames
    const inputs: string[] = [];
    for (let i = 0; i < framePaths.length; i++) {
      inputs.push("-loop", "1", "-t", String(segDurations[i] + 2), "-i", framePaths[i]);
    }

    const silentPath = path.join(tmpDir, "silent.mp4");
    await execFileAsync("ffmpeg", [
      ...inputs,
      "-filter_complex", filterParts.join(";"),
      "-map", "[vfinal]",
      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", "20",
      "-r", String(fps),
      "-movflags", "+faststart",
      "-y", silentPath,
    ], { maxBuffer: 100 * 1024 * 1024 });

    // 4. Mix music with fade-out (video stream copied — no re-encode)
    const outputPath = path.join(tmpDir, "final.mp4");
    const audioFadeOutStart = Math.max(0, totalDuration - 3);

    await execFileAsync("ffmpeg", [
      "-i", silentPath,
      "-i", musicPath,
      "-filter_complex",
        `[1:a]afade=t=out:st=${audioFadeOutStart}:d=3,apad=whole_dur=${totalDuration}[aout]`,
      "-map", "0:v",
      "-map", "[aout]",
      "-c:v", "copy",
      "-c:a", "aac", "-b:a", "192k",
      "-shortest",
      "-movflags", "+faststart",
      "-y", outputPath,
    ], { maxBuffer: 100 * 1024 * 1024 });

    return outputPath;
  } catch (err) {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    throw err;
  }
}

export async function cleanupTmpDir(dirPath: string): Promise<void> {
  await rm(dirPath, { recursive: true, force: true }).catch(() => {});
}
