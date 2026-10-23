import Link from "next/link";
import { emailFromUnsubscribeToken, unsubscribeEmail } from "@/domain/marketing";

export const metadata = { title: "Unsubscribe", robots: { index: false, follow: false } };

/**
 * Unsubscribe from marketing emails (link in every campaign email). Requires a
 * button press so mail-filter link scanners can't unsubscribe people by visiting it.
 */
export default async function Unsubscribe({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const token = typeof sp.t === "string" ? sp.t : "";
  const email = emailFromUnsubscribeToken(token);
  const done = sp.done === "1";

  let heading: string;
  let body: React.ReactNode;
  if (done) {
    heading = "You've been unsubscribed";
    body = "You won't receive any more marketing emails from us.";
  } else if (!email) {
    heading = "This link isn't valid";
    body = "Please use the unsubscribe link in the most recent email you received from us.";
  } else {
    heading = "Unsubscribe";
    body = (
      <form
        action={async () => {
          "use server";
          const { redirect } = await import("next/navigation");
          const confirmed = emailFromUnsubscribeToken(token);
          if (confirmed) await unsubscribeEmail(confirmed);
          redirect("/unsubscribe?done=1");
        }}
      >
        <p>Stop marketing emails to {email.replace(/^(.).*(@.*)$/, "$1…$2")}?</p>
        <button type="submit" className="btn btn-primary mt-8">
          Unsubscribe
        </button>
      </form>
    );
  }

  return (
    <section className="mx-auto max-w-2xl px-4 pb-32 pt-36 sm:px-6 lg:pt-44">
      <h1 className="display text-5xl text-bone sm:text-6xl">{heading}</h1>
      <div className="mt-6 text-lg leading-relaxed text-stone">{body}</div>
      <Link href="/" className="link-underline mt-12 inline-block text-sm uppercase tracking-[0.16em] text-bone">
        Back to the homepage
      </Link>
    </section>
  );
}
