import Link from "next/link";
import { TabBar, type TabIcoon } from "@/components/tabbar";
import { isLeiding, magBeheer, ROL_LABEL } from "@/lib/access";
import { uitloggen } from "@/lib/acties";
import { teDoen } from "@/lib/data";
import { vereisGebruiker } from "@/lib/session";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const u = await vereisGebruiker();
  const open = teDoen(u).length;
  const tabs: { href: string; label: string; icoon: TabIcoon; badge?: number }[] = [
    { href: "/app", label: "Home", icoon: "home", badge: open },
    { href: "/app/chat", label: "Chat", icoon: "chat" },
    isLeiding(u) ? { href: "/app/team", label: "Team", icoon: "team" } : { href: "/app/leren", label: "Leren", icoon: "leren" },
    { href: "/app/handboek", label: "Handboek", icoon: "handboek" },
    { href: "/app/werk", label: "Mijn werk", icoon: "werk" },
  ];
  return (
    <div className="min-h-screen bg-canvas">
      {/* Demo-balk: alleen zichtbaar op grotere schermen */}
      <div className="hidden bg-navy-900 text-[12px] text-navy-100 sm:block">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-1.5">
          <span>Demo · {u.voornaam} ({ROL_LABEL[u.rol]})</span>
          <span className="flex gap-3">
            {magBeheer(u) && <Link href="/beheer" className="underline">Beheer</Link>}
            <form action={uitloggen}><button className="underline">Wissel persoon</button></form>
          </span>
        </div>
      </div>
      <div className="mx-auto min-h-screen max-w-md bg-canvas pb-24 sm:border-x sm:border-line">{children}</div>
      <TabBar tabs={tabs} />
    </div>
  );
}
