import Link from "next/link";
import { Bell, CalendarDays, CheckCircle2, Search } from "lucide-react";
import { PostPlaatsen } from "@/components/post-plaatsen";
import { TE_DOEN_ICOON } from "@/components/te-doen";
import { TijdlijnKaart } from "@/components/tijdlijn";
import { Label, Lijst, Rij, Sectie, Voortgang, uurLabel } from "@/components/ui";
import { evenementenVoor, tijdlijn } from "@/lib/betrokkenheid";
import { teDoen, vestigingNaam } from "@/lib/data";
import { vereisGebruiker } from "@/lib/session";
import { staff } from "@/lib/staff/adapter";
import { dagenVanaf } from "@/lib/tijd";

export default async function Home() {
  const { u, org } = await vereisGebruiker();
  const [taken, items, rooster, evenementen] = await Promise.all([
    teDoen(org, u), tijdlijn(org, u), staff.rooster(u, new Date(), dagenVanaf(14)), evenementenVoor(org, u),
  ]);
  const volgende = rooster.find((d) => new Date(d.eind) > new Date());
  const collegas = volgende ? await staff.collegas(volgende, org.gebruikers) : [];
  const evenement = evenementen[0];
  const uur = new Date().getHours();
  const groet = uur < 12 ? "Goedemorgen" : uur < 18 ? "Goedemiddag" : "Goedenavond";
  const groep = u.rol === "franchisenemer" ? "je teams" : `Team ${vestigingNaam(org, u.vestigingIds[0] ?? "")}`;

  return (
    <>
      <header className="bg-white px-5 pb-3 pt-5">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[13px] text-muted">{new Date().toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" })}</div>
            <h1 className="text-2xl font-bold tracking-tight">{groet}, {u.voornaam}</h1>
          </div>
          <Link href="/app/meldingen" className="relative grid h-11 w-11 place-items-center rounded-full bg-navy-50 text-navy-700" aria-label="Meldingen">
            <Bell size={20} />
            {taken.length > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-brand-600 px-1 text-[11px] font-bold text-white">{taken.length}</span>}
          </Link>
        </div>
        <Link href="/app/handboek" className="tap mt-3 flex items-center gap-2 rounded-xl bg-slate-100 px-3.5 text-[15px] text-muted">
          <Search size={17} /> Vraag het handboek…
        </Link>
      </header>

      {volgende && (
        <div className="px-4 pt-4">
          <Link href="/app/werk" className="block overflow-hidden rounded-2xl bg-navy-700 p-4 text-white shadow-sm">
            <div className="text-[12px] font-semibold uppercase tracking-wider text-navy-200">Volgende dienst · {new Date(volgende.start).toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "short" })}</div>
            <div className="mt-1 text-3xl font-bold tracking-tight">{uurLabel(volgende.start)} – {uurLabel(volgende.eind)}</div>
            <div className="mt-1 text-sm text-navy-100">{vestigingNaam(org, volgende.vestigingId)} · {volgende.taak}{collegas.length ? ` · met ${collegas.join(", ")}` : ""}</div>
            <div className="mt-3 h-1 w-12 rounded-full bg-brand-500" />
          </Link>
        </div>
      )}

      <Sectie titel="Te doen" rechts={taken.length ? <Label toon="rood">{taken.length}</Label> : undefined}>
        {taken.length ? (
          <Lijst>
            {taken.slice(0, 4).map((t) => {
              const I = TE_DOEN_ICOON[t.soort];
              return <Rij key={t.id} href={t.href} toon={t.urgent ? "rood" : "navy"} icoon={<I size={18} />} titel={t.titel} sub={t.sub} onderaan={t.pct !== undefined ? <Voortgang pct={t.pct} /> : undefined} />;
            })}
            {taken.length > 4 && <Rij href="/app/meldingen" titel={`Nog ${taken.length - 4} meer`} />}
          </Lijst>
        ) : (
          <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"><CheckCircle2 size={18} /> Je bent helemaal bij.</div>
        )}
      </Sectie>

      {evenement && (
        <Sectie titel="Binnenkort">
          <Lijst>
            <Rij href="/app/evenementen" icoon={<CalendarDays size={18} />} titel={evenement.titel}
              sub={`${new Date(evenement.start).toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" })} · ${uurLabel(evenement.start.toISOString())} · ${evenement.ja.length} gaan`}
              rechts={evenement.mijnStatus === "ja" ? <Label toon="groen">Je gaat</Label> : <Label>Meld je aan</Label>} />
          </Lijst>
        </Sectie>
      )}

      <Sectie titel="Tijdlijn">
        <div className="space-y-3">
          {u.rol !== "hq" && <PostPlaatsen voornaam={u.voornaam} groep={groep} />}
          {items.map((item) => <TijdlijnKaart key={`${item.soort}-${item.soort === "bericht" ? item.b.id : item.soort === "waardering" ? item.w.id : item.m.id}`} item={item} org={org} u={u} />)}
        </div>
      </Sectie>
    </>
  );
}
