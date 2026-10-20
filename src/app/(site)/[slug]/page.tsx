import { notFound } from "next/navigation";
import { pageMetadata, RenderPage } from "@/domain/render-page";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function generateMetadata({ params }: PageProps<"/[slug]">) {
  const { slug } = await params;
  return SLUG.test(slug) ? pageMetadata(slug) : {};
}

export default async function ContentPage({ params }: PageProps<"/[slug]">) {
  const { slug } = await params;
  if (!SLUG.test(slug)) notFound();
  return <RenderPage slug={slug} />;
}
