import Link from "next/link";

export default function NotFound() {
  return (
    <section className="mx-auto max-w-[1400px] px-4 pb-32 pt-36 sm:px-6 lg:px-10 lg:pt-44">
      <p className="eyebrow">Page not found</p>
      <h1 className="display mt-5 max-w-3xl text-5xl text-bone sm:text-7xl">This table isn&apos;t on the floor plan.</h1>
      <p className="mt-6 max-w-[50ch] text-lg leading-relaxed text-stone">The page you were looking for has moved or no longer exists.</p>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/" className="btn btn-primary">
          Homepage
        </Link>
        <Link href="/our-menus" className="btn btn-ghost">
          Our menu
        </Link>
      </div>
    </section>
  );
}
