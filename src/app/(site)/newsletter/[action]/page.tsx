import Link from "next/link";
import { notFound } from "next/navigation";
import { confirmSubscription, unsubscribe } from "@/domain/newsletter";

export const metadata = { robots: { index: false, follow: false } };

/**
 * Confirm / unsubscribe pages. Confirmation runs on page load (a GET); the link is
 * single-purpose and idempotent. Unsubscribe requires a button press so that link
 * scanners in mail filters can't unsubscribe people by prefetching the URL.
 */
export default async function NewsletterAction({ params, searchParams }: PageProps<"/newsletter/[action]">) {
  const { action } = await params;
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  const done = sp.done === "1";

  let heading: string;
  let body: React.ReactNode;

  if (action === "confirm") {
    const result = await confirmSubscription(token);
    heading = result === "confirmed" ? "You're subscribed" : "This link has expired";
    body =
      result === "confirmed"
        ? "Thank you for confirming. We'll be in touch with offers and news. You can unsubscribe from any email we send."
        : "The confirmation link is invalid or has already been used. You can sign up again from our homepage.";
  } else if (action === "unsubscribe") {
    if (done) {
      heading = "You've been unsubscribed";
      body = "You won't receive any more marketing emails from us.";
    } else {
      heading = "Unsubscribe";
      body = (
        <form
          action={async () => {
            "use server";
            const { redirect } = await import("next/navigation");
            await unsubscribe(token);
            redirect("/newsletter/unsubscribe?done=1");
          }}
        >
          <p>Press the button to stop receiving our emails.</p>
          <button type="submit" className="btn btn-primary mt-8">
            Unsubscribe
          </button>
        </form>
      );
    }
  } else {
    notFound();
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
