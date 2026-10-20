"use server";

import { z } from "zod";
import { handleSubmission, type PublicFormState } from "@/domain/forms/submit";
import { subscribe } from "@/domain/newsletter";

const formKey = z.string().regex(/^[a-z_]{1,40}$/);
const source = z.string().regex(/^[a-z0-9:_-]{1,60}$/);

/** Public form submission. The form key is bound on the server-rendered form. */
export async function submitFormAction(key: string, _prev: PublicFormState, fd: FormData): Promise<PublicFormState> {
  if (!formKey.safeParse(key).success) return { status: "error", message: "Unknown form.", at: Date.now() };
  return handleSubmission(key, fd);
}

export async function subscribeAction(src: string, _prev: PublicFormState, fd: FormData): Promise<PublicFormState> {
  return subscribe(fd, source.safeParse(src).success ? src : "site");
}
