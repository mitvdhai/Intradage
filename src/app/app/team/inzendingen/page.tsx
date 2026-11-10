import { redirect } from "next/navigation";
import { Camera } from "lucide-react";
import { Leeg, PageTop, Sectie, tijdLabel } from "@/components/ui";
import { isLeiding, teamVan } from "@/lib/access";
import { beoordeelInzending } from "@/lib/acties";
import { alleLeerItems, inzendingenVan, naamVan } from "@/lib/data";
import { vereisGebruiker } from "@/lib/session";

export default async function Inzendingen() {
  const { u, org } = await vereisGebruiker();
  if (!isLeiding(u)) redirect("/app");
  const lijst = await inzendingenVan(teamVan(org, u).map((t) => t.id));
  const alleItems = new Map((await alleLeerItems()).map((i) => [i.id, i]));
  return (
    <>
      <PageTop terug={{ href: "/app/team", label: "Team" }} titel="Inzendingen" />
      <Sectie>
        {lijst.length ? (
          <div className="space-y-3">
            {lijst.map((v) => {
              const item = alleItems.get(v.itemId) ?? { titel: v.itemId };
              const actie = beoordeelInzending.bind(null, v.gebruikerId, v.itemId);
              return (
                <form key={`${v.gebruikerId}-${v.itemId}`} action={actie} className="overflow-hidden rounded-2xl border border-line bg-white">
                  <div className="grid aspect-[4/3] place-items-center bg-gradient-to-br from-navy-50 to-navy-100 text-navy-600"><Camera size={40} strokeWidth={1.5} /></div>
                  <div className="p-4">
                    <div className="font-semibold">{item.titel}</div>
                    <div className="text-[13px] text-muted">{naamVan(org, v.gebruikerId)} · {tijdLabel(v.tijd)}</div>
                    {v.inzending && <p className="mt-2 text-[14px]">“{v.inzending}”</p>}
                    <input name="feedback" placeholder="Feedback (optioneel)" className="tap mt-3 w-full rounded-xl border border-line px-3 text-[15px]" />
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button name="akkoord" value="nee" className="tap rounded-xl text-sm font-semibold ring-1 ring-line">Nog niet goed</button>
                      <button name="akkoord" value="ja" className="tap rounded-xl bg-brand-600 text-sm font-semibold text-white">Goedkeuren</button>
                    </div>
                  </div>
                </form>
              );
            })}
          </div>
        ) : <Leeg>Geen inzendingen om te beoordelen.</Leeg>}
      </Sectie>
    </>
  );
}
