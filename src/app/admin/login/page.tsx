import Image from "next/image";
import { redirect } from "next/navigation";
import { getStaffUser } from "@/lib/session";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in", robots: { index: false, follow: false } };

export default async function LoginPage() {
  if (await getStaffUser()) redirect("/admin");
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#0b0a09] px-4">
      <div className="w-full max-w-sm">
        <div className="relative mx-auto mb-8 h-[72px] w-[92px]">
          <Image src="/brand/logo-white.png" alt="Hot Rock" fill sizes="92px" className="object-contain" priority />
        </div>
        <div className="admin rounded-lg p-6 shadow-xl">
          <h1 className="text-lg font-semibold">Sign in to the website admin</h1>
          <p className="mt-1 text-sm text-[#78736b]">Staff accounts only.</p>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
