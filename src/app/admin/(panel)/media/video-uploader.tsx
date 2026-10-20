"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { registerVideoAction, signVideoUploadAction } from "./actions";

/** Uploads a video straight from the browser to Cloudinary (signed), then registers it. */
export function VideoUploader() {
  const router = useRouter();
  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function onFile(file: File) {
    setMessage(null);
    if (!/^video\/(mp4|webm|quicktime)$/.test(file.type)) return setMessage({ ok: false, text: "Choose an MP4 or WebM video." });
    if (file.size > 100 * 1024 * 1024)
      return setMessage({ ok: false, text: "Videos must be under 100 MB. Compress it first (for example with HandBrake, 1080p, H.264)." });
    const sig = await signVideoUploadAction();
    if (!sig.ok) return setMessage({ ok: false, text: sig.message });

    const body = new FormData();
    body.set("file", file);
    body.set("api_key", sig.apiKey);
    body.set("timestamp", String(sig.timestamp));
    body.set("signature", sig.signature);
    body.set("folder", sig.folder);

    const res = await new Promise<{ public_id?: string; error?: { message: string } }>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `https://api.cloudinary.com/v1_1/${encodeURIComponent(sig.cloudName)}/video/upload`);
      xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
      xhr.onload = () => {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          resolve({ error: { message: "Unexpected response from Cloudinary." } });
        }
      };
      xhr.onerror = () => resolve({ error: { message: "Network error during upload." } });
      xhr.send(body);
    });
    setProgress(null);
    if (!res.public_id) return setMessage({ ok: false, text: res.error?.message ?? "Upload failed." });
    const reg = await registerVideoAction(res.public_id, file.name);
    setMessage({ ok: reg.ok, text: reg.message });
    if (reg.ok) router.refresh();
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">
        Upload a video (up to 100 MB)
        <input
          type="file"
          accept="video/mp4,video/webm"
          className="mt-1.5 block text-sm"
          disabled={progress !== null}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
      </label>
      {progress !== null && (
        <div className="h-2 w-full max-w-sm overflow-hidden rounded bg-[#ece9e4]" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Upload progress">
          <div className="h-full bg-[#1c1b19]" style={{ width: `${progress}%` }} />
        </div>
      )}
      {message && <p className={`text-sm ${message.ok ? "text-emerald-800" : "text-[#b42318]"}`}>{message.text}</p>}
    </div>
  );
}
