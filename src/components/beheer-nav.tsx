"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen, CalendarRange, ClipboardCheck, ClipboardList, Clock, GraduationCap, Heart, KeyRound, LayoutDashboard, Megaphone, Network, Palmtree, Scale, ScrollText, Settings2, Store, UserPlus, Users,
} from "lucide-react";

type Item = { href: string; label: string; icoon: typeof Users; module?: string };

const GROEPEN: { titel: string; items: Item[] }[] = [
  { titel: "Organisatie", items: [
    { href: "/beheer", label: "Overzicht", icoon: LayoutDashboard },
    { href: "/beheer/berichten", label: "Berichten", icoon: Megaphone, module: "berichten" },
    { href: "/beheer/betrokkenheid", label: "Betrokkenheid", icoon: Heart, module: "betrokkenheid" },
    { href: "/beheer/evaluaties", label: "Evaluaties", icoon: ClipboardList, module: "evaluaties" },
  ] },
  { titel: "Kennis en ontwikkeling", items: [
    { href: "/beheer/handboek", label: "Handboek", icoon: BookOpen, module: "handboek" },
    { href: "/beheer/leren", label: "Leren", icoon: GraduationCap, module: "leren" },
    { href: "/beheer/beoordelingen", label: "Beoordelingen", icoon: ClipboardCheck, module: "beoordelingen" },
    { href: "/beheer/functiehuis", label: "Functiehuis", icoon: Network, module: "functiehuis" },
    { href: "/beheer/regeling", label: "Beloningsregeling", icoon: Scale, module: "regeling" },
  ] },
  { titel: "Personeel", items: [
    { href: "/beheer/planning", label: "Planning", icoon: CalendarRange, module: "planning" },
    { href: "/beheer/personeel", label: "Medewerkers", icoon: Users, module: "medewerkers" },
    { href: "/beheer/werving", label: "Werving", icoon: UserPlus, module: "werving" },
    { href: "/beheer/uren", label: "Uren", icoon: Clock, module: "uren" },
    { href: "/beheer/verlof", label: "Verlof en ziekte", icoon: Palmtree, module: "verlof" },
    { href: "/beheer/vestigingen", label: "Vestigingen", icoon: Store, module: "vestigingen" },
  ] },
  { titel: "Beheer", items: [
    { href: "/beheer/instellingen", label: "Instellingen", icoon: Settings2, module: "instellingen|organisatie" },
    { href: "/beheer/rechten", label: "Rollen en rechten", icoon: KeyRound, module: "rechten" },
    { href: "/beheer/logboek", label: "Logboek", icoon: ScrollText, module: "logboek" },
  ] },
];

/** Menu van de beheeromgeving: je ziet alleen de onderdelen waar je (minstens) bekijkrechten op hebt. */
export function BeheerNav({ toegang }: { toegang: Record<string, boolean> }) {
  const pad = usePathname();
  const zichtbaar = (i: Item) => !i.module || i.module.split("|").some((m) => toegang[m]);
  return (
    <nav className="space-y-3 overflow-y-auto px-3">
      {GROEPEN.map((g) => ({ ...g, items: g.items.filter(zichtbaar) })).filter((g) => g.items.length).map((g) => (
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
