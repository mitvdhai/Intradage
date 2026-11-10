import { notFound } from "next/navigation";
import { Repeat, Send } from "lucide-react";
import { PageTop, cx, dagLabel, uurLabel } from "@/components/ui";
import { isHQ } from "@/lib/access";
import { neemDienstOver, stuurChat } from "@/lib/acties";
import { chatGroepenVoor, chatVan, ledenVan, ruilverzoeken, voornaamVan } from "@/lib/data";
import { vereisGebruiker } from "@/lib/session";
import { staff } from "@/lib/staff/adapter";
import { nuMs } from "@/lib/tijd";

export default async function ChatGroep({ params }: PageProps<"/app/chat/[id]">) {
  const { id } = await params;
  const { u, org } = await vereisGebruiker();
  const groep = (await chatGroepenVoor(org, u)).find((g) => g.id === id);
  if (!groep) notFound();
  const [berichten, ruilen] = await Promise.all([chatVan(groep.id), ruilverzoeken()]);
  const magSchrijven = !groep.alleenLezen || isHQ(u);

  return (
    <div className="flex min-h-[calc(100vh-6rem)] flex-col">
      <PageTop terug={{ href: "/app/chat", label: "Chats" }} titel={groep.naam} sub={`${ledenVan(org, groep).length} leden${groep.alleenLezen ? " · alleen-lezen" : " · automatisch bijgewerkt"}`} />
      <div className="flex-1 space-y-2 px-4 py-4">
        {await Promise.all(berichten.map(async (c) => {
          const ik = c.gebruikerId === u.id;
          const ruil = c.ruilDienstId ? ruilen.find((r) => r.dienstId === c.ruilDienstId) : undefined;
          const aanbieder = ruil ? org.gebruikers.find((g) => g.id === ruil.aangebodenDoor) : undefined;
          const dienst = aanbieder ? (await staff.rooster(aanbieder, new Date(0), new Date(nuMs() + 30 * 86400000))).find((d) => d.id === ruil!.dienstId) : undefined;
          return (
            <div key={c.id} className={cx("max-w-[85%]", ik && "ml-auto")}>
              <div className={cx("rounded-2xl px-3.5 py-2 text-[15px]", ik ? "rounded-br-md bg-navy-700 text-white" : "rounded-bl-md bg-white ring-1 ring-line")}>
                {!ik && <div className="text-[12px] font-semibold text-navy-600">{voornaamVan(org, c.gebruikerId)}</div>}
                {c.tekst}
                <div className={cx("mt-0.5 text-right text-[10px]", ik ? "text-navy-200" : "text-muted")}>{uurLabel(c.tijd)}</div>
              </div>
              {ruil && dienst && (
                <div className="mt-1.5 rounded-2xl border border-brand-100 bg-brand-50 p-3">
                  <div className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-brand-700"><Repeat size={14} /> Dienst aangeboden</div>
                  <div className="mt-1 font-semibold">{dagLabel(dienst.start)} · {uurLabel(dienst.start)} – {uurLabel(dienst.eind)}</div>
                  <div className="text-[13px] text-muted">{dienst.taak}</div>
                  {ruil.status === "open" && ruil.aangebodenDoor !== u.id && aanbieder?.functieId === u.functieId ? (
                    <form action={neemDienstOver.bind(null, ruil.id)} className="mt-2"><button className="tap w-full rounded-xl bg-brand-600 text-sm font-semibold text-white">Ik neem hem over</button></form>
                  ) : (
                    <div className="mt-2 text-[13px] font-medium text-brand-700">
                      {ruil.status === "open" ? "Open voor collega's met dezelfde functie" : ruil.status === "wacht-op-akkoord" ? `${voornaamVan(org, ruil.overgenomenDoor!)} neemt over · wacht op akkoord` : ruil.status === "goedgekeurd" ? `Goedgekeurd · ${voornaamVan(org, ruil.overgenomenDoor!)} werkt` : "Afgewezen"}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        }))}
      </div>
      {magSchrijven ? (
        <form action={stuurChat.bind(null, groep.id)} className="sticky bottom-16 flex gap-2 border-t border-line bg-white px-3 py-2">
          <input name="tekst" required autoComplete="off" placeholder="Bericht…" className="tap min-w-0 flex-1 rounded-full bg-slate-100 px-4 text-[15px] outline-none" />
          <button aria-label="Verstuur" className="grid h-11 w-11 place-items-center rounded-full bg-brand-600 text-white"><Send size={18} /></button>
        </form>
      ) : (
        <div className="border-t border-line bg-white px-4 py-3 text-center text-[13px] text-muted">Alleen HQ plaatst berichten in dit kanaal.</div>
      )}
    </div>
  );
}
