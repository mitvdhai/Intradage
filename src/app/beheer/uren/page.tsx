import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, Download, FileText } from "lucide-react";
import { ActieForm } from "@/components/actie-form";
import { cx } from "@/components/ui";
import { scopeVestigingen, mag } from "@/lib/access";
import { corrigeerKlok, keurUrenGoed } from "@/lib/personeel/acties";
import { contractenVan, diensten, geldendContract, klokVan, maandagVan, medewerkers, nettoUren } from "@/lib/personeel/data";
import { deadlineVan } from "@/lib/personeel/sjablonen";
import { vereisGebruiker } from "@/lib/session";
import { nuMs } from "@/lib/tijd";
import { Blok, Kop, Kpi } from "../beheer-ui";

const hhmm = (d: Date | null) => d ? d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" }) : "–";
const n1 = (n: number) => n.toFixed(2).replace(".", ",");

export default async function Uren({ searchParams }: PageProps<"/beheer/uren">) {
  const { week } = await searchParams;
  const { u, org } = await vereisGebruiker();
  if (!mag(org, u, "uren", 1)) redirect("/beheer");
  const maandag = typeof week === "string" && /^\d{4}-\d{2}-\d{2}$/.test(week) ? maandagVan(new Date(`${week}T12:00:00`)) : maandagVan(new Date(nuMs() - 7 * 86400000));
  const van = new Date(`${maandag}T00:00:00`), tot = new Date(`${deadlineVan(maandag, 7)}T00:00:00`);
  const scope = scopeVestigingen(org, u);
  const [klok, mensen, gepland] = await Promise.all([klokVan({ vestigingIds: scope, van, tot }), medewerkers(org, u, { metUitDienst: true }), diensten({ vestigingIds: scope, van, tot, status: "gepubliceerd" })]);
  const contracten = await contractenVan(mensen.map((m) => m.id));
  const teKeuren = klok.filter((k) => k.status === "ingediend");
  const perPersoon = mensen.map((m) => ({ m, regels: klok.filter((k) => k.gebruikerId === m.id).sort((a, b) => a.in.getTime() - b.in.getTime()) })).filter((x) => x.regels.length);
  const totaal = klok.reduce((s, k) => s + nettoUren(k), 0);
  const geplandUren = gepland.reduce((s, d) => s + (d.eind.getTime() - d.start.getTime()) / 3600000 - d.pauzeMin / 60, 0);
  const link = (w: string) => `/beheer/uren?week=${w}`;

  return (
    <>
      <Kop titel="Uren" sub={`Week van ${new Date(`${maandag}T12:00:00`).toLocaleDateString("nl-NL", { day: "numeric", month: "long" })} · geklokt, gecontroleerd en klaar voor de loonadministratie`}
        rechts={<div className="flex items-center gap-2">
          <Link href={link(deadlineVan(maandag, -7))} className="rounded-lg p-2 ring-1 ring-line"><ChevronLeft size={16} /></Link>
          <Link href={link(deadlineVan(maandag, 7))} className="rounded-lg p-2 ring-1 ring-line"><ChevronRight size={16} /></Link>
          <Link href={`/beheer/uren/uitdraai?van=${maandag}&tot=${deadlineVan(maandag, 6)}`} className="inline-flex items-center gap-2 rounded-lg bg-navy-700 px-3 py-2 text-sm font-semibold text-white"><FileText size={15} /> Uitdraai week / maand / periode</Link>
          <a href={`/beheer/uren/export?van=${maandag}&tot=${deadlineVan(maandag, 6)}`} className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold ring-1 ring-line"><Download size={15} /> Uren (CSV)</a>
          <a href={`/beheer/uren/export?soort=mutaties&van=${deadlineVan(maandag, -28)}&tot=${deadlineVan(maandag, 6)}`} className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold ring-1 ring-line"><Download size={15} /> Mutaties (CSV)</a>
        </div>} />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi waarde={n1(totaal)} label="gewerkte uren (netto)" />
        <Kpi waarde={n1(geplandUren)} label="geplande uren" />
        <Kpi waarde={String(teKeuren.length)} label="regels te bevestigen" toon={teKeuren.length ? "rood" : "navy"} />
        <Kpi waarde={String(klok.filter((k) => k.dienstId && Math.abs(afwijking(k, gepland)) > 15).length)} label="afwijkingen > 15 min t.o.v. rooster" />
      </div>
      <Blok titel="Per medewerker" rechts={teKeuren.length && mag(org, u, "uren") ? <form action={keurUrenGoed.bind(null, teKeuren.map((k) => k.id))}><button className="rounded-lg bg-navy-700 px-3.5 py-1.5 text-sm font-semibold text-white">Alles goedkeuren ({teKeuren.length})</button></form> : <span className="text-sm text-emerald-700">Alles goedgekeurd</span>}>
        <div className="space-y-5">
          {perPersoon.map(({ m, regels }) => {
            const c = geldendContract(contracten, m.id, maandag);
            const som = regels.reduce((s, k) => s + nettoUren(k), 0);
            return (
              <div key={m.id}>
                <div className="mb-1 flex items-baseline justify-between">
                  <Link href={`/beheer/personeel/${m.id}`} className="font-semibold hover:underline">{m.voornaam} {m.achternaam} <span className="text-[12px] font-normal text-muted">#{m.personeelsnummer}</span></Link>
                  <span className={cx("text-sm", c && som < c.urenMin ? "text-amber-700" : "text-muted")}>{n1(som)} u{c ? ` · contract ${c.urenMin}–${c.urenMax}` : ""}</span>
                </div>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-line">
                    {regels.map((k) => {
                      const d = gepland.find((x) => x.id === k.dienstId);
                      const af = afwijking(k, gepland);
                      return (
                        <tr key={k.id}>
                          <td className="w-32 py-1 capitalize">{k.in.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" })}</td>
                          <td className="w-28 text-muted">{org.vestigingen.find((v) => v.id === k.vestigingId)?.naam}</td>
                          <td className="w-28 text-muted">{d ? `${hhmm(d.start)}–${hhmm(d.eind)}` : "niet gepland"}</td>
                          <td className="w-28 tabular-nums">{hhmm(k.in)}–{hhmm(k.uit)}</td>
                          <td className="w-20 text-muted">{k.pauzeMin ? `${k.pauzeMin} min` : "geen"}</td>
                          <td className="w-16 tabular-nums font-semibold">{n1(nettoUren(k))}</td>
                          <td className={cx("w-28 text-[12px]", Math.abs(af) > 15 ? "font-semibold text-amber-700" : "text-muted")}>{d ? (Math.abs(af) > 1 ? `${af > 0 ? "+" : ""}${Math.round(af)} min` : "volgens rooster") : ""}</td>
                          <td className="w-28"><span className={cx("rounded-full px-2 py-0.5 text-[11px] font-semibold", k.status === "goedgekeurd" ? "bg-emerald-50 text-emerald-700" : k.status === "ingediend" ? "bg-amber-50 text-amber-700" : "bg-navy-50 text-navy-700")}>{k.status === "open" ? "ingeklokt" : k.status}</span></td>
                          <td>
                            {k.uit && mag(org, u, "uren") && <details className="relative"><summary className="cursor-pointer text-[12px] font-semibold text-navy-600">Corrigeer</summary>
                              <div className="absolute right-0 z-10 mt-1 w-72 rounded-xl border border-line bg-white p-3 shadow-lg">
                                <ActieForm actie={corrigeerKlok.bind(null, k.id)} knop="Opslaan en goedkeuren">
                                  <div className="flex gap-2"><input name="in" type="time" defaultValue={hhmm(k.in)} className="rounded border border-line px-1.5 py-1 text-sm" /><input name="uit" type="time" defaultValue={hhmm(k.uit)} className="rounded border border-line px-1.5 py-1 text-sm" /><input name="pauze" type="number" defaultValue={k.pauzeMin} className="w-16 rounded border border-line px-1.5 py-1 text-sm" /></div>
                                  <input name="opmerking" placeholder="Reden van correctie" className="w-full rounded border border-line px-2 py-1 text-sm" />
                                </ActieForm>
                              </div></details>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
          {!perPersoon.length && <p className="text-sm text-muted">Geen geklokte uren in deze week.</p>}
        </div>
      </Blok>
      <p className="mt-4 text-[12px] text-muted">De export bevat per regel personeelsnummer, datum, begin, eind, pauze en netto uren, en sluit aan op de import van gangbare salarispakketten (Nmbrs, Loket, AFAS). Alleen goedgekeurde uren worden geëxporteerd. Een directe koppeling met het salarispakket is de volgende stap.</p>
    </>
  );
}

function afwijking(k: { dienstId: string | null; in: Date; uit: Date | null; pauzeMin: number }, gepland: { id: string; start: Date; eind: Date; pauzeMin: number }[]) {
  const d = gepland.find((x) => x.id === k.dienstId);
  if (!d || !k.uit) return 0;
  return ((k.uit.getTime() - k.in.getTime()) - (d.eind.getTime() - d.start.getTime())) / 60000;
}
