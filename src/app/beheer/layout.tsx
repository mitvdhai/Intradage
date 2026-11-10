import Link from "next/link";
import { redirect } from "next/navigation";
import { BeheerNav } from "@/components/beheer-nav";
import { heeftBeheer, isHQ, mag, ROL_LABEL } from "@/lib/access";
import { MODULES } from "@/lib/rechten";
import { uitloggen } from "@/lib/acties";
import { DISCIPLINE_LABEL } from "@/lib/data";
import { vereisGebruiker } from "@/lib/session";

export default async function BeheerLayout({ children }: LayoutProps<"/beheer">) {
  const { u, org } = await vereisGebruiker();
  // Toegang en menu volgen de rechten (rol × module, met uitzonderingen per persoon)
  if (!heeftBeheer(org, u)) redirect("/app");
  const toegang = Object.fromEntries(MODULES.map((m) => [m.id, mag(org, u, m.id, 1)]));
  return (
    <div className="flex min-h-screen bg-canvas print:bg-white">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-navy-800 text-navy-100 md:flex print:hidden">
        <div className="flex items-center gap-2 px-5 py-5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 font-bold text-white">I</span>
          <span className="font-bold text-white">Intradage <span className="font-normal text-navy-200">beheer</span></span>
        </div>
        <BeheerNav toegang={toegang} />
        <div className="mt-auto border-t border-navy-700 px-5 py-4 text-[13px]">
          <div className="font-semibold text-white">{u.voornaam} {u.achternaam}</div>
          <div>{isHQ(u) ? `HQ ${DISCIPLINE_LABEL[u.discipline ?? "operations"]}` : ROL_LABEL[u.rol]}</div>
          <div className="mt-2 flex gap-3">
            <Link href="/app" className="underline">App</Link>
            <form action={uitloggen}><button className="underline">Wissel persoon</button></form>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-6 py-6 lg:px-10 print:p-0">{children}</main>
    </div>
  );
}
