import { Fragment } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Trash2 } from "lucide-react";
import { ActieForm } from "@/components/actie-form";
import { cx } from "@/components/ui";
import { isHQ, mag, ROL_LABEL, scopeVestigingen } from "@/lib/access";
import { slaRolRechtenOp, verwijderPersoonRecht, zetPersoonRecht } from "@/lib/acties-rechten";
import { getDb } from "@/lib/db/client";
import * as t from "@/lib/db/schema";
import { ALLEEN_HQ, MODULES, NIVEAU_LABEL, niveauVan, ROLLEN, type Niveau } from "@/lib/rechten";
import { vereisGebruiker } from "@/lib/session";
import { Blok, Kop } from "../beheer-ui";

const KLEUR: Record<Niveau, string> = { 0: "bg-slate-100 text-muted", 1: "bg-navy-50 text-navy-700", 2: "bg-emerald-50 text-emerald-700" };
const veld = "rounded-lg border border-line px-2.5 py-1.5 text-sm";

export default async function Rechten({ searchParams }: PageProps<"/beheer/rechten">) {
  const { p } = await searchParams;
  const { u, org } = await vereisGebruiker();
  if (!mag(org, u, "rechten", 1)) redirect("/beheer");
  const hqBeheer = mag(org, u, "rechten");
  const scope = new Set(scopeVestigingen(org, u));
  const mensen = org.gebruikers.filter((g) => g.id !== u.id && (isHQ(u) || (g.rol !== "hq" && g.vestigingIds.some((v) => scope.has(v)))));
  const db = await getDb();
  const uitz = (await db.select().from(t.persoonRecht)).filter((x) => mensen.some((m) => m.id === x.gebruikerId));
  const naam = (id: string | null) => { const g = org.gebruikers.find((x) => x.id === id); return g ? `${g.voornaam} ${g.achternaam}` : "–"; };
  const gekozen = mensen.find((m) => m.id === p) ?? mensen.find((m) => m.id === "u-yara") ?? mensen[0];
  const groepen = [...new Set(MODULES.map((m) => m.groep))];
  const toekenbaar = MODULES.filter((m) => hqBeheer || (!ALLEEN_HQ.includes(m.id) && niveauVan(org.rechten, u, m.id) > 0));

  return (
    <>
      <Kop titel="Rollen en rechten" sub="Per rol en onderdeel: geen toegang, bekijken of beheren. Plus uitzonderingen per persoon. Over wíe iemand iets mag, volgt de organisatie: HQ alles, franchisenemer eigen vestigingen, manager en shiftleider hun vestiging." />

      <Blok titel="Rolmatrix" rechts={!hqBeheer ? <span className="text-[12px] text-muted">alleen HQ wijzigt de rolmatrix</span> : undefined}>
        <ActieForm actie={slaRolRechtenOp} knop={hqBeheer ? "Rolmatrix opslaan" : "Alleen bekijken"}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase tracking-wider text-muted"><th className="py-1.5">Onderdeel</th>{ROLLEN.map((r) => <th key={r} className="px-1.5">{ROL_LABEL[r]}</th>)}</tr></thead>
              <tbody>
                {groepen.map((g) => (
                  <Fragment key={g}>
                    <tr><td colSpan={6} className="pt-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-navy-600">{g}</td></tr>
                    {MODULES.filter((m) => m.groep === g).map((m) => (
                      <tr key={m.id} className="border-t border-line">
                        <td className="py-1.5 pr-3"><div className="font-medium">{m.naam}</div><div className="text-[11px] text-muted">{m.uitleg}</div></td>
                        {ROLLEN.map((r) => {
                          const n = niveauVan({ rol: org.rechten.rol, persoon: new Map() }, { id: "-", rol: r }, m.id);
                          const vast = r === "hq" && (m.id === "rechten" || m.id === "logboek");
                          return (
                            <td key={r} className="px-1.5">
                              {hqBeheer && !vast ? (
                                <select name={`r-${r}-${m.id}`} defaultValue={n} className={cx("w-full rounded-md border-0 px-1.5 py-1 text-[12px] font-semibold", KLEUR[n])}>
                                  {([0, 1, 2] as Niveau[]).map((x) => <option key={x} value={x}>{NIVEAU_LABEL[x]}</option>)}
                                </select>
                              ) : <span className={cx("inline-block w-full rounded-md px-1.5 py-1 text-[12px] font-semibold", KLEUR[n])}>{NIVEAU_LABEL[n]}{vast ? " (vast)" : ""}</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </ActieForm>
      </Blok>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Blok titel="Uitzonderingen per persoon">
          <div className="mb-4 divide-y divide-line">
            {uitz.length === 0 && <p className="py-2 text-sm text-muted">Nog geen uitzonderingen.</p>}
            {uitz.map((x) => (
              <div key={`${x.gebruikerId}-${x.module}`} className="flex items-center gap-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <Link href={`/beheer/rechten?p=${x.gebruikerId}`} className="font-medium hover:underline">{naam(x.gebruikerId)}</Link>
                  <span className="text-muted"> · {MODULES.find((m) => m.id === x.module)?.naam}</span>
                  <div className="text-[12px] text-muted">{x.reden ? `“${x.reden}” · ` : ""}door {naam(x.door)} · {x.tijd.toLocaleDateString("nl-NL")}</div>
                </div>
                <span className={cx("rounded-md px-2 py-0.5 text-[12px] font-semibold", KLEUR[x.niveau as Niveau])}>{NIVEAU_LABEL[x.niveau as Niveau]}</span>
                <form action={verwijderPersoonRecht.bind(null, x.gebruikerId, x.module)}><button title="Uitzondering weghalen" className="text-slate-300 hover:text-brand-600"><Trash2 size={15} /></button></form>
              </div>
            ))}
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="mb-2 text-sm font-semibold text-navy-700">Uitzondering toevoegen</div>
            <ActieForm actie={zetPersoonRecht} knop="Toekennen" reset>
              <div className="grid gap-2 md:grid-cols-3">
                <select name="persoon" className={veld}>{mensen.map((m) => <option key={m.id} value={m.id}>{m.voornaam} {m.achternaam} · {ROL_LABEL[m.rol]}</option>)}</select>
                <select name="module" className={veld}>{toekenbaar.map((m) => <option key={m.id} value={m.id}>{m.naam}</option>)}</select>
                <select name="niveau" defaultValue={2} className={veld}>{([2, 1, 0] as Niveau[]).map((x) => <option key={x} value={x}>{NIVEAU_LABEL[x]}</option>)}</select>
              </div>
              <input name="reden" placeholder="Waarom? Bijv. 'maakt het weekrooster'" className={cx(veld, "w-full")} />
              <p className="text-[12px] text-muted">{hqBeheer ? "Als HQ kun je alles toekennen of afnemen." : "Je kunt alleen rechten geven aan je eigen mensen, en nooit meer dan je zelf hebt."} Een uitzondering gaat vóór de rol, ook als die lager is.</p>
            </ActieForm>
          </div>
        </Blok>

        <Blok titel="Wie mag wat?">
          <form className="mb-3 flex gap-2" action="/beheer/rechten">
            <select name="p" defaultValue={gekozen?.id} className={cx(veld, "flex-1")}>{mensen.map((m) => <option key={m.id} value={m.id}>{m.voornaam} {m.achternaam}</option>)}</select>
            <button className="rounded-lg px-3 py-1.5 text-sm font-semibold ring-1 ring-line">Toon</button>
          </form>
          {gekozen && (
            <>
              <div className="mb-2 text-sm"><b>{gekozen.voornaam} {gekozen.achternaam}</b> · {ROL_LABEL[gekozen.rol]} · {gekozen.rol === "hq" ? "alle vestigingen" : gekozen.vestigingIds.map((v) => org.vestigingen.find((x) => x.id === v)?.naam).join(", ")}</div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-line">
                  {MODULES.map((m) => {
                    const n = niveauVan(org.rechten, gekozen, m.id);
                    const eigen = org.rechten.persoon.get(gekozen.id)?.[m.id] !== undefined;
                    return (
                      <tr key={m.id}><td className="py-1">{m.naam}</td>
                        <td className="text-right"><span className={cx("rounded-md px-2 py-0.5 text-[12px] font-semibold", KLEUR[n])}>{NIVEAU_LABEL[n]}</span>{eigen && <span className="ml-1.5 text-[11px] font-semibold text-amber-700">uitzondering</span>}</td></tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}
        </Blok>
      </div>
    </>
  );
}
