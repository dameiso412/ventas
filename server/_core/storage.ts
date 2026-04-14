import { createClient } from "@supabase/supabase-js";
import { ENV } from "./env";

let _supabase: ReturnType<typeof createClient> | null = null;

function getSupabaseAdmin() {
  if (!_supabase) {
    _supabase = createClient(ENV.supabaseUrl, ENV.supabaseServiceRoleKey || ENV.supabaseAnonKey);
  }
  return _supabase;
}

const BUCKET = "call-recordings";

/** Create the storage bucket if it doesn't exist (idempotent). */
export async function ensureBucket() {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.storage.getBucket(BUCKET);
  if (!data) {
    const { error } = await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 25 * 1024 * 1024, // 25 MB (Whisper limit)
      allowedMimeTypes: [
        "audio/mpeg", "audio/mp4", "audio/wav", "audio/x-m4a",
        "audio/webm", "video/mp4", "video/webm",
      ],
    });
    if (error && !error.message?.includes("already exists")) {
      console.error("[Storage] Failed to create bucket:", error);
    } else {
      console.log("[Storage] Bucket 'call-recordings' ready");
    }
  }
}

/**
 * Upload an audio/video buffer to Supabase Storage.
 * Returns the public URL of the uploaded file.
 */
export async function uploadRecording(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  leadId?: number | null,
): Promise<string> {
  const supabase = getSupabaseAdmin();
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const folder = leadId ? String(leadId) : "general";
  const path = `${folder}/${Date.now()}-${sanitized}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: mimeType, upsert: false });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
