import Image from "next/image";
import type { PublicMedia } from "@/domain/content";

/** Insert Cloudinary delivery transformations (format/quality/width) into a secure URL. */
export function cloudinaryTransform(url: string, transform: string): string {
  return url.includes("res.cloudinary.com") ? url.replace("/upload/", `/upload/${transform}/`) : url;
}

export function MediaImage({
  media,
  sizes,
  className = "",
  priority = false,
  fill = true,
}: {
  media: PublicMedia;
  sizes: string;
  className?: string;
  priority?: boolean;
  fill?: boolean;
}) {
  if (media.mimeType.startsWith("video/")) {
    return media.posterUrl ? (
      <Image src={media.posterUrl} alt={media.alt} fill sizes={sizes} className={`object-cover ${className}`} priority={priority} />
    ) : null;
  }
  if (fill) {
    return <Image src={media.url} alt={media.alt} fill sizes={sizes} priority={priority} className={`object-cover ${className}`} />;
  }
  return (
    <Image
      src={media.url}
      alt={media.alt}
      width={media.width ?? 1200}
      height={media.height ?? 800}
      sizes={sizes}
      priority={priority}
      className={className}
    />
  );
}

/**
 * Click-to-play video: only the poster loads until the visitor presses play,
 * which keeps bandwidth (and storage/CDN costs) low. Muted autoplay is used only
 * for hero backgrounds (see HeroVideo).
 */
export function MediaVideo({ media, className = "" }: { media: PublicMedia; className?: string }) {
  const src = cloudinaryTransform(media.url, "q_auto,vc_auto,w_1280");
  return (
    <video
      controls
      playsInline
      preload="none"
      poster={media.posterUrl ?? undefined}
      className={`h-full w-full bg-ink-900 object-cover ${className}`}
      aria-label={media.alt || undefined}
    >
      <source src={src} type={media.mimeType} />
    </video>
  );
}
