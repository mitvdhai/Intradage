import { inDoelgroep, isHQ, scopeVestigingen } from "@/lib/access";
import { onboarding, status } from "@/lib/data";
import { vereisGebruiker } from "@/lib/session";
import { db } from "@/lib/store";
import type { Gebruiker } from "@/lib/types";
import { Blok, Kop, Kpi, Pct, Tabel } from "./beheer-ui";
import { nuMs } from "@/lib/tijd";

function bereikVerplicht(mensen: Gebruiker[]) {
  let doel = 0, bevestigd = 0;
  for (const b of db.berichten.filter((x) => x.urgentie === "verplicht")) {
    for (const m of mensen.filter((p) => inDoelgroep(p, b.doelgroep))) {
      doel++;
      if (status(b, m).bevestigd) bevestigd++;
    }
  }
  return doel ? Math.round((bevestigd / doel) * 100) : null;
}
function onboardingPct(mensen: Gebruiker[]) {
  const m = mensen.filter((p) => p.functieId);
  return m.length ? Math.round(m.reduce((s, p) => s + onboarding(p).pct, 0) / m.length) : null;
}

export default async function Overzicht() {
  const u = await vereisGebruiker();
  const scope = new Set(scopeVestigingen(u));
  const mensen = db.gebruikers.filter((g) => g.rol !== "hq" && g.rol !== "franchisenemer" && g.vestigingIds.some((v) => scope.has(v)));
  const beo = db.beoordelingen.filter((b) => mensen.some((m) => m.id === b.gebruikerId));
  const fns = db.franchisenemers.filter((f) => isHQ(u) || f.id === u.franchisenemerId);
  const handboekOud = db.handboek.filter((d) => Date.parse(d.reviewVoor) < nuMs());

  return (
    <>
      <Kop titel={isHQ(u) ? "Overzicht · alle franchisenemers" : "Overzicht · mijn vestigingen"} sub="Waar is aandacht nodig?" />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi waarde={`${bereikVerplicht(mensen) ?? "–"}%`} label="verplichte berichten bevestigd" />
        <Kpi waarde={`${onboardingPct(mensen) ?? "–"}%`} label="onboarding afgerond (gemiddeld)" />
        <Kpi waarde={`${beo.filter((b) => b.status === "besloten").length}/${beo.length}`} label="beoordelingen 2026 afgerond" />
        <Kpi waarde={String(handboekOud.length)} label="handboekdocumenten over reviewdatum" toon={handboekOud.length ? "rood" : "navy"} />
      </div>

      <Blok titel="Per franchisenemer">
        <Tabel kop={["Franchisenemer", "Vestigingen", "Medewerkers", "Bevestigd", "Onboarding", "Beoordelingen", "Signaal"]}>
          {fns.map((f) => {
            const vest = db.vestigingen.filter((v) => v.franchisenemerId === f.id);
            const m = mensen.filter((p) => p.franchisenemerId === f.id);
            const b = beo.filter((x) => m.some((p) => p.id === x.gebruikerId));
            const ber = bereikVerplicht(m);
            const ob = onboardingPct(m);
            const signaal = ber !== null && ber < 70 ? "Bereik laag" : ob !== null && ob < 60 ? "Onboarding achter" : b.some((x) => x.status === "beoordelen") ? "Beoordelingen open" : "–";
            return (
              <tr key={f.id}>
                <td className="px-3 py-2.5 font-medium">{f.naam}</td>
                <td className="px-3 py-2.5">{vest.map((v) => v.naam).join(", ")}</td>
                <td className="px-3 py-2.5">{m.length}</td>
                <td className="px-3 py-2.5"><Pct v={ber} /></td>
                <td className="px-3 py-2.5"><Pct v={ob} /></td>
                <td className="px-3 py-2.5">{b.filter((x) => x.status === "besloten").length}/{b.length}</td>
                <td className="px-3 py-2.5">{signaal === "–" ? <span className="text-muted">–</span> : <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[12px] font-semibold text-brand-700">{signaal}</span>}</td>
              </tr>
            );
          })}
        </Tabel>
      </Blok>
    </>
  );
}
