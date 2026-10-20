import Link from "next/link";

export default function NotFound() {
  return (
    <main className="site flex min-h-[100dvh] flex-col items-start justify-center px-6 sm:px-12">
      <p className="eyebrow">Page not found</p>
      <h1 className="display mt-5 max-w-3xl text-5xl text-bone sm:text-7xl">This table isn&apos;t on the floor plan.</h1>
      <p className="mt-6 max-w-[50ch] text-lg leading-relaxed text-stone">The page you were looking for has moved or no longer exists.</p>
      <Link href="/" className="btn btn-primary mt-10">
        Homepage
      </Link>
    </main>
  );
}
