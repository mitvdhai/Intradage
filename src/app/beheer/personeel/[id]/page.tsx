import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Circle, Download, FileSignature, FileText, Link2, Trash2 } from "lucide-react";
import { ActieForm } from "@/components/actie-form";
import { cx } from "@/components/ui";
import { mag, ROL_LABEL, scopeVestigingen } from "@/lib/access";
import { maakContract, meldUitDienst, slaDossierOp, uploadDocument, verwijderDocument, vinkTaakAf } from "@/lib/personeel/acties";
import {
  beschikbaarheidVan, contractenVan, dossierVan, geldendContract, klokVan, lifecycleVan, magDossier, medewerker, nettoUren, positiesVan, posities, vandaagIso, verlofSaldo, verlofVan,
} from "@/lib/personeel/data";
import { deadlineVan, ketenSignaal } from "@/lib/personeel/sjablonen";
import { leeftijdOp, regelsVoor } from "@/lib/planning/atw";
import { vereisGebruiker } from "@/lib/session";
import { nuMs } from "@/lib/tijd";
import { Blok, Kop } from "../../beheer-ui";

const DAGEN = [1, 2, 3, 4, 5, 6, 0];
const DAG = ["zo", "ma", "di", "wo", "do", "vr", "za"];
const TYPE = { oproep: "0-urencontract", minmax: "Min-maxcontract", vast: "Vast aantal uren" } as const;
const STATUS = { concept: "Concept", "ter-ondertekening": "Te tekenen", getekend: "Getekend", beeindigd: "Beëindigd" } as const;
const datum = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
const veld = "w-full rounded-lg border border-line px-2.5 py-1.5 text-sm";
const label = "mb-1 block text-[12px] font-semibold text-muted";

export default async function Dossier({ params, searchParams }: PageProps<"/beheer/personeel/[id]">) {
  const { id } = await params;
  const { nieuw } = await searchParams;
  const { u, org } = await vereisGebruiker();
  const m = await medewerker(id);
  if (!m || !magDossier(org, u, m)) notFound();
  const [pos, mijnPos, besch, contracten, docs, taken, verlof, saldo, klok] = await Promise.all([
    posities(), positiesVan([id]), beschikbaarheidVan([id]), contractenVan([id]), dossierVan(id), lifecycleVan(id), verlofVan({ gebruikerIds: [id] }), verlofSaldo(id),
    klokVan({ gebruikerIds: [id], van: new Date(nuMs() - 28 * 86400000) }),
  ]);
  const vandaag = vandaagIso();
  const lft = leeftijdOp(m.geboortedatum, vandaag);
  const huidig = geldendContract(contracten, id);
  const keten = ketenSignaal(contracten);
  const scope = scopeVestigingen(org, u);
  const kan = mag(org, u, "medewerkers");
  const kanContract = mag(org, u, "contracten");
  const pg = m.persoonsgegevens;
  const functie = org.functies.find((f) => f.id === m.functieId);
  const startLink = m.status === "preboarding" && m.uitnodigingToken ? `/start/${m.uitnodigingToken}` : null;
  const urenTotaal = klok.reduce((s, k) => s + nettoUren(k), 0);
  const oudste = klok.length ? Math.min(...klok.map((k) => k.in.getTime())) : nuMs();
  const weken = Math.max(1, Math.min(4, Math.ceil((nuMs() - oudste) / (7 * 86400000))));

  return (
    <>
      <Kop titel={`${m.voornaam} ${m.achternaam}`}
        sub={`${ROL_LABEL[m.rol]}${functie ? ` · ${functie.naam}` : ""} · ${m.vestigingIds.map((v) => org.vestigingen.find((x) => x.id === v)?.naam).join(", ")} · personeelsnr. ${m.personeelsnummer}`}
        rechts={<Link href="/beheer/personeel" className="text-sm font-semibold text-navy-600">← Alle medewerkers</Link>} />

      {nieuw && startLink && (
        <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <b>Aangenomen!</b> {m.voornaam} krijgt een persoonlijke startlink per sms en e-mail. Daarmee vult {m.voornaam} gegevens in, uploadt een ID, geeft beschikbaarheid door en tekent het contract.
          <div className="mt-2 flex items-center gap-2"><Link2 size={15} /><Link href={startLink} className="font-semibold underline">{startLink}</Link> <span className="text-emerald-700">(in de demo: open de link om de preboarding te bekijken)</span></div>
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          ["Status", m.status === "preboarding" ? `Start ${datum(m.inDienstSinds)}` : m.uitDienstPer ? `Uit dienst per ${datum(m.uitDienstPer)}` : `In dienst sinds ${datum(m.inDienstSinds)}`],
          ["Leeftijd", lft !== null ? `${lft} jaar · ATW ${regelsVoor(lft).label}` : "Onbekend"],
          ["Contract", huidig ? `${TYPE[huidig.type]} · ${huidig.urenMin === huidig.urenMax ? huidig.urenMax : `${huidig.urenMin}–${huidig.urenMax}`} u/wk` : "Geen"],
          ["Uurloon", huidig ? `€ ${huidig.uurloon.toFixed(2).replace(".", ",")}` : "–"],
          ["Vakantie-uren", `${saldo.saldo} u over (${saldo.opgebouwd} opgebouwd)`],
        ].map(([k, w]) => <div key={k} className="rounded-xl border border-line bg-white px-3.5 py-2.5"><div className="text-[11px] font-semibold uppercase tracking-wider text-muted">{k}</div><div className="text-sm font-semibold">{w}</div></div>)}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          {taken.length > 0 && (
            <Blok titel="Levenscyclus">
              <div className="grid gap-4 md:grid-cols-3">
                {(["preboarding", "onboarding", "offboarding"] as const).filter((f) => taken.some((x) => x.fase === f)).map((f) => {
                  const lijst = taken.filter((x) => x.fase === f);
                  return (
                    <div key={f}>
                      <div className="mb-1.5 flex items-center justify-between"><span className="text-[12px] font-semibold uppercase tracking-wider text-navy-700">{f}</span><span className="text-[12px] text-muted">{lijst.filter((x) => x.klaar).length}/{lijst.length}</span></div>
                      <div className="space-y-1">
                        {lijst.map((tk) => (
                          <form key={tk.id} action={vinkTaakAf.bind(null, tk.id)}>
                            <button className="flex w-full items-start gap-2 rounded-lg px-1.5 py-1 text-left text-[13px] hover:bg-slate-50">
                              {tk.klaar ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" /> : <Circle size={16} className={cx("mt-0.5 shrink-0", tk.deadline && tk.deadline < vandaag ? "text-brand-600" : "text-slate-300")} />}
                              <span className={cx(tk.klaar && "text-muted line-through")}>{tk.titel}<span className="block text-[11px] text-muted">{tk.wie === "medewerker" ? m.voornaam : "Leiding"}{tk.deadline ? ` · ${datum(tk.deadline)}` : ""}</span></span>
                            </button>
                          </form>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              {startLink && <p className="mt-3 text-[12px] text-muted">Startlink voor {m.voornaam}: <Link href={startLink} className="font-semibold text-navy-600 underline">{startLink}</Link></p>}
            </Blok>
          )}

          <Blok titel="Inzet: vestigingen, posities en beschikbaarheid">
            <ActieForm actie={slaDossierOp.bind(null, id)} knop={kan ? "Opslaan" : "Alleen bekijken"}>
              <div className="grid gap-4 md:grid-cols-3">
                <div><span className={label}>Rol</span><select name="rol" defaultValue={m.rol} className={veld}>{(["medewerker", "shiftleider", "manager"] as const).map((r) => <option key={r} value={r}>{ROL_LABEL[r]}</option>)}</select></div>
                <div><span className={label}>Functie</span><select name="functie" defaultValue={m.functieId ?? ""} className={veld}>{org.functies.filter((f) => f.familie === "vestiging").map((f) => <option key={f.id} value={f.id}>{f.naam}</option>)}</select></div>
                <div><span className={label}>Geboortedatum</span><input name="geboortedatum" type="date" defaultValue={m.geboortedatum ?? ""} className={veld} /></div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div><span className={label}>Werkt in (meerdere mogelijk)</span>
                  <div className="space-y-1">{org.vestigingen.filter((v) => scope.includes(v.id)).map((v) => <label key={v.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="vestiging" value={v.id} defaultChecked={m.vestigingIds.includes(v.id)} /> {v.naam} · {v.plaats}</label>)}</div></div>
                <div><span className={label}>Inzetbaar op</span>
                  <div className="space-y-1">{pos.map((p) => <label key={p.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="positie" value={p.id} defaultChecked={mijnPos.some((x) => x.positieId === p.id)} disabled={p.minLeeftijd > 0 && (lft === null || lft < p.minLeeftijd)} /> <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.kleur }} />{p.naam}{p.minLeeftijd ? <span className="text-[11px] text-muted">vanaf {p.minLeeftijd}</span> : null}</label>)}</div></div>
              </div>
              <div><span className={label}>Vaste beschikbaarheid</span>
                <div className="grid grid-cols-1 gap-1 md:grid-cols-2">
                  {DAGEN.map((d) => { const b = besch.find((x) => x.weekdag === d); return (
                    <div key={d} className="flex items-center gap-2 text-sm">
                      <label className="flex w-12 items-center gap-1.5"><input type="checkbox" name={`dag-${d}`} defaultChecked={!!b} /> {DAG[d]}</label>
                      <input name={`van-${d}`} type="time" defaultValue={b?.van ?? "11:00"} className="rounded-md border border-line px-1.5 py-0.5 text-[13px]" /> –
                      <input name={`tot-${d}`} type="time" defaultValue={b?.tot ?? "22:00"} className="rounded-md border border-line px-1.5 py-0.5 text-[13px]" />
                    </div>); })}
                </div>
                <p className="mt-1 text-[12px] text-muted">De medewerker past dit zelf aan in de app; hier kun je het namens hem of haar doen.</p>
              </div>
            </ActieForm>
          </Blok>

          <Blok titel="Contracten" rechts={keten ? <span className="text-[12px] font-semibold text-amber-700">{keten}</span> : undefined}>
            <div className="mb-4 divide-y divide-line">
              {contracten.map((c) => (
                <Link key={c.id} href={`/beheer/personeel/${id}/contract/${c.id}`} className="flex items-center gap-3 py-2 hover:bg-slate-50">
                  <FileSignature size={18} className={c.status === "ter-ondertekening" ? "text-brand-600" : "text-navy-600"} />
                  <div className="flex-1 text-sm"><div className="font-medium">Contract {c.volgnummer} · {TYPE[c.type]} · {c.urenMin === c.urenMax ? c.urenMax : `${c.urenMin}–${c.urenMax}`} u · € {c.uurloon.toFixed(2).replace(".", ",")}</div>
                    <div className="text-[12px] text-muted">{datum(c.start)} – {c.eind ? datum(c.eind) : "onbepaalde tijd"}</div></div>
                  <span className={cx("rounded-full px-2 py-0.5 text-[11px] font-semibold", c.status === "getekend" ? "bg-emerald-50 text-emerald-700" : c.status === "ter-ondertekening" ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-muted")}>{STATUS[c.status]}</span>
                </Link>
              ))}
            </div>
            {kanContract && <details className="rounded-xl bg-slate-50 p-3" open={!contracten.length}>
              <summary className="cursor-pointer text-sm font-semibold text-navy-700">{huidig?.eind ? "Contract verlengen of nieuw contract opstellen" : "Nieuw contract opstellen"}</summary>
              <ActieForm actie={maakContract.bind(null, id)} knop="Contract opstellen en ter ondertekening sturen" variant="rood" className="mt-3">
                <div className="grid gap-3 md:grid-cols-3">
                  <div><span className={label}>Soort</span><select name="type" defaultValue={huidig?.type ?? "minmax"} className={veld}><option value="oproep">0-urencontract</option><option value="minmax">Min-maxcontract</option><option value="vast">Vast aantal uren</option></select></div>
                  <div><span className={label}>Min. uren/week</span><input name="urenMin" type="number" step="0.5" defaultValue={huidig?.urenMin ?? 8} className={veld} /></div>
                  <div><span className={label}>Max. uren/week</span><input name="urenMax" type="number" step="0.5" defaultValue={huidig?.urenMax ?? 16} className={veld} /></div>
                  <div><span className={label}>Bruto uurloon (€)</span><input name="uurloon" type="number" step="0.01" defaultValue={huidig?.uurloon ?? 14.99} className={veld} /></div>
                  <div><span className={label}>Startdatum</span><input name="start" type="date" defaultValue={huidig?.eind ? deadlineVan(huidig.eind, 1) : vandaag} className={veld} /></div>
                  <div><span className={label}>Einddatum (leeg = onbepaald)</span><input name="eind" type="date" defaultValue={huidig?.eind ? deadlineVan(huidig.eind, 366) : ""} className={veld} /></div>
                </div>
                <p className="text-[12px] text-muted">De tekst komt uit het contractsjabloon van HQ HR (cao Horeca). {m.voornaam} tekent in de app, jij daarna als werkgever.</p>
              </ActieForm>
            </details>}
          </Blok>

          {kan && !m.uitDienstPer && m.status !== "preboarding" && (
            <Blok titel="Uit dienst melden">
              <ActieForm actie={meldUitDienst.bind(null, id)} knop="Offboarding starten" variant="licht">
                <div className="grid gap-3 md:grid-cols-[180px_1fr]">
                  <div><span className={label}>Laatste werkdag</span><input name="laatsteDag" type="date" defaultValue={huidig?.eind ?? deadlineVan(vandaag, 30)} className={veld} /></div>
                  <div><span className={label}>Reden (intern)</span><input name="reden" placeholder="Bijv. studie, verhuizing, contract niet verlengd" className={veld} /></div>
                </div>
                <p className="text-[12px] text-muted">Diensten na de laatste werkdag komen open te staan. Het account en de chats sluiten automatisch na de laatste werkdag. Het dossier blijft bewaard volgens de bewaartermijnen.</p>
              </ActieForm>
            </Blok>
          )}
        </div>

        <div className="space-y-6">
          <Blok titel="Documenten">
            <div className="mb-3 divide-y divide-line">
              {docs.length === 0 && <p className="py-2 text-sm text-muted">Nog geen documenten.</p>}
              {docs.map((d) => (
                <div key={d.id} className="flex items-center gap-2.5 py-2">
                  <FileText size={17} className="shrink-0 text-navy-600" />
                  <div className="min-w-0 flex-1 text-sm"><div className="truncate font-medium">{d.titel}</div>
                    <div className={cx("text-[12px]", d.vervalt && d.vervalt < deadlineVan(vandaag, 30) ? "font-semibold text-brand-700" : "text-muted")}>{d.categorie}{d.vervalt ? ` · geldig tot ${datum(d.vervalt)}` : ""} · {d.tijd.toLocaleDateString("nl-NL")}</div></div>
                  {d.heeftBestand && <a href={`/dossier/${d.id}`} className="text-navy-600" title="Downloaden"><Download size={16} /></a>}
                  <form action={verwijderDocument.bind(null, d.id)}><button className="text-slate-300 hover:text-brand-600" title="Verwijderen"><Trash2 size={15} /></button></form>
                </div>
              ))}
            </div>
            <details className="rounded-xl bg-slate-50 p-3">
              <summary className="cursor-pointer text-sm font-semibold text-navy-700">Document toevoegen</summary>
              <ActieForm actie={uploadDocument.bind(null, id)} knop="Uploaden" className="mt-3" reset>
                <div className="grid gap-2 md:grid-cols-2">
                  <select name="categorie" className={veld}><option value="certificaat">Certificaat (HACCP, BHV…)</option><option value="diploma">Diploma</option><option value="identiteit">Identiteitsbewijs</option><option value="loonheffing">Loonheffingsverklaring</option><option value="verklaring">Verklaring (VOG, ouders…)</option><option value="contract">Contract (extern)</option><option value="overig">Overig</option></select>
                  <input name="titel" placeholder="Titel" className={veld} />
                  <label className="text-[12px] text-muted">Geldig tot (optioneel)<input name="vervalt" type="date" className={veld} /></label>
                  <input name="bestand" type="file" accept="image/*,application/pdf" className="text-sm" />
                </div>
              </ActieForm>
            </details>
          </Blok>

          <Blok titel="Verlof en ziekte">
            <div className="divide-y divide-line text-sm">
              {verlof.length === 0 && <p className="py-1 text-muted">Geen verlof of ziekte geregistreerd.</p>}
              {verlof.slice(-8).reverse().map((v) => (
                <div key={v.id} className="flex justify-between py-1.5">
                  <span><span className="capitalize">{v.type}</span> · {datum(v.van)}{v.tot && v.tot !== v.van ? ` – ${datum(v.tot)}` : !v.tot ? " – nu" : ""}{v.uren ? ` · ${v.uren} u` : ""}</span>
                  <span className={cx("text-[12px] font-semibold", v.status === "goedgekeurd" ? "text-emerald-700" : v.status === "afgewezen" ? "text-muted" : "text-amber-700")}>{v.type === "ziek" ? (v.tot ? "hersteld" : "ziek") : v.status}</span>
                </div>
              ))}
            </div>
            <Link href="/beheer/verlof" className="mt-2 inline-block text-[13px] font-semibold text-navy-600">Naar verlof en ziekte →</Link>
          </Blok>

          <Blok titel="Gewerkte uren (4 weken)">
            <div className="text-2xl font-bold text-navy-800">{urenTotaal.toFixed(1).replace(".", ",")} uur</div>
            <div className="text-[13px] text-muted">{klok.length} geklokte diensten · gemiddeld {(urenTotaal / weken).toFixed(1).replace(".", ",")} uur per week{huidig ? ` (contract ${huidig.urenMin}–${huidig.urenMax})` : ""}</div>
            {huidig && huidig.type !== "vast" && urenTotaal / weken > huidig.urenMin + 4 && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-[12px] text-amber-800">Werkt structureel meer dan het minimum. Bij een 0-uren- of min-maxcontract heeft de medewerker na 12 maanden recht op een aanbod voor het gemiddeld gewerkte aantal uren.</p>}
          </Blok>

          <Blok titel="Persoonsgegevens">
            <dl className="grid grid-cols-[130px_1fr] gap-x-2 gap-y-1 text-sm">
              <dt className="text-muted">E-mail</dt><dd>{m.email ?? "–"}</dd>
              <dt className="text-muted">Mobiel</dt><dd>{m.mobiel}</dd>
              <dt className="text-muted">Adres</dt><dd>{pg.adres ? `${pg.adres}, ${pg.postcode} ${pg.woonplaats}` : "–"}</dd>
              <dt className="text-muted">IBAN</dt><dd>{pg.iban ?? "–"}</dd>
              <dt className="text-muted">BSN</dt><dd>{pg.bsnLaatste4 ? `•••••${pg.bsnLaatste4}` : "–"}</dd>
              <dt className="text-muted">Heffingskorting</dt><dd>{pg.loonheffingskorting === undefined ? "–" : pg.loonheffingskorting ? "Ja" : "Nee"}</dd>
              <dt className="text-muted">Noodcontact</dt><dd>{pg.noodcontactNaam ? `${pg.noodcontactNaam} · ${pg.noodcontactTelefoon}` : "–"}</dd>
            </dl>
            <p className="mt-2 text-[12px] text-muted">IBAN en BSN tonen we gemaskeerd. Het volledige nummer gaat versleuteld naar de loonadministratie en staat niet in Intradage.</p>
          </Blok>
        </div>
      </div>
    </>
  );
}
