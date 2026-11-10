"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, GraduationCap, Home, MessageCircle, User, Users } from "lucide-react";

const ICONEN = { home: Home, chat: MessageCircle, leren: GraduationCap, team: Users, handboek: BookOpen, werk: User };
export type TabIcoon = keyof typeof ICONEN;

export function TabBar({ tabs }: { tabs: { href: string; label: string; icoon: TabIcoon; badge?: number }[] }) {
  const pad = usePathname();
  const actief = (href: string) => (href === "/app" ? pad === "/app" || pad.startsWith("/app/berichten") || pad.startsWith("/app/meldingen") : pad.startsWith(href));
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="grid grid-cols-5">
        {tabs.map((t) => {
          const I = ICONEN[t.icoon];
          const on = actief(t.href);
          return (
            <li key={t.href}>
              <Link href={t.href} className={`relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium ${on ? "text-brand-600" : "text-slate-500"}`}>
                <I size={22} strokeWidth={on ? 2.4 : 1.8} />
                {t.label}
                {!!t.badge && <span className="absolute right-[22%] top-2 grid h-4 min-w-4 place-items-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">{t.badge}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
