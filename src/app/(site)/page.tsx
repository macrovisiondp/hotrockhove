import { pageMetadata, RenderPage } from "@/domain/render-page";

export const generateMetadata = () => pageMetadata("");

export default function HomePage() {
  return <RenderPage slug="" />;
}
