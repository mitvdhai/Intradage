"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarRange, ClipboardCheck, ClipboardList, Clock, Heart, LayoutDashboard, Megaphone, Network, Palmtree, Scale, ScrollText, Store, UserPlus, Users,
} from "lucide-react";

type Item = { href: string; label: string; icoon: typeof Users };

export function BeheerNav({ hq, alleenPersoneel }: { hq: boolean; alleenPersoneel?: boolean }) {
  const pad = usePathname();
  const groepen: { titel: string; items: Item[] }[] = [
    ...(alleenPersoneel ? [] : [{ titel: "Organisatie", items: [
      { href: "/beheer", label: "Overzicht", icoon: LayoutDashboard },
      { href: "/beheer/berichten", label: "Berichten", icoon: Megaphone },
      { href: "/beheer/betrokkenheid", label: "Betrokkenheid", icoon: Heart },
      { href: "/beheer/evaluaties", label: "Evaluaties", icoon: ClipboardList },
      { href: "/beheer/beoordelingen", label: "Beoordelingen", icoon: ClipboardCheck },
      { href: "/beheer/functiehuis", label: "Functiehuis", icoon: Network },
      ...(hq ? [{ href: "/beheer/regeling", label: "Beloningsregeling", icoon: Scale }, { href: "/beheer/logboek", label: "Logboek", icoon: ScrollText }] : []),
    ] }]),
    { titel: "Personeel", items: [
      { href: "/beheer/planning", label: "Planning", icoon: CalendarRange },
      { href: "/beheer/personeel", label: "Medewerkers", icoon: Users },
      { href: "/beheer/werving", label: "Werving", icoon: UserPlus },
      { href: "/beheer/uren", label: "Uren", icoon: Clock },
      { href: "/beheer/verlof", label: "Verlof en ziekte", icoon: Palmtree },
      { href: "/beheer/vestigingen", label: "Vestigingen", icoon: Store },
    ] },
  ];
  return (
    <nav className="space-y-4 px-3">
      {groepen.map((g) => (
        <div key={g.titel}>
          <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-navy-300">{g.titel}</div>
          <div className="space-y-0.5">
            {g.items.map((i) => {
              const on = i.href === "/beheer" ? pad === "/beheer" : pad.startsWith(i.href);
              return (
                <Link key={i.href} href={i.href} className={`flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-medium ${on ? "bg-navy-700 text-white" : "text-navy-100 hover:bg-navy-700/60"}`}>
                  <i.icoon size={17} className={on ? "text-brand-500" : ""} /> {i.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
