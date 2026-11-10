"use client";

import { useActionState, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { legBesluitVast, slaBeoordelingOp } from "@/lib/acties";
import { CATEGORIEEN, CATEGORIE_LABEL, berekenUitslag, salarisAdvies } from "@/lib/functiehuis/score";
import type { Beloningsregeling, Beoordeling, Functie, ProfielItem, Salarisgegevens } from "@/lib/types";
import { NiveauKiezer } from "./niveau-kiezer";
import { Knop, cx, euro } from "./ui";

const fmt = (n: number | null) => (n === null ? "–" : n.toFixed(2).replace(".", ","));

export function BeoordelingFormulier({
  beoordeling, functie, items, regeling, salaris, magBewerken, magBesluiten,
}: {
  beoordeling: Beoordeling; functie: Functie; items: ProfielItem[]; regeling: Beloningsregeling; salaris?: Salarisgegevens; magBewerken: boolean; magBesluiten: boolean;
}) {
  const map = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const [niveaus, setNiveaus] = useState<Record<string, number>>(beoordeling.beoordelaar);
  const uitslag = berekenUitslag(functie, map, niveaus, regeling);
  const advies = uitslag.uitkomst && salaris ? salarisAdvies(uitslag.uitkomst, salaris, regeling) : null;
  const [besluit, besluitActie, bezig] = useActionState(legBesluitVast.bind(null, beoordeling.id), null);
  const besloten = beoordeling.status === "besloten";
  const ingevuld = Object.keys(niveaus).filter((k) => functie.profiel.some((r) => r.itemId === k)).length;

  return (
    <div>
      {/* Samenvatting blijft bovenaan staan */}
      <div className="sticky top-0 z-10 border-b border-line bg-white/95 px-4 py-3 backdrop-blur">
        <div className="grid grid-cols-4 gap-2 text-center">
          {uitslag.categorieen.map((c) => (
            <div key={c.categorie} className="rounded-xl bg-slate-50 py-1.5">
              <div className="text-[10px] font-semibold uppercase text-muted">{CATEGORIE_LABEL[c.categorie].split(" ")[0]} {c.weging}%</div>
              <div className="text-lg font-bold text-navy-800">{fmt(c.score)}</div>
            </div>
          ))}
          <div className={cx("rounded-xl py-1.5", uitslag.uitkomst ? "bg-navy-700 text-white" : "bg-slate-100")}>
            <div className="text-[10px] font-semibold uppercase opacity-80">Totaal</div>
            <div className="text-lg font-bold">{fmt(uitslag.totaal)}</div>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between text-[13px]">
          <span className="text-muted">{ingevuld} van {functie.profiel.length} ingevuld</span>
          {uitslag.uitkomst && <span className="font-semibold capitalize text-navy-800">{uitslag.uitkomst}{uitslag.begrensd && " (begrensd)"}</span>}
        </div>
      </div>

      <form action={slaBeoordelingOp.bind(null, beoordeling.id)}>
        {CATEGORIEEN.map((cat) => {
          const regels = functie.profiel.filter((r) => map.get(r.itemId)?.categorie === cat);
          if (!regels.length) return null;
          return (
            <section key={cat} className="px-4 pt-5">
              <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{CATEGORIE_LABEL[cat]}</h2>
              <div className="space-y-3">
                {regels.map((r) => {
                  const it = map.get(r.itemId)!;
                  const gekozen = niveaus[r.itemId];
                  return (
                    <div key={r.itemId} className="rounded-2xl border border-line bg-white p-4">
                      <div className="mb-1 flex items-start justify-between gap-2">
                        <div className="font-semibold">{it.naam}{r.voorwaarde && <span className="ml-1.5 text-[11px] font-semibold text-brand-600">voorwaarde</span>}</div>
                        <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[12px] font-bold text-navy-800">{r.weging}%</span>
                      </div>
                      <div className="mb-3 text-[13px] text-muted">{gekozen ? it.niveaus[gekozen - 1] : `Vereist: ${it.niveaus[r.vereistNiveau - 1]}`}</div>
                      <NiveauKiezer naam={`n-${r.itemId}`} niveaus={[...it.niveaus]} vereist={r.vereistNiveau} waarde={gekozen} zelf={beoordeling.zelf[r.itemId]}
                        uitgeschakeld={!magBewerken || besloten} onChange={(n) => setNiveaus((s) => ({ ...s, [r.itemId]: n }))} />
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

        {magBewerken && !besloten && (
          <div className="space-y-2 px-4 pt-5">
            <textarea name="toelichting" defaultValue={beoordeling.toelichting} rows={3} placeholder="Toelichting voor het gesprek (optioneel)"
              className="w-full rounded-xl border border-line bg-white p-3 text-[15px] outline-none focus:border-navy-500" />
            <div className="grid grid-cols-2 gap-2">
              <Knop variant="licht" name="stap" value="opslaan">Opslaan</Knop>
              <Knop variant="navy" name="stap" value="gesprek" disabled={!uitslag.compleet}>Klaar voor gesprek</Knop>
            </div>
          </div>
        )}
      </form>

      {uitslag.ontbrekendeVoorwaarden.length > 0 && (
        <div className="mx-4 mt-4 flex gap-2 rounded-xl bg-brand-50 p-3 text-[13px] text-brand-700">
          <AlertTriangle size={18} className="shrink-0" />
          <span>Voorwaarde niet behaald ({uitslag.ontbrekendeVoorwaarden.map((i) => map.get(i)?.naam).join(", ")}). De uitkomst is maximaal “{regeling.maxUitkomstBijOntbrekendeVoorwaarde}” tot dit in orde is.</span>
        </div>
      )}

      {advies && salaris && (
        <section className="px-4 pt-5">
          <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Salarisadvies</h2>
          <div className="rounded-2xl border border-line bg-white p-4">
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-bold text-navy-800">+{advies.effectiefPercentage.toString().replace(".", ",")}%</div>
              <div className="text-right text-[13px] text-muted">{euro(advies.huidig)} → <b className="text-ink">{euro(advies.nieuw)}</b> per uur</div>
            </div>
            <div className="mt-1 text-[13px] text-muted">
              Regeling {regeling.versie}: “{uitslag.uitkomst}” = +{advies.percentage}% · schaal {euro(salaris.schaalMin)} – {euro(salaris.schaalMax)}
              {advies.begrensdOpEindloon && " · begrensd op het eindloon"}
            </div>
            <div className="mt-3 flex gap-2 rounded-lg bg-navy-50 p-2.5 text-[12px] text-navy-800">
              <Info size={16} className="shrink-0" /> Dit is een advies. Jij als werkgever neemt het besluit en licht een afwijking toe. Na het besluit stel je in het personeelsdossier het nieuwe contract op; het loon gaat via de export naar de loonadministratie.
            </div>

            {besloten && beoordeling.besluit ? (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-800">
                <CheckCircle2 size={18} /> Besloten: +{beoordeling.besluit.percentage}% → {euro(beoordeling.besluit.nieuwUurloon)}
              </div>
            ) : magBesluiten && beoordeling.status === "gesprek" ? (
              <form action={besluitActie} className="mt-3 space-y-2">
                <label className="block text-[13px] font-semibold">Besluit (% verhoging)
                  <input name="percentage" inputMode="decimal" defaultValue={advies.percentage} className="tap mt-1 w-full rounded-xl border border-line px-3 text-[15px]" />
                </label>
                <textarea name="toelichting" rows={2} placeholder="Toelichting (verplicht bij afwijken van het advies)" className="w-full rounded-xl border border-line p-3 text-[15px]" />
                {besluit?.fout && <p className="text-sm text-brand-700">{besluit.fout}</p>}
                <Knop disabled={bezig}>Besluit vastleggen</Knop>
              </form>
            ) : magBesluiten ? (
              <p className="mt-3 text-[13px] text-muted">Zet de beoordeling op “Klaar voor gesprek” om het besluit vast te leggen.</p>
            ) : null}
          </div>
        </section>
      )}
    </div>
  );
}
