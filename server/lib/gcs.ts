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
    await file.save(buffer, { contentType, resumable: false, predefinedAcl: "publicRead" });
    await file.makePublic().catch(err => console.warn("[GCS] makePublic failed:", (err as Error).message));
    return `https://storage.googleapis.com/${bucketName}/${filename}`;
  } catch (err) {
    console.error("[GCS] upload failed:", err);
    return null;
  }
}

export async function ensureBucketPublicAccess(): Promise<void> {
  if (!storage || !bucketName) return;
  try {
    const bucket = storage.bucket(bucketName);
    const [policy] = await bucket.iam.getPolicy({ requestedPolicyVersion: 3 });
    const alreadyPublic = policy.bindings?.some(
      b => b.role === "roles/storage.objectViewer" && b.members?.includes("allUsers")
    );
    if (!alreadyPublic) {
      (policy.bindings ??= []).push({ role: "roles/storage.objectViewer", members: ["allUsers"] });
      await bucket.iam.setPolicy(policy);
      console.log("[GCS] Bucket public read access granted");
    }
  } catch (err) {
    console.warn("[GCS] Could not set bucket public access (uniform ACL may need to be set in Console):", (err as Error).message);
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
