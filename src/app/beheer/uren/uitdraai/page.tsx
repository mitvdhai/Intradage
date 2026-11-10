import { Fragment } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, Download } from "lucide-react";
import { PrintKnop } from "@/components/print-knop";
import { cx } from "@/components/ui";
import { scopeVestigingen } from "@/lib/access";
import { contractenVan, geldendContract, klokVan, magPersoneel, medewerkers, nettoUren, urenInTeVullen } from "@/lib/personeel/data";
import { deadlineVan } from "@/lib/personeel/sjablonen";
import { vereisGebruiker } from "@/lib/session";

const n2 = (n: number) => n.toFixed(2).replace(".", ",");
const hhmm = (d: Date | null) => d ? d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" }) : "–";
const datum = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
const geldig = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const TYPE = { oproep: "0-uren", minmax: "min-max", vast: "vast" } as const;

/** Uitdraai van bevestigde uren per periode, voor de loonadministratie. Afdrukbaar als PDF. */
export default async function Uitdraai({ searchParams }: PageProps<"/beheer/uren/uitdraai">) {
  const sp = await searchParams;
  const { u, org } = await vereisGebruiker();
  if (!magPersoneel(u)) redirect("/beheer");
  const vandaag = new Date().toLocaleDateString("sv-SE");
  const van = geldig(sp.van) ? sp.van : `${vandaag.slice(0, 8)}01`;
  const tot = geldig(sp.tot) && sp.tot >= van ? sp.tot : vandaag;
  const detail = sp.detail === "1";
  const scope = scopeVestigingen(org, u);
  const vestFilter = typeof sp.v === "string" && scope.includes(sp.v) ? [sp.v] : scope;
  const [klok, mensen] = await Promise.all([
    klokVan({ vestigingIds: vestFilter, van: new Date(`${van}T00:00:00`), tot: new Date(`${deadlineVan(tot, 1)}T00:00:00`) }),
    medewerkers(org, u, { metUitDienst: true }),
  ]);
  const contracten = await contractenVan(mensen.map((m) => m.id));
  const bevestigd = klok.filter((k) => k.status === "goedgekeurd");
  const open = klok.filter((k) => k.status !== "goedgekeurd");
  const ontbrekend = (await Promise.all(mensen.map(async (m) => (await urenInTeVullen(m.id)).filter((d) => d.start.toLocaleDateString("sv-SE") >= van && d.start.toLocaleDateString("sv-SE") <= tot && vestFilter.includes(d.vestigingId))))).flat();
  const rijen = mensen.map((m) => {
    const eigen = bevestigd.filter((k) => k.gebruikerId === m.id).sort((a, b) => a.in.getTime() - b.in.getTime());
    return { m, eigen, uren: eigen.reduce((s, k) => s + nettoUren(k), 0), zondag: eigen.filter((k) => k.in.getDay() === 0).reduce((s, k) => s + nettoUren(k), 0), c: geldendContract(contracten, m.id, tot),
      open: open.filter((k) => k.gebruikerId === m.id).length + ontbrekend.filter((d) => d.gebruikerId === m.id).length };
  }).filter((r) => r.eigen.length || r.open).sort((a, b) => a.m.personeelsnummer.localeCompare(b.m.personeelsnummer));
  const fn = u.franchisenemerId ? org.franchisenemers.find((f) => f.id === u.franchisenemerId)?.naam : "Alle franchisenemers";
  const q = (extra: Record<string, string>) => `/beheer/uren/uitdraai?${new URLSearchParams({ van, tot, ...(detail ? { detail: "1" } : {}), ...(vestFilter.length === 1 && scope.length > 1 ? { v: vestFilter[0] } : {}), ...extra })}`;
  const maandBegin = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  const nu = new Date(); const vorige = new Date(nu.getFullYear(), nu.getMonth() - 1, 1);
  const eindVorige = new Date(nu.getFullYear(), nu.getMonth(), 0).toLocaleDateString("sv-SE");

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5 flex flex-wrap items-center gap-2 print:hidden">
        <Link href="/beheer/uren" className="text-sm font-semibold text-navy-600">← Uren</Link>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Link href={q({ van: maandBegin(nu), tot: vandaag })} className="rounded-lg px-3 py-1.5 text-sm font-semibold ring-1 ring-line">Deze maand</Link>
          <Link href={q({ van: maandBegin(vorige), tot: eindVorige })} className="rounded-lg px-3 py-1.5 text-sm font-semibold ring-1 ring-line">Vorige maand</Link>
          <form className="flex items-center gap-1.5 text-sm" action="/beheer/uren/uitdraai">
            <input type="date" name="van" defaultValue={van} className="rounded-lg border border-line px-2 py-1" /> –
            <input type="date" name="tot" defaultValue={tot} className="rounded-lg border border-line px-2 py-1" />
            {detail && <input type="hidden" name="detail" value="1" />}
            <button className="rounded-lg px-3 py-1.5 font-semibold ring-1 ring-line">Toon</button>
          </form>
          <Link href={detail ? q({ detail: "0" }) : q({ detail: "1" })} className="rounded-lg px-3 py-1.5 text-sm font-semibold ring-1 ring-line">{detail ? "Alleen totalen" : "Met alle diensten"}</Link>
          <a href={`/beheer/uren/export?van=${van}&tot=${tot}`} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold ring-1 ring-line"><Download size={14} /> CSV</a>
          <PrintKnop />
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-white p-8 print:border-0 print:p-0">
        <div className="mb-6 flex items-start justify-between border-b border-line pb-4">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">Urenoverzicht voor de loonadministratie</div>
            <h1 className="text-2xl font-bold">{fn}</h1>
            <div className="text-sm text-muted">{vestFilter.map((v) => org.vestigingen.find((x) => x.id === v)?.naam).join(", ")} · {datum(van)} t/m {datum(tot)}</div>
          </div>
          <div className="text-right text-[12px] text-muted">Gemaakt {new Date().toLocaleString("nl-NL", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}<br />door {u.voornaam} {u.achternaam}</div>
        </div>

        {(open.length > 0 || ontbrekend.length > 0) && (
          <div className="mb-5 flex gap-2 rounded-xl bg-amber-50 p-3 text-[13px] text-amber-900"><AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span><b>Nog niet compleet:</b> {open.length > 0 && `${open.length} urenregel${open.length > 1 ? "s" : ""} nog niet bevestigd`}{open.length > 0 && ontbrekend.length > 0 && " en "}{ontbrekend.length > 0 && `${ontbrekend.length} dienst${ontbrekend.length > 1 ? "en" : ""} nog niet ingevuld door de medewerker`}. Die tellen hieronder niet mee.</span></div>
        )}

        <table className="w-full text-sm">
          <thead><tr className="border-b-2 border-ink text-left text-[11px] uppercase tracking-wider"><th className="py-1.5">Pers.nr.</th><th>Naam</th><th>Contract</th><th className="text-right">Diensten</th><th className="text-right">Zondag (u)</th><th className="text-right">Totaal (u)</th><th className="text-right print:hidden">Open</th></tr></thead>
          <tbody>
            {rijen.map(({ m, eigen, uren, zondag, c, open: o }) => (
              <Fragment key={m.id}>
                <tr className={cx("border-b border-line", detail && "bg-slate-50 print:bg-transparent")}>
                  <td className="py-1.5 font-mono text-[12px]">{m.personeelsnummer}</td>
                  <td className="font-medium">{m.voornaam} {m.achternaam}</td>
                  <td className="text-muted">{c ? `${TYPE[c.type]} ${c.urenMin === c.urenMax ? c.urenMax : `${c.urenMin}–${c.urenMax}`} u/wk` : "–"}</td>
                  <td className="text-right tabular-nums">{eigen.length}</td>
                  <td className="text-right tabular-nums">{zondag ? n2(zondag) : ""}</td>
                  <td className="text-right font-semibold tabular-nums">{n2(uren)}</td>
                  <td className={cx("text-right print:hidden", o ? "font-semibold text-amber-700" : "text-muted")}>{o || ""}</td>
                </tr>
                {detail && eigen.map((k) => (
                  <tr key={k.id} className="text-[12px] text-muted">
                    <td /><td className="py-0.5 capitalize" colSpan={2}>{k.in.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" })} · {org.vestigingen.find((v) => v.id === k.vestigingId)?.naam}</td>
                    <td className="text-right tabular-nums" colSpan={2}>{hhmm(k.in)}–{hhmm(k.uit)}{k.pauzeMin ? ` (−${k.pauzeMin}′)` : ""}</td>
                    <td className="text-right tabular-nums">{n2(nettoUren(k))}</td><td className="print:hidden" />
                  </tr>
                ))}
              </Fragment>
            ))}
            <tr className="border-t-2 border-ink font-bold"><td className="py-2" colSpan={3}>Totaal ({rijen.length} medewerkers)</td><td className="text-right">{bevestigd.length}</td><td className="text-right">{n2(rijen.reduce((s, r) => s + r.zondag, 0))}</td><td className="text-right">{n2(rijen.reduce((s, r) => s + r.uren, 0))}</td><td className="print:hidden" /></tr>
          </tbody>
        </table>
        <p className="mt-6 text-[11px] text-muted">Alleen uren die zijn bevestigd door een shiftleider, manager of franchisenemer. Netto uren = eind − begin − pauze. Elke bevestiging en correctie staat in het logboek van Intradage.</p>
        <div className="mt-10 grid grid-cols-2 gap-10 text-[12px] text-muted"><div className="border-t border-ink pt-1">Akkoord werkgever</div><div className="border-t border-ink pt-1">Verwerkt loonadministratie</div></div>
      </div>
    </div>
  );
}
