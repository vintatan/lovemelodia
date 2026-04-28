import { Storage } from "@google-cloud/storage";
import { randomUUID } from "crypto";

const bucketName = process.env.GCS_BUCKET_NAME;
const storage = bucketName ? new Storage() : null;

type ContentType = "image/jpeg" | "video/mp4" | "audio/wav" | "audio/mpeg";

export async function uploadToGcs(
  buffer: Buffer,
  contentType: ContentType,
  folder: string,
  phone: string | null,
): Promise<string | null> {
  if (!storage || !bucketName) return null;
  const extMap: Record<ContentType, string> = {
    "image/jpeg": "jpg",
    "video/mp4": "mp4",
    "audio/wav": "wav",
    "audio/mpeg": "mp3",
  };
  const ext = extMap[contentType] ?? "bin";
  const filename = `${folder}/${phone ?? "anonymous"}/${randomUUID()}.${ext}`;
  try {
    const file = storage.bucket(bucketName).file(filename);
    await file.save(buffer, { contentType, resumable: false });
    return `https://storage.googleapis.com/${bucketName}/${filename}`;
  } catch (err) {
    console.error("[GCS] upload failed:", err);
    return null;
  }
}

export async function uploadUrlToGcs(
  url: string,
  contentType: ContentType,
  folder: string,
  phone: string | null,
): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    return uploadToGcs(buf, contentType, folder, phone);
  } catch (err) {
    console.error("[GCS] uploadUrl failed:", err);
    return null;
  }
}
