import { CalendarDays, MapPin } from "lucide-react";
import { Leeg, PageTop, Sectie, cx, uurLabel } from "@/components/ui";
import { meldAan } from "@/lib/acties-betrokkenheid";
import { evenementenVoor } from "@/lib/betrokkenheid";
import { voornaamVan } from "@/lib/data";
import { vereisGebruiker } from "@/lib/session";

export default async function Evenementen() {
  const { u, org } = await vereisGebruiker();
  const lijst = await evenementenVoor(org, u);
  return (
    <>
      <PageTop terug={{ href: "/app/meer", label: "Meer" }} titel="Evenementen" />
      <Sectie>
        {lijst.length ? (
          <div className="space-y-3">
            {lijst.map((e) => (
              <article key={e.id} className="overflow-hidden rounded-2xl border border-line bg-white">
                <div className="flex gap-3 p-4">
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-navy-700 text-center text-white">
                    <div><div className="text-[11px] uppercase">{e.start.toLocaleDateString("nl-NL", { month: "short" })}</div><div className="text-xl font-bold leading-none">{e.start.getDate()}</div></div>
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold">{e.titel}</h3>
                    <div className="flex items-center gap-1 text-[13px] text-muted"><CalendarDays size={13} /> {e.start.toLocaleDateString("nl-NL", { weekday: "long" })} {uurLabel(e.start.toISOString())}</div>
                    <div className="flex items-center gap-1 text-[13px] text-muted"><MapPin size={13} /> {e.locatie}</div>
                    <p className="mt-1.5 text-[14px]">{e.omschrijving}</p>
                    {e.ja.length > 0 && <p className="mt-1.5 text-[12px] text-muted">Gaan: {e.ja.map((g) => voornaamVan(org, g)).join(", ")}{e.misschien ? ` · ${e.misschien} misschien` : ""}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-3 border-t border-line">
                  {(["ja", "misschien", "nee"] as const).map((s) => (
                    <form key={s} action={meldAan.bind(null, e.id, s)}>
                      <button className={cx("tap w-full text-[14px] font-semibold", e.mijnStatus === s ? (s === "ja" ? "bg-brand-600 text-white" : "bg-navy-700 text-white") : "text-ink")}>
                        {s === "ja" ? "Ik ga" : s === "misschien" ? "Misschien" : "Kan niet"}
                      </button>
                    </form>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : <Leeg>Er staan geen evenementen gepland.</Leeg>}
      </Sectie>
    </>
  );
}
