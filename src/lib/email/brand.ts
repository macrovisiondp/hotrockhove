import "server-only";
import { env } from "@/lib/env";
import { formatAddress, getSettingFresh } from "@/lib/settings";

/** What every email needs to look like the website: logo, accent colour and contact footer. */
export type EmailBrand = {
  name: string;
  /** Absolute URL of the logo shown in the header (email clients can't load relative paths). */
  logoUrl: string;
  /** Hex accent from Site settings → Brand. */
  accent: string;
  siteUrl: string;
  address: string;
  phone: string;
  email: string;
};

/** Small (280px, ~15 KB) copy of the white logo made for email headers. */
const EMAIL_LOGO = "/brand/logo-email.png";

export async function getEmailBrand(): Promise<EmailBrand> {
  const [business, brand] = await Promise.all([getSettingFresh("business"), getSettingFresh("brand")]);
  const siteUrl = env().APP_URL.replace(/\/+$/, "");
  // A custom https logo (e.g. uploaded to the media library) wins; the default
  // brand logo is swapped for its lightweight email copy.
  const logo = /^https:\/\//.test(brand.logoUrl) ? brand.logoUrl : `${siteUrl}${brand.logoUrl === "/brand/logo-white.png" ? EMAIL_LOGO : brand.logoUrl}`;
  return {
    name: business.name,
    logoUrl: logo,
    accent: brand.accentColour,
    siteUrl,
    address: formatAddress(business),
    phone: business.phone,
    email: business.email,
  };
}
