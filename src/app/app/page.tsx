import Link from "next/link";
import { Bell, Cake, CheckCircle2, ClipboardCheck, GraduationCap, Megaphone, Repeat, UserCheck } from "lucide-react";
import { Label, Lijst, Rij, Sectie, Voortgang, tijdLabel, uurLabel } from "@/components/ui";
import { afzenderLabel, berichtenVoor, isBevestigd, isGelezen, teDoen, vestigingNaam, verjaardagenBinnenkort } from "@/lib/data";
import { vereisGebruiker } from "@/lib/session";
import { staff } from "@/lib/store";
import { nuMs } from "@/lib/tijd";

const ICOON = { bericht: CheckCircle2, leren: GraduationCap, beoordelen: ClipboardCheck, ruil: Repeat, zelfbeoordeling: UserCheck };

export default async function Home() {
  const u = await vereisGebruiker();
  const taken = teDoen(u);
  const nieuws = berichtenVoor(u).filter((b) => isBevestigd(b, u)).slice(0, 3);
  const rooster = await staff.rooster(u, new Date(), new Date(nuMs() + 14 * 86400000));
  const volgende = rooster.find((d) => new Date(d.eind) > new Date());
  const collegas = volgende ? await staff.collegas(volgende) : [];
  const jarig = verjaardagenBinnenkort(u).filter((j) => j.g.id !== u.id);
  const uur = new Date().getHours();
  const groet = uur < 12 ? "Goedemorgen" : uur < 18 ? "Goedemiddag" : "Goedenavond";

  return (
    <>
      <header className="flex items-end justify-between bg-white px-5 pb-4 pt-5">
        <div>
          <div className="text-[13px] text-muted">{new Date().toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" })}</div>
          <h1 className="text-2xl font-bold tracking-tight">{groet}, {u.voornaam}</h1>
        </div>
        <Link href="/app/meldingen" className="relative grid h-11 w-11 place-items-center rounded-full bg-navy-50 text-navy-700" aria-label="Meldingen">
          <Bell size={20} />
          {taken.length > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-brand-600 px-1 text-[11px] font-bold text-white">{taken.length}</span>}
        </Link>
      </header>

      {volgende && (
        <div className="px-4 pt-4">
          <Link href="/app/werk" className="block overflow-hidden rounded-2xl bg-navy-700 p-4 text-white shadow-sm">
            <div className="text-[12px] font-semibold uppercase tracking-wider text-navy-200">Volgende dienst · {new Date(volgende.start).toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "short" })}</div>
            <div className="mt-1 text-3xl font-bold tracking-tight">{uurLabel(volgende.start)} – {uurLabel(volgende.eind)}</div>
            <div className="mt-1 text-sm text-navy-100">{vestigingNaam(volgende.vestigingId)} · {volgende.taak}{collegas.length ? ` · met ${collegas.join(", ")}` : ""}</div>
            <div className="mt-3 h-1 w-12 rounded-full bg-brand-500" />
          </Link>
        </div>
      )}

      <Sectie titel="Te doen" rechts={taken.length ? <Label toon="rood">{taken.length}</Label> : undefined}>
        {taken.length ? (
          <Lijst>
            {taken.map((t) => {
              const I = ICOON[t.soort];
              return <Rij key={t.id} href={t.href} toon={t.urgent ? "rood" : "navy"} icoon={<I size={18} />} titel={t.titel} sub={t.sub} onderaan={t.pct !== undefined ? <Voortgang pct={t.pct} /> : undefined} />;
            })}
          </Lijst>
        ) : (
          <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"><CheckCircle2 size={18} /> Je bent helemaal bij.</div>
        )}
      </Sectie>

      <Sectie titel="Nieuws" rechts={<Link href="/app/berichten">Alles</Link>}>
        <Lijst>
          {nieuws.map((b) => (
            <Rij key={b.id} href={`/app/berichten/${b.id}`} icoon={<Megaphone size={18} />} toon={isGelezen(b, u) ? "grijs" : "navy"}
              titel={b.titel} sub={`${afzenderLabel(b)} · ${tijdLabel(b.gepubliceerd)}`}
              rechts={!isGelezen(b, u) ? <span className="h-2.5 w-2.5 rounded-full bg-brand-600" aria-label="Ongelezen" /> : undefined} />
          ))}
        </Lijst>
      </Sectie>

      {jarig.length > 0 && (
        <Sectie titel="Binnenkort">
          <Lijst>
            {jarig.map(({ g, dt }) => (
              <Rij key={g.id} icoon={<Cake size={18} />} titel={`${g.voornaam} is jarig`} sub={dt.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" })} />
            ))}
          </Lijst>
        </Sectie>
      )}
    </>
  );
}
