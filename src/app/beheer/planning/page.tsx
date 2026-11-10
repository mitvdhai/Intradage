import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, CalendarCheck, ChevronLeft, ChevronRight, Send } from "lucide-react";
import { DienstKaart, NieuweDienst, SuggestieKnop, type Optie } from "@/components/planning";
import { cx } from "@/components/ui";
import { scopeVestigingen, mag } from "@/lib/access";
import { publiceerWeek } from "@/lib/personeel/acties";
import { diensten, dienstUren, maandagVan, normen, planGegevens, posities, vestigingen } from "@/lib/personeel/data";
import { deadlineVan } from "@/lib/personeel/sjablonen";
import { controleerDienst, leeftijdOp } from "@/lib/planning/atw";
import { beschikbaarVoor, teJongVoor } from "@/lib/planning/suggestie";
import { vereisGebruiker } from "@/lib/session";
import { nuMs } from "@/lib/tijd";
import { Blok, Kop } from "../beheer-ui";

const hhmm = (d: Date) => d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
const kort = (n: string) => n.split(" ")[0];

export default async function Planning({ searchParams }: PageProps<"/beheer/planning">) {
  const sp = await searchParams;
  const { u, org } = await vereisGebruiker();
  if (!mag(org, u, "planning", 1)) redirect("/beheer");
  const kan = mag(org, u, "planning");
  const scope = scopeVestigingen(org, u);
  const vest = await vestigingen(scope);
  const v = vest.find((x) => x.id === sp.v) ?? vest[0];
  if (!v) return <Kop titel="Planning" sub="Geen vestigingen in je scope." />;
  const maandag = typeof sp.week === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? maandagVan(new Date(`${sp.week}T12:00:00`)) : maandagVan();
  const dagen = Array.from({ length: 7 }, (_, i) => deadlineVan(maandag, i));
  const van = new Date(`${maandag}T00:00:00`), tot = new Date(`${deadlineVan(maandag, 7)}T00:00:00`);

  const [pos, norm, week, plan] = await Promise.all([posities(), normen(v.id), diensten({ vestigingIds: [v.id], van, tot }), planGegevens(org, v.id, maandag)]);
  const { kandidaten, elders } = plan;
  const nu = nuMs();

  // Uren per persoon deze week (alle vestigingen)
  const weekElders = elders.filter((d) => d.start >= van && d.start < tot);
  const alleWeek = [...new Map([...week, ...weekElders].map((d) => [d.id, d])).values()];
  const uren = (id: string) => alleWeek.filter((d) => d.gebruikerId === id).reduce((s, d) => s + dienstUren(d), 0);

  /** Wie kan deze dienst doen, en waarom niet? */
  const opties = (d: (typeof week)[number]): Optie[] => kandidaten.map((k) => {
    const datum = d.start.toLocaleDateString("sv-SE");
    const slot = { datum, van: hhmm(d.start), tot: hhmm(d.eind) };
    const andere = [...elders, ...week].filter((x) => x.gebruikerId === k.id && x.id !== d.id).map((x) => ({ start: x.start, eind: x.eind }));
    let reden: string | undefined;
    const p = pos.find((x) => x.id === d.positieId);
    if (!k.positieIds.includes(d.positieId)) reden = "positie";
    else if (teJongVoor(k.geboortedatum, datum, p?.minLeeftijd)) reden = `te jong (vanaf ${p?.minLeeftijd})`;
    else if (k.afwezig.has(datum)) reden = "verlof/ziek";
    else if (!beschikbaarVoor(k, slot)) reden = "niet beschikbaar";
    else {
      const f = controleerDienst({ start: d.start, eind: d.eind }, leeftijdOp(k.geboortedatum, datum), andere);
      if (f.length) reden = f[0].replace(/ \(.*\)$/, "");
      else if (d.gebruikerId !== k.id && uren(k.id) + dienstUren(d) > k.urenMax + 0.01) reden = "boven max. uren";
    }
    return { id: k.id, naam: kort(k.naam), ok: !reden, reden, uren: uren(k.id) };
  }).sort((a, b) => Number(b.ok) - Number(a.ok) || a.uren - b.uren);

  const concept = week.filter((d) => d.status === "concept").length;
  const open = week.filter((d) => !d.gebruikerId).length;
  const normTotaal = dagen.reduce((s, dt) => s + norm.filter((n) => n.weekdag === new Date(`${dt}T12:00:00`).getDay()).reduce((a, n) => a + n.aantal, 0), 0);
  const weekNr = Math.ceil(((van.getTime() - new Date(van.getFullYear(), 0, 1).getTime()) / 86400000 + new Date(van.getFullYear(), 0, 1).getDay() + 1) / 7);
  const link = (w: string, vid = v.id) => `/beheer/planning?v=${vid}&week=${w}`;
  const gebruiktePos = pos.filter((p) => norm.some((n) => n.positieId === p.id) || week.some((d) => d.positieId === p.id));

  return (
    <>
      <Kop titel={`Planning · week ${weekNr}`} sub={`${new Date(`${maandag}T12:00:00`).toLocaleDateString("nl-NL", { day: "numeric", month: "long" })} – ${new Date(`${dagen[6]}T12:00:00`).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}`}
        rechts={<div className="flex items-center gap-2">
          <Link href={link(deadlineVan(maandag, -7))} className="rounded-lg p-2 ring-1 ring-line hover:bg-white"><ChevronLeft size={16} /></Link>
          <Link href={link(maandagVan())} className="rounded-lg px-3 py-1.5 text-sm font-semibold ring-1 ring-line hover:bg-white">Deze week</Link>
          <Link href={link(deadlineVan(maandag, 7))} className="rounded-lg p-2 ring-1 ring-line hover:bg-white"><ChevronRight size={16} /></Link>
        </div>} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {vest.map((x) => <Link key={x.id} href={link(maandag, x.id)} className={cx("rounded-full px-3.5 py-1.5 text-sm font-semibold", x.id === v.id ? "bg-navy-700 text-white" : "bg-white ring-1 ring-line")}>{x.naam} · {x.plaats}</Link>)}
        <div className="ml-auto flex items-center gap-2">
          {kan ? <SuggestieKnop vestigingId={v.id} maandag={maandag} heeftConcept={week.some((d) => d.status === "concept" && d.bron === "suggestie")} /> : <span className="rounded-full bg-slate-100 px-3 py-1 text-[13px] font-semibold text-muted">Alleen bekijken</span>}
          {kan && concept > 0 && <form action={publiceerWeek.bind(null, v.id, maandag)}><button className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white"><Send size={16} /> Publiceren ({concept})</button></form>}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-line bg-white px-4 py-3"><div className="text-2xl font-bold text-navy-800">{week.length - open}/{Math.max(normTotaal, week.length)}</div><div className="text-[12px] text-muted">diensten bezet (norm {normTotaal})</div></div>
        <div className="rounded-xl border border-line bg-white px-4 py-3"><div className={cx("text-2xl font-bold", open ? "text-brand-600" : "text-navy-800")}>{open}</div><div className="text-[12px] text-muted">open diensten{open ? " · zichtbaar voor medewerkers na publiceren" : ""}</div></div>
        <div className="rounded-xl border border-line bg-white px-4 py-3"><div className="text-2xl font-bold text-navy-800">{concept}</div><div className="text-[12px] text-muted">concept (nog niet zichtbaar)</div></div>
        <div className="rounded-xl border border-line bg-white px-4 py-3"><div className="text-2xl font-bold text-navy-800">{week.reduce((s, d) => s + dienstUren(d), 0).toFixed(0)}</div><div className="text-[12px] text-muted">geplande uren (netto)</div></div>
      </div>

      <Blok>
        <div className="overflow-x-auto">
          <table className="w-full table-fixed border-separate border-spacing-1 text-left">
            <thead>
              <tr>
                <th className="w-24" />
                {dagen.map((dt) => {
                  const wd = new Date(`${dt}T12:00:00`).getDay();
                  const o = v.openingstijden[wd];
                  const nodig = norm.filter((n) => n.weekdag === wd).reduce((s, n) => s + n.aantal, 0);
                  const bezet = week.filter((d) => d.start.toLocaleDateString("sv-SE") === dt && d.gebruikerId).length;
                  return (
                    <th key={dt} className="px-1 pb-1 align-bottom">
                      <div className="text-[13px] font-semibold capitalize">{new Date(`${dt}T12:00:00`).toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" })}</div>
                      <div className="text-[11px] font-normal text-muted">{o ? `${o.open}–${o.sluit}` : "gesloten"}{nodig ? ` · ${bezet}/${nodig}` : ""}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {gebruiktePos.map((p) => (
                <tr key={p.id}>
                  <td className="align-top"><span className="inline-flex items-center gap-1.5 text-[13px] font-semibold"><span className="h-2.5 w-2.5 rounded-full" style={{ background: p.kleur }} />{p.naam}</span></td>
                  {dagen.map((dt) => {
                    const lijst = week.filter((d) => d.positieId === p.id && d.start.toLocaleDateString("sv-SE") === dt).sort((a, b) => a.start.getTime() - b.start.getTime());
                    return (
                      <td key={dt} className="space-y-1 rounded-lg bg-slate-50 p-1 align-top">
                        {lijst.map((d) => <DienstKaart key={d.id} id={d.id} tijd={`${hhmm(d.start)}–${hhmm(d.eind)}`} gebruikerId={d.gebruikerId} opties={opties(d)} concept={d.status === "concept"} kleur={p.kleur} verleden={!kan || d.eind.getTime() < nu} />)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-line pt-3 text-[12px] text-muted">
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-5 rounded border border-line bg-white" /> gepubliceerd</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-5 rounded border border-dashed border-slate-400 bg-white" /> concept</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-5 rounded border border-brand-600 bg-brand-50" /> open dienst</span>
          <span>De keuzelijst toont alleen wie inzetbaar, beschikbaar en binnen de Arbeidstijdenwet is.</span>
        </div>
      </Blok>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <Blok titel="Uren deze week">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[11px] uppercase tracking-wider text-muted"><th className="py-1">Medewerker</th><th>Gepland</th><th>Contract</th><th /></tr></thead>
            <tbody className="divide-y divide-line">
              {kandidaten.sort((a, b) => a.naam.localeCompare(b.naam)).map((k) => {
                const h = uren(k.id);
                const leeftijd = leeftijdOp(k.geboortedatum, maandag);
                const signaal = h < k.urenMin ? `${(k.urenMin - h).toFixed(0)} uur onder minimum` : h > k.urenMax ? "boven maximum" : null;
                return (
                  <tr key={k.id}>
                    <td className="py-1.5"><Link href={`/beheer/personeel/${k.id}`} className="font-medium hover:underline">{k.naam}</Link>{leeftijd !== null && leeftijd < 18 && <span className="ml-1.5 rounded bg-amber-50 px-1.5 text-[11px] font-semibold text-amber-700">{leeftijd} jr</span>}</td>
                    <td className="tabular-nums">{h.toFixed(1).replace(".", ",")} u</td>
                    <td className="text-muted">{k.urenMin === k.urenMax ? `${k.urenMax} u` : `${k.urenMin}–${k.urenMax} u`}</td>
                    <td className={cx("text-[12px]", signaal ? "font-semibold text-brand-700" : "text-muted")}>{signaal ?? (k.afwezig.size ? "verlof deze week" : "")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Blok>
        {kan && <Blok titel="Dienst toevoegen">
          <NieuweDienst vestigingId={v.id} dagen={dagen.map((dt) => ({ datum: dt, label: new Date(`${dt}T12:00:00`).toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "short" }) }))}
            posities={pos.map((p) => ({ id: p.id, naam: p.naam }))} mensen={kandidaten.map((k) => ({ id: k.id, naam: k.naam }))} />
          <div className="mt-4 space-y-2 text-[13px] text-muted">
            <p className="flex gap-2"><CalendarCheck size={16} className="mt-0.5 shrink-0 text-navy-600" /> <span><b className="text-ink">Rooster voorstellen</b> vult de standaardbezetting van <Link href={`/beheer/vestigingen?v=${v.id}`} className="underline">{v.naam}</Link> met wie beschikbaar is. Eerst wie nog onder zijn minimum contracturen zit; de moeilijkst te vullen diensten gaan voor.</span></p>
            <p className="flex gap-2"><AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" /> <span>Jongeren onder de 18 worden niet na 23:00 en niet langer dan 9 uur ingepland (onder de 16: niet na 19:00). Tussen twee diensten zit minstens 11 uur rust (jongeren 12). Per positie geldt een minimumleeftijd: {pos.filter((p) => p.minLeeftijd).map((p) => `${p.naam.toLowerCase()} vanaf ${p.minLeeftijd}`).join(", ")}. Daar kan niemand omheen.</span></p>
            {!norm.length && <p className="font-semibold text-brand-700">Deze vestiging heeft nog geen standaardbezetting. Stel die eerst in.</p>}
          </div>
        </Blok>}
      </div>
    </>
  );
}
