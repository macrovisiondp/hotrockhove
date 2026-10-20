"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { registerVideoAction, requestVideoUploadAction } from "./actions";

type Result = { ref?: string; error?: string };

function send(method: "PUT" | "POST", url: string, body: Blob | FormData, headers: Record<string, string>, onProgress: (p: number) => void) {
  return new Promise<{ status: number; text: string }>((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => resolve({ status: xhr.status, text: xhr.responseText });
    xhr.onerror = () => resolve({ status: 0, text: "" });
    xhr.send(body);
  });
}

/**
 * Uploads a video straight from the browser to storage (S3 presigned PUT, or a
 * signed Cloudinary upload), then asks the server to verify and register it.
 */
export function VideoUploader({ maxMb }: { maxMb: number }) {
  const router = useRouter();
  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function onFile(file: File) {
    setMessage(null);
    const contentType = file.type === "video/webm" ? "video/webm" : file.type === "video/mp4" ? "video/mp4" : "";
    if (!contentType) return setMessage({ ok: false, text: "Choose an MP4 or WebM video." });
    if (file.size > maxMb * 1024 * 1024) return setMessage({ ok: false, text: `Videos must be under ${maxMb} MB. Compress it first (for example with HandBrake, 1080p, H.264).` });

    const ticket = await requestVideoUploadAction({ filename: file.name, contentType, bytes: file.size });
    if (!ticket.ok) return setMessage({ ok: false, text: ticket.message });
    setProgress(0);

    let result: Result;
    if (ticket.provider === "s3") {
      const res = await send("PUT", ticket.uploadUrl, file, ticket.headers, setProgress);
      result =
        res.status >= 200 && res.status < 300
          ? { ref: ticket.objectKey }
          : { error: res.status === 0 ? "Upload blocked. Check the bucket's CORS settings (see Storage settings)." : `Upload failed (S3 ${res.status}).` };
    } else {
      const body = new FormData();
      body.set("file", file);
      body.set("api_key", ticket.apiKey);
      body.set("timestamp", String(ticket.timestamp));
      body.set("signature", ticket.signature);
      body.set("folder", ticket.folder);
      const res = await send("POST", `https://api.cloudinary.com/v1_1/${encodeURIComponent(ticket.cloudName)}/video/upload`, body, {}, setProgress);
      try {
        const j = JSON.parse(res.text) as { public_id?: string; error?: { message: string } };
        result = j.public_id ? { ref: j.public_id } : { error: j.error?.message ?? "Upload failed." };
      } catch {
        result = { error: "Unexpected response from Cloudinary." };
      }
    }
    setProgress(null);
    if (!result.ref) return setMessage({ ok: false, text: result.error ?? "Upload failed." });
    const reg = await registerVideoAction(result.ref, file.name);
    setMessage({ ok: reg.ok, text: reg.message });
    if (reg.ok) router.refresh();
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">
        Upload a video (MP4 or WebM, up to {maxMb} MB)
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
