"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { List } from "@phosphor-icons/react";

export function AdminNav({ sections }: { sections: { title: string; items: { href: string; label: string }[] }[] }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === "/admin" ? path === "/admin" : path === href || path.startsWith(href + "/"));
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mx-5 mb-3 inline-flex items-center gap-2 rounded-md border border-white/15 px-3 py-1.5 text-sm lg:hidden"
        aria-expanded={open}
        aria-controls="admin-nav"
      >
        <List size={18} /> Menu
      </button>
      <nav id="admin-nav" aria-label="Admin" className={`${open ? "block" : "hidden"} px-3 pb-4 lg:block`}>
        {sections.map((s) => (
          <div key={s.title} className="mb-4">
            <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[#8f887d]">{s.title}</p>
            <ul>
              {s.items.map((i) => (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    onClick={() => setOpen(false)}
                    aria-current={active(i.href) ? "page" : undefined}
                    className="block rounded-md px-2 py-1.5 text-sm text-[#d9d4cb] hover:bg-white/10 aria-[current=page]:bg-white/15 aria-[current=page]:text-white"
                  >
                    {i.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </>
  );
}
