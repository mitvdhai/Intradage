import Link from "next/link";
import { Award, CheckCircle2, Gift, Trophy } from "lucide-react";
import { TijdlijnKaart } from "@/components/tijdlijn";
import { Lijst, PageTop, Rij, Sectie } from "@/components/ui";
import { likesVoor, punten, vestigingRanglijst, waarden, waarderingen } from "@/lib/betrokkenheid";
import { vereisGebruiker } from "@/lib/session";

export default async function Waardering({ searchParams }: PageProps<"/app/waardering">) {
  const { gegeven } = await searchParams;
  const { u, org } = await vereisGebruiker();
  const maandStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [p, lijst, ws, rang] = await Promise.all([punten(u.id), waarderingen(org, u, { limiet: 20 }), waarden(), vestigingRanglijst(org, maandStart)]);
  const likes = await likesVoor("waardering", lijst.map((w) => w.id), u.id);
  const ontvangen = lijst.filter((w) => w.aanId === u.id).length;

  return (
    <>
      <PageTop terug={{ href: "/app/meer", label: "Meer" }} titel="Waardering" sub="Laat zien wat je in je collega's waardeert" />
      {gegeven && <div className="mx-4 mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"><CheckCircle2 size={18} /> Verstuurd! Je collega krijgt er een melding van.</div>}
      <div className="grid grid-cols-2 gap-3 px-4 pt-4">
        <div className="rounded-2xl bg-navy-700 p-4 text-white">
          <div className="text-[12px] font-semibold uppercase tracking-wider text-navy-200">Jouw punten</div>
          <div className="text-3xl font-bold">{p.saldo}</div>
          <div className="text-[12px] text-navy-100">{ontvangen} waarderingen ontvangen</div>
        </div>
        <Link href="/app/waardering/geven" className="flex flex-col justify-between rounded-2xl bg-brand-600 p-4 text-white">
          <Award size={22} />
          <div><div className="font-bold">Waardeer een collega</div><div className="text-[12px] text-brand-100">+2 punten voor jou</div></div>
        </Link>
      </div>
      <Sectie>
        <Lijst><Rij href="/app/beloningen" icoon={<Gift size={18} />} titel="Beloningen" sub="Wissel je punten in" /></Lijst>
      </Sectie>
      <Sectie titel="Onze waarden">
        <div className="flex flex-wrap gap-2">
          {ws.map((w) => <span key={w.id} title={w.omschrijving} className="rounded-full bg-white px-3 py-1.5 text-[13px] font-semibold ring-1 ring-line">{w.emoji} {w.naam}</span>)}
        </div>
      </Sectie>
      <Sectie titel="Meest gewaardeerde teams deze maand">
        <Lijst>
          {rang.filter((r) => r.aantal > 0).slice(0, 3).map((r, i) => (
            <Rij key={r.vestiging.id} toon={i === 0 ? "rood" : "navy"} icoon={<Trophy size={18} />} titel={`${r.vestiging.naam} (${r.vestiging.plaats})`} sub={`${r.aantal} waardering${r.aantal === 1 ? "" : "en"}`} />
          ))}
          {!rang.some((r) => r.aantal > 0) && <Rij titel="Nog geen waarderingen deze maand" sub="Wees de eerste!" />}
        </Lijst>
      </Sectie>
      <Sectie titel="Recent">
        <div className="space-y-3">
          {lijst.map((w) => <TijdlijnKaart key={w.id} item={{ soort: "waardering", tijd: w.tijd, w, likes: likes.aantal.get(w.id) ?? 0, geliked: likes.mijn.has(w.id) }} org={org} u={u} />)}
        </div>
      </Sectie>
    </>
  );
}
