import { ActieForm } from "@/components/actie-form";
import { BeschikbaarheidVelden } from "@/components/beschikbaarheid-velden";
import { PageTop } from "@/components/ui";
import { slaBeschikbaarheidOp } from "@/lib/personeel/acties";
import { beschikbaarheidVan, medewerker } from "@/lib/personeel/data";
import { leeftijdOp, regelsVoor } from "@/lib/planning/atw";
import { vereisGebruiker } from "@/lib/session";

export default async function Beschikbaarheid() {
  const { u } = await vereisGebruiker();
  const [huidig, m] = await Promise.all([beschikbaarheidVan([u.id]), medewerker(u.id)]);
  const lft = leeftijdOp(m?.geboortedatum, new Date().toLocaleDateString("sv-SE"));
  const r = regelsVoor(lft);
  return (
    <>
      <PageTop terug={{ href: "/app/werk", label: "Mijn werk" }} titel="Beschikbaarheid" sub="Vink aan wanneer je normaal kunt werken. Je leidinggevende plant je alleen dan in." />
      <div className="px-4 pt-4">
        <ActieForm actie={slaBeschikbaarheidOp} knop="Opslaan" variant="rood" succes="Opgeslagen. Je leidinggevende ziet het bij de volgende planning.">
          <BeschikbaarheidVelden huidig={huidig} />
          {lft !== null && lft < 18 && <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-800">Je bent {lft}. Volgens de Arbeidstijdenwet werk je maximaal {r.maxDienstMin / 60} uur per dienst{r.nietNa ? ` en niet na ${r.nietNa / 60}:00` : ""}. Daar houdt het rooster automatisch rekening mee.</p>}
          <p className="text-[13px] text-muted">Een dag niet kunnen? Vraag dan verlof aan bij <b>Verlof en ziekmelden</b>.</p>
        </ActieForm>
      </div>
    </>
  );
}
