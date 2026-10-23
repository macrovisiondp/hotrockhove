"use client";

import { useEffect, useState } from "react";
import { smsSegments } from "@/lib/sms/segments";

/** Live length / message-parts counter for the SMS body textarea (by name). */
export function SmsCounter({ field, optOut }: { field: string; optOut: string }) {
  const [text, setText] = useState("");
  useEffect(() => {
    const el = document.querySelector<HTMLTextAreaElement>(`textarea[name="${field}"]`);
    if (!el) return;
    const update = () => setText(el.value);
    update();
    el.addEventListener("input", update);
    return () => el.removeEventListener("input", update);
  }, [field]);
  const full = optOut ? `${text.trim()}\n${optOut}` : text.trim();
  const { chars, segments, unicode } = smsSegments(full);
  return (
    <p className="text-xs text-[#6b665e]">
      {chars} characters including &quot;{optOut}&quot; · {segments} text message part{segments === 1 ? "" : "s"} per person
      {unicode && " (emoji or special characters make each part shorter)"}. Twilio charges per part.
    </p>
  );
}
