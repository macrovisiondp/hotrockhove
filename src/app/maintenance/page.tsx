import Image from "next/image";
import { getSetting, telHref } from "@/lib/settings";

export const metadata = { title: "Back soon", robots: { index: false, follow: false } };

export default async function Maintenance() {
  const [features, business, brand] = await Promise.all([getSetting("features"), getSetting("business"), getSetting("brand")]);
  return (
    <main className="site flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center">
      <div className="relative h-[110px] w-[140px]">
        <Image src={brand.logoUrl} alt={business.name} fill sizes="140px" className="object-contain" priority />
      </div>
      <h1 className="display mt-10 text-5xl text-bone">Back soon</h1>
      <p className="mt-5 max-w-[46ch] text-lg leading-relaxed text-stone">{features.maintenanceMessage}</p>
      {business.phone && (
        <a href={telHref(business.phone)} className="btn btn-ghost mt-10">
          Call {business.phone}
        </a>
      )}
    </main>
  );
}
