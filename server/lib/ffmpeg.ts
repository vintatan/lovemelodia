import { execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import type { Timepoint } from "./db.js";

const execFileAsync = promisify(execFile);

/**
 * Download a URL to a local temp file and return its path.
 */
async function downloadFile(url: string, destPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(destPath, buf);
}

/**
 * Convert M:SS timestamp string to seconds.
 */
function timestampToSeconds(ts: string): number {
  const parts = ts.split(":").map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

/**
 * Get zoom speed multiplier based on intensity.
 */
function zoomSpeed(intensity: "low" | "medium" | "high"): number {
  if (intensity === "high") return 0.003;
  if (intensity === "medium") return 0.001;
  return 0.0005;
}

/**
 * Get pan x expression — alternates direction per frame index.
 */
function panXExpr(idx: number): string {
  // Even: center, Odd: pan right
  return idx % 2 === 0
    ? "iw/2-(iw/zoom/2)"
    : "iw/2-(iw/zoom/2)+t*8";
}

/**
 * Assemble final MP4 from storyboard frames + music.
 *
 * Steps:
 * 1. Download all frame images + music to temp dir
 * 2. Build Ken Burns animated clips (zoompan) for each frame, duration = segment length
 * 3. Chain clips with xfade, transition duration from timepoint.transitionDuration
 * 4. Overlay music with fade-out at the end
 * 5. Return local path to final MP4
 */
export async function assembleVideo(params: {
  frameUrls: string[];        // ordered by timepoint index
  musicUrl: string;           // URL to generated audio (wav/mp3)
  timepoints: Timepoint[];    // must match frameUrls length
  outputDir?: string;
}): Promise<string> {
  const { frameUrls, musicUrl, timepoints } = params;

  if (frameUrls.length !== timepoints.length) {
    throw new Error(`frameUrls length (${frameUrls.length}) must match timepoints length (${timepoints.length})`);
  }

  const tmpDir = await mkdtemp(path.join(tmpdir(), "kreasi-"));

  try {
    // 1. Download frames + music
    const framePaths: string[] = [];
    for (let i = 0; i < frameUrls.length; i++) {
      const dest = path.join(tmpDir, `frame_${i}.jpg`);
      await downloadFile(frameUrls[i], dest);
      framePaths.push(dest);
    }
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

    // 3. Build FFmpeg command for silent video with Ken Burns + xfade
    // Each frame → zoompan animated clip → xfade chain
    const silentPath = path.join(tmpDir, "silent.mp4");

    // Build filter_complex
    // For each frame i: scale → zoompan → setsar → [vi]
    // Then chain xfade: [v0][v1]xfade → [vx01], [vx01][v2]xfade → [vx012], ...
    const filterParts: string[] = [];
    const fps = 30;

    for (let i = 0; i < framePaths.length; i++) {
      const tp = timepoints[i];
      const durationFrames = Math.round(segDurations[i] * fps);
      const speed = zoomSpeed(tp.intensity);
      const xExpr = panXExpr(i);

      filterParts.push(
        `[${i}:v]` +
        `scale=2160:3840,` +
        `zoompan=` +
          `z='min(zoom+${speed},1.5)':` +
          `x='${xExpr}':` +
          `y='ih/2-(ih/zoom/2)':` +
          `d=${durationFrames}:` +
          `s=1080x1920:` +
          `fps=${fps},` +
        `format=yuv420p,` +
        `setsar=1` +
        `[v${i}]`
      );
    }

    // xfade chain
    // Offset for each transition = cumulative segment durations up to that boundary - transitionDuration
    let cumulativeDuration = 0;
    let prevLabel = "[v0]";

    for (let i = 0; i < framePaths.length - 1; i++) {
      cumulativeDuration += segDurations[i];
      const tp = timepoints[i + 1]; // transition INTO this timepoint
      const transitionDur = Math.max(0.3, Math.min(1.2, tp.transitionDuration));
      const xfadeOffset = Math.max(0, cumulativeDuration - transitionDur);
      const outLabel = i === framePaths.length - 2 ? "[vout]" : `[vx${i}]`;

      filterParts.push(
        `${prevLabel}[v${i + 1}]xfade=transition=${tp.transition}:duration=${transitionDur}:offset=${xfadeOffset}${outLabel}`
      );

      prevLabel = outLabel;
    }

    // If only 1 frame, just rename
    if (framePaths.length === 1) {
      filterParts.push("[v0]copy[vout]");
    }

    // Build input args: one -i per frame
    const inputs: string[] = [];
    for (const fp of framePaths) {
      inputs.push("-i", fp);
    }

    const ffmpegSilentArgs = [
      ...inputs,
      "-filter_complex", filterParts.join(";"),
      "-map", "[vout]",
      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", "20",
      "-r", String(fps),
      "-movflags", "+faststart",
      "-y", silentPath,
    ];

    await execFileAsync("ffmpeg", ffmpegSilentArgs, { maxBuffer: 100 * 1024 * 1024 });

    // 4. Overlay music with fade-out
    const outputPath = path.join(tmpDir, "final.mp4");
    const fadeOutStart = Math.max(0, totalDuration - 3);

    await execFileAsync("ffmpeg", [
      "-i", silentPath,
      "-i", musicPath,
      "-filter_complex",
        `[1:a]afade=t=out:st=${fadeOutStart}:d=3,apad=whole_dur=${totalDuration}[aout]`,
      "-map", "0:v",
      "-map", "[aout]",
      "-c:v", "copy",
      "-c:a", "aac", "-b:a", "192k",
      "-shortest",
      "-movflags", "+faststart",
      "-y", outputPath,
    ], { maxBuffer: 100 * 1024 * 1024 });

    // 5. Read output and return path (caller uploads to GCS)
    return outputPath;
  } catch (err) {
    // Clean up temp dir on error
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    throw err;
  }
}

export async function cleanupTmpDir(dirPath: string): Promise<void> {
  await rm(dirPath, { recursive: true, force: true }).catch(() => {});
}
