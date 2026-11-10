import Link from "next/link";
import { euro } from "@/components/ui";
import { isHQ, scopeVestigingen } from "@/lib/access";
import { naamVan, vestigingNaam, voornaamVan } from "@/lib/data";
import { berekenUitslag } from "@/lib/functiehuis/score";
import { vereisGebruiker } from "@/lib/session";
import { db, profielItemMap } from "@/lib/store";
import type { Uitkomst } from "@/lib/types";
import { Blok, Kop, Tabel } from "../beheer-ui";

const UITKOMSTEN: Uitkomst[] = ["onvoldoende", "matig", "goed", "zeer goed", "uitstekend"];

export default async function Beoordelingen() {
  const u = await vereisGebruiker();
  const scope = new Set(scopeVestigingen(u));
  const items = profielItemMap();
  const rijen = db.beoordelingen
    .map((b) => {
      const m = db.gebruikers.find((g) => g.id === b.gebruikerId)!;
      const f = db.functies.find((x) => x.id === b.functieId)!;
      return { b, m, f, uitslag: berekenUitslag(f, items, b.beoordelaar, db.regeling) };
    })
    .filter(({ m }) => m.vestigingIds.some((v) => scope.has(v)));
  const verdeling = UITKOMSTEN.map((x) => ({ x, n: rijen.filter((r) => r.uitslag.uitkomst === x).length }));
  const max = Math.max(1, ...verdeling.map((v) => v.n));
  // HQ ziet geen individuele salarissen, alleen of er een besluit is (dataminimalisatie)
  const toonSalaris = !isHQ(u) || u.discipline === "hr";

  return (
    <>
      <Kop titel="Beoordelingen 2026" sub="Op basis van het functiehuis. Advies volgens de beloningsregeling; de franchisenemer beslist." />
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Blok titel="Status per medewerker">
          <Tabel kop={["Medewerker", "Functie", "Beoordelaar", "Status", "Score", "Uitkomst", toonSalaris ? "Besluit" : ""]}>
            {rijen.map(({ b, m, f, uitslag }) => (
              <tr key={b.id}>
                <td className="px-3 py-2.5"><div className="font-medium">{naamVan(m.id)}</div><div className="text-[12px] text-muted">{vestigingNaam(m.vestigingIds[0])}</div></td>
                <td className="px-3 py-2.5">{f.naam}</td>
                <td className="px-3 py-2.5">{voornaamVan(b.beoordelaarId)}</td>
                <td className="px-3 py-2.5 capitalize">{b.status}</td>
                <td className="px-3 py-2.5 font-semibold">{uitslag.totaal?.toFixed(2).replace(".", ",") ?? "–"}</td>
                <td className="px-3 py-2.5 capitalize">{uitslag.uitkomst ?? "–"}</td>
                <td className="px-3 py-2.5">{toonSalaris && b.besluit ? `+${b.besluit.percentage}% → ${euro(b.besluit.nieuwUurloon)}` : ""}</td>
              </tr>
            ))}
          </Tabel>
        </Blok>
        <div className="space-y-6">
          <Blok titel="Verdeling uitkomsten">
            <div className="space-y-2">
              {verdeling.map(({ x, n }) => (
                <div key={x} className="flex items-center gap-3 text-sm">
                  <span className="w-24 capitalize text-muted">{x}</span>
                  <div className="h-5 flex-1 rounded bg-slate-100"><div className="h-full rounded bg-navy-600" style={{ width: `${(n / max) * 100}%` }} /></div>
                  <span className="w-6 text-right font-semibold">{n}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[12px] text-muted">Gebruik dit voor kalibratie: beoordeelt één franchisenemer structureel hoger of lager dan de rest, bespreek dat vóór de besluiten.</p>
          </Blok>
          <Blok titel="Spelregels">
            <ul className="list-disc space-y-1.5 pl-5 text-[13px]">
              <li>Weging en vereiste niveaus komen uit het <Link href="/beheer/functiehuis" className="text-navy-600 underline">functiehuis</Link>.</li>
              <li>De score is een advies. Het besluit wordt altijd door een mens genomen en toegelicht bij afwijking (AVG art. 22).</li>
              <li>Een eigen systematiek voor prestatieverhoging vraagt instemming van de medezeggenschap (Horeca-cao art. 4.11).</li>
              <li>Nooit onder het basisloon of boven het eindloon van de functiegroep.</li>
              <li>Medewerkers kunnen de criteria van hun eigen functie altijd inzien (loontransparantie).</li>
            </ul>
          </Blok>
        </div>
      </div>
    </>
  );
}
