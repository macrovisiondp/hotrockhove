"use client";

import { usePathname } from "next/navigation";
import { Header, type HeaderLink } from "./header";

/** Chooses the overlay (transparent-over-hero) style per page on the client, so it follows client navigation. */
export function SiteHeader(props: {
  links: HeaderLink[];
  logoUrl: string;
  brandName: string;
  phoneHref: string | null;
  overlayPaths: string[];
}) {
  const pathname = usePathname();
  const overlay = props.overlayPaths.includes(pathname);
  return (
    <Header
      key={overlay ? "overlay" : "solid"}
      links={props.links}
      logoUrl={props.logoUrl}
      brandName={props.brandName}
      phoneHref={props.phoneHref}
      overlay={overlay}
    />
  );
}
