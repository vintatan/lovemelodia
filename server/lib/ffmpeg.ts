import { execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import type { Timepoint } from "./db.js";

const execFileAsync = promisify(execFile);

async function getAudioDuration(filePath: string): Promise<number> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error", "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1", filePath,
  ]);
  return parseFloat(stdout.trim()) || 0;
}

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

    const audioDuration = await getAudioDuration(musicPath);

    // 2. Compute segment durations from timestamps — last segment fills to end of audio
    const timestamps = timepoints.map(tp => timestampToSeconds(tp.timestamp));
    const segDurations: number[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const next = i + 1 < timestamps.length ? timestamps[i + 1] : (audioDuration || timestamps[i] + 20);
      segDurations.push(Math.max(1, next - timestamps[i]));
    }
    const totalDuration = audioDuration || segDurations.reduce((a, b) => a + b, 0);

    // 3. Build filter_complex: scale/crop each image to 1920×1080 landscape, concat, fade in/out
    const filterParts: string[] = [];

    for (let i = 0; i < framePaths.length; i++) {
      filterParts.push(
        `[${i}:v]scale=1920:1080:force_original_aspect_ratio=increase,` +
        `crop=1920:1080,` +
        `setsar=1,` +
        `format=yuv420p` +
        `[v${i}]`
      );
    }

    // Concat all segments
    const concatInputs = framePaths.map((_, i) => `[v${i}]`).join("");
    filterParts.push(`${concatInputs}concat=n=${framePaths.length}:v=1:a=0[vchained]`);

    // Fade in/out
    const fadeOutStart = Math.max(0, totalDuration - 1.5);
    filterParts.push(
      `[vchained]fade=t=in:st=0:d=1.5,fade=t=out:st=${fadeOutStart}:d=1.5[vfinal]`
    );

    // Build inputs: -loop 1 -t <duration>
    const inputs: string[] = [];
    for (let i = 0; i < framePaths.length; i++) {
      inputs.push("-loop", "1", "-t", String(segDurations[i]), "-i", framePaths[i]);
    }

    const silentPath = path.join(tmpDir, "silent.mp4");
    await execFileAsync("ffmpeg", [
      ...inputs,
      "-filter_complex", filterParts.join(";"),
      "-map", "[vfinal]",
      "-c:v", "h264_videotoolbox",
      "-b:v", "4000k",
      "-r", "30",
      "-movflags", "+faststart",
      "-y", silentPath,
    ], { maxBuffer: 100 * 1024 * 1024, timeout: 10 * 60 * 1000 });

    // 4. Mix music with audio fade-out (video stream copied — no re-encode)
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
      "-movflags", "+faststart",
      "-y", outputPath,
    ], { maxBuffer: 100 * 1024 * 1024, timeout: 5 * 60 * 1000 });

    return outputPath;
  } catch (err) {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    throw err;
  }
}

export async function cleanupTmpDir(dirPath: string): Promise<void> {
  await rm(dirPath, { recursive: true, force: true }).catch(() => {});
}
