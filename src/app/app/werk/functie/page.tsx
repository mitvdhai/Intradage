import { redirect } from "next/navigation";
import { Award, BookOpen, ClipboardList, GraduationCap, Target, UserCheck } from "lucide-react";
import { WerkSegmenten } from "@/components/werk-segmenten";
import { Kaart, Label, Lijst, PageTop, Rij, Sectie, euro } from "@/components/ui";
import { functieVan, voornaamVan } from "@/lib/data";
import { CATEGORIEEN, CATEGORIE_LABEL, berekenUitslag } from "@/lib/functiehuis/score";
import { vereisGebruiker } from "@/lib/session";
import { db, profielItemMap } from "@/lib/store";

const ICOON = { competentie: Target, vaardigheid: GraduationCap, kennis: Award };

export default async function MijnFunctie() {
  const u = await vereisGebruiker();
  const f = functieVan(u);
  if (!f) redirect("/app/werk");
  const items = profielItemMap();
  const niveau = db.huidigNiveau[u.id] ?? {};
  const beoordelingen = db.beoordelingen.filter((b) => b.gebruikerId === u.id).sort((a, b) => b.periode.localeCompare(a.periode));
  const lopend = beoordelingen.find((b) => b.status !== "besloten");
  const laatste = beoordelingen.find((b) => b.status === "besloten");
  const uitslagLaatste = laatste ? berekenUitslag(f, items, laatste.beoordelaar, db.regeling) : null;

  return (
    <>
      <PageTop titel="Mijn werk" />
      <WerkSegmenten u={u} actief="Functie" />

      <div className="px-4 pt-4">
        <Kaart className="border-navy-100 bg-navy-50">
          <div className="text-[12px] font-semibold uppercase tracking-wider text-navy-600">Jouw functie</div>
          <div className="mt-0.5 text-xl font-bold tracking-tight text-navy-900">{f.naam}</div>
          <div className="text-[13px] text-navy-700">Functiegroep {f.functiegroep} · sinds {new Date(u.inDienstSinds).toLocaleDateString("nl-NL", { month: "long", year: "numeric" })}</div>
          <p className="mt-3 text-[15px] leading-relaxed text-ink">{f.doel}</p>
        </Kaart>
      </div>

      <Sectie>
        <details className="group overflow-hidden rounded-2xl border border-line bg-white">
          <summary className="tap flex cursor-pointer list-none items-center gap-3 px-3.5 py-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-navy-50 text-navy-700"><BookOpen size={18} /></span>
            <span className="flex-1"><span className="block text-[15px] font-semibold">Functieomschrijving</span><span className="block text-[13px] text-muted">Taken, verantwoordelijkheden en plaats</span></span>
            <span className="text-slate-400 transition group-open:rotate-90">›</span>
          </summary>
          <div className="space-y-3 border-t border-line px-4 py-3 text-[14px]">
            <div><div className="mb-1 font-semibold">Kerntaken</div><ul className="list-disc space-y-0.5 pl-5">{f.kerntaken.map((t) => <li key={t}>{t}</li>)}</ul></div>
            <div><div className="mb-1 font-semibold">Verantwoordelijk voor</div><ul className="list-disc space-y-0.5 pl-5">{f.verantwoordelijkheden.map((t) => <li key={t}>{t}</li>)}</ul></div>
            <div><div className="mb-1 font-semibold">Plaats in de organisatie</div><p>{f.plaatsInOrganisatie}</p></div>
          </div>
        </details>
      </Sectie>

      <Sectie titel="Jouw profiel" rechts={<span className="text-muted">telt mee in je beoordeling</span>}>
        <Lijst>
          {CATEGORIEEN.map((cat) => {
            const regels = f.profiel.filter((r) => items.get(r.itemId)?.categorie === cat);
            if (!regels.length) return null;
            const w = regels.reduce((s, r) => s + r.weging, 0);
            const opNiveau = regels.filter((r) => (niveau[r.itemId] ?? 0) >= r.vereistNiveau).length;
            const I = ICOON[cat];
            const tekort = regels.length - opNiveau;
            return (
              <Rij key={cat} href={`/app/werk/functie/${cat}`} icoon={<I size={18} />} toon={tekort ? "rood" : "navy"}
                titel={CATEGORIE_LABEL[cat]} sub={tekort ? `${opNiveau} van ${regels.length} op niveau · ${tekort} ontwikkelpunt${tekort > 1 ? "en" : ""}` : `Alle ${regels.length} op niveau`}
                rechts={<span className="mr-1 rounded-md bg-slate-100 px-2 py-0.5 text-[13px] font-bold text-navy-800">{w}%</span>} />
            );
          })}
        </Lijst>
      </Sectie>

      <Sectie titel="Beoordeling">
        <Lijst>
          {lopend && (
            lopend.status === "zelfbeoordeling"
              ? <Rij href="/app/werk/functie/zelfbeoordeling" toon="rood" icoon={<UserCheck size={18} />} titel={`Zelfbeoordeling ${lopend.periode}`} sub="Vul eerst zelf in hoe je ervoor staat" />
              : <Rij icoon={<ClipboardList size={18} />} titel={`Beoordeling ${lopend.periode}`} sub={`${lopend.status === "gesprek" ? "Klaar voor het gesprek" : "Wordt ingevuld"} door ${voornaamVan(lopend.beoordelaarId)}`} />
          )}
          {laatste && uitslagLaatste && (
            <Rij icoon={<Award size={18} />} toon="groen" titel={`Beoordeling ${laatste.periode}: ${uitslagLaatste.uitkomst}`}
              sub={`Score ${uitslagLaatste.totaal?.toFixed(2).replace(".", ",")} · nieuw uurloon ${euro(laatste.besluit!.nieuwUurloon)}`}
              rechts={<Label toon="groen">+{laatste.besluit!.percentage}%</Label>} />
          )}
        </Lijst>
        <p className="mt-3 px-1 text-[12px] leading-relaxed text-muted">
          Je beoordeling is gebaseerd op dit profiel. Elk onderdeel heeft een weging; samen bepalen ze je score en het advies voor je salarisontwikkeling. Je franchisenemer neemt het besluit.
        </p>
      </Sectie>
    </>
  );
}
