"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardCheck, ClipboardList, Heart, LayoutDashboard, Megaphone, Network, Scale, ScrollText } from "lucide-react";

export function BeheerNav({ hq }: { hq: boolean }) {
  const pad = usePathname();
  const items = [
    { href: "/beheer", label: "Overzicht", icoon: LayoutDashboard },
    { href: "/beheer/berichten", label: "Berichten", icoon: Megaphone },
    { href: "/beheer/betrokkenheid", label: "Betrokkenheid", icoon: Heart },
    { href: "/beheer/evaluaties", label: "Evaluaties", icoon: ClipboardList },
    { href: "/beheer/beoordelingen", label: "Beoordelingen", icoon: ClipboardCheck },
    { href: "/beheer/functiehuis", label: "Functiehuis", icoon: Network },
    ...(hq ? [{ href: "/beheer/regeling", label: "Beloningsregeling", icoon: Scale }, { href: "/beheer/logboek", label: "Logboek", icoon: ScrollText }] : []),
  ];
  return (
    <nav className="space-y-0.5 px-3">
      {items.map((i) => {
        const on = i.href === "/beheer" ? pad === "/beheer" : pad.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${on ? "bg-navy-700 text-white" : "text-navy-100 hover:bg-navy-700/60"}`}>
            <i.icoon size={18} className={on ? "text-brand-500" : ""} /> {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
