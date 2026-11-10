import { redirect } from "next/navigation";
import { inDoelgroep, isHQ, mag, scopeVestigingen } from "@/lib/access";
import { alleBerichten, alleHandboekDocs, alleLeerItems, beoordelingen, statussenVan, voortgangVanMeerdere } from "@/lib/data";
import type { Org } from "@/lib/org";
import { vereisGebruiker } from "@/lib/session";
import { nuMs } from "@/lib/tijd";
import type { Bericht, Gebruiker, LeerItem, LeerVoortgang } from "@/lib/types";
import { Blok, Kop, Kpi, Pct, Tabel } from "./beheer-ui";

type Statussen = Awaited<ReturnType<typeof statussenVan>>;

function bereikVerplicht(org: Org, mensen: Gebruiker[], verplicht: Bericht[], st: Statussen) {
  let doel = 0, bevestigd = 0;
  for (const b of verplicht) {
    for (const m of mensen.filter((p) => inDoelgroep(org, p, b.doelgroep))) {
      doel++;
      if (st.some((s) => s.berichtId === b.id && s.gebruikerId === m.id && s.bevestigd)) bevestigd++;
    }
  }
  return doel ? Math.round((bevestigd / doel) * 100) : null;
}

function onboardingPct(mensen: Gebruiker[], items: LeerItem[], vg: LeerVoortgang[]) {
  const m = mensen.filter((p) => p.functieId);
  if (!m.length) return null;
  const pct = m.map((p) => {
    const ob = items.filter((i) => i.onboarding && (!i.functieIds.length || i.functieIds.includes(p.functieId!)));
    const klaar = ob.filter((i) => vg.some((v) => v.gebruikerId === p.id && v.itemId === i.id && v.status === "afgerond")).length;
    return ob.length ? (klaar / ob.length) * 100 : 100;
  });
  return Math.round(pct.reduce((a, b) => a + b, 0) / pct.length);
}

export default async function Overzicht() {
  const { u, org } = await vereisGebruiker();
  if (!mag(org, u, "berichten", 1) && !mag(org, u, "medewerkers", 1)) {
    const eerste = (["planning", "uren", "verlof", "evaluaties", "werving", "vestigingen", "handboek", "leren"] as const).find((m) => mag(org, u, m, 1));
    redirect(eerste ? `/beheer/${eerste}` : "/app");
  }
  const scope = new Set(scopeVestigingen(org, u));
  const mensen = org.gebruikers.filter((g) => g.rol !== "hq" && g.rol !== "franchisenemer" && g.vestigingIds.some((v) => scope.has(v)));
  const ids = mensen.map((m) => m.id);
  const [berichten, items, vg, beo, docs] = await Promise.all([alleBerichten(), alleLeerItems(), voortgangVanMeerdere(ids), beoordelingen({ gebruikerIds: ids }), alleHandboekDocs()]);
  const verplicht = berichten.filter((b) => b.urgentie === "verplicht");
  const st = await statussenVan(verplicht.map((b) => b.id));
  const fns = org.franchisenemers.filter((f) => isHQ(u) || f.id === u.franchisenemerId);
  const handboekOud = docs.filter((d) => Date.parse(d.reviewVoor) < nuMs());
  const bereik = (m: Gebruiker[]) => bereikVerplicht(org, m, verplicht, st);
  const onb = (m: Gebruiker[]) => onboardingPct(m, items, vg);

  return (
    <>
      <Kop titel={isHQ(u) ? "Overzicht · alle franchisenemers" : "Overzicht · mijn vestigingen"} sub="Waar is aandacht nodig?" />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi waarde={`${bereik(mensen) ?? "–"}%`} label="verplichte berichten bevestigd" />
        <Kpi waarde={`${onb(mensen) ?? "–"}%`} label="onboarding afgerond (gemiddeld)" />
        <Kpi waarde={`${beo.filter((b) => b.status === "besloten").length}/${beo.length}`} label="beoordelingen 2026 afgerond" />
        <Kpi waarde={String(handboekOud.length)} label="handboekdocumenten over reviewdatum" toon={handboekOud.length ? "rood" : "navy"} />
      </div>

      <Blok titel="Per franchisenemer">
        <Tabel kop={["Franchisenemer", "Vestigingen", "Medewerkers", "Bevestigd", "Onboarding", "Beoordelingen", "Signaal"]}>
          {fns.map((f) => {
            const vest = org.vestigingen.filter((v) => v.franchisenemerId === f.id);
            const m = mensen.filter((p) => p.franchisenemerId === f.id);
            const b = beo.filter((x) => m.some((p) => p.id === x.gebruikerId));
            const ber = bereik(m);
            const ob = onb(m);
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
