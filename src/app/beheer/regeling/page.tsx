import { redirect } from "next/navigation";
import { RegelingEditor } from "@/components/regeling-editor";
import { isHQ } from "@/lib/access";
import { vereisGebruiker } from "@/lib/session";
import { Blok, Kop } from "../beheer-ui";

export default async function Regeling() {
  const { u, org } = await vereisGebruiker();
  if (!isHQ(u)) redirect("/beheer");
  return (
    <>
      <Kop titel="Beloningsregeling" sub={`Versie ${org.regeling.versie} · van gewogen beoordelingsscore naar salarisadvies`} />
      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Blok titel="Uitkomsten en verhoging" rechts={u.discipline !== "hr" ? <span className="text-[12px] text-muted">alleen HQ HR kan wijzigen</span> : undefined}>
          <RegelingEditor regeling={org.regeling} magBewerken={u.discipline === "hr"} />
        </Blok>
        <Blok titel="Zo wordt gerekend">
          <ol className="list-decimal space-y-2 pl-5 text-[14px]">
            <li>Per onderdeel van het functieprofiel kiest de beoordelaar het behaalde niveau (1–4).</li>
            <li>Dat wordt vergeleken met het vereiste niveau: op niveau = 3, één erboven = 4, één eronder = 2 (min. 1, max. 5).</li>
            <li>De scores worden gewogen met de weging uit het functiehuis (samen 100%).</li>
            <li>De gewogen score bepaalt de uitkomst; de uitkomst bepaalt het adviespercentage.</li>
            <li>Het advies wordt begrensd tussen basis- en eindloon van de functiegroep. De franchisenemer beslist.</li>
          </ol>
          <div className="mt-4 rounded-xl bg-navy-50 p-3 text-[13px] text-navy-800">
            <b>Voorbeeld.</b> Iedereen precies op niveau = 3,00 → “goed” → +{org.regeling.verhoging.goed}%.
            Eén niveau hoger op <i>Bakken</i> (weging 15%) geeft +0,15 → 3,15.
          </div>
        </Blok>
      </div>
    </>
  );
}
