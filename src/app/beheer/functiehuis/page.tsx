import Link from "next/link";
import { FunctieprofielEditor } from "@/components/functieprofiel-editor";
import { cx } from "@/components/ui";
import { isHQ } from "@/lib/access";
import { vereisGebruiker } from "@/lib/session";
import { db } from "@/lib/store";
import { Blok, Kop } from "../beheer-ui";

export default async function Functiehuis({ searchParams }: PageProps<"/beheer/functiehuis">) {
  const { f } = await searchParams;
  const u = await vereisGebruiker();
  const functies = [...db.functies].sort((a, b) => a.trede - b.trede);
  const actief = functies.find((x) => x.id === f) ?? functies[0];
  const bezetting = (id: string) => db.gebruikers.filter((g) => g.functieId === id).length;

  return (
    <>
      <Kop titel="Functiehuis" sub="Functies, functieomschrijvingen en gewogen profielen. Medewerkers zien alleen hun eigen functie." />
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <Blok titel="Loopbaanladder · vestiging">
          <ol className="space-y-2">
            {functies.map((x, i) => (
              <li key={x.id}>
                <Link href={`/beheer/functiehuis?f=${x.id}`} className={cx("flex items-center gap-3 rounded-xl border px-3 py-2.5", x.id === actief.id ? "border-navy-700 bg-navy-50" : "border-line hover:border-navy-300")}>
                  <span className={cx("grid h-7 w-7 place-items-center rounded-full text-[13px] font-bold", x.id === actief.id ? "bg-brand-600 text-white" : "bg-slate-100 text-navy-700")}>{i + 1}</span>
                  <span className="min-w-0"><span className="block truncate font-semibold">{x.naam}</span><span className="block text-[12px] text-muted">FG {x.functiegroep} · {bezetting(x.id)} pers.</span></span>
                </Link>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-[12px] text-muted">Functiegroepen zijn indicatief en worden vastgesteld volgens het Handboek Referentiefuncties Horeca.</p>
        </Blok>

        <div className="space-y-6">
          <Blok titel={`Functieomschrijving · ${actief.naam}`}>
            <p className="mb-4 text-[15px]">{actief.doel}</p>
            <div className="grid gap-4 md:grid-cols-3 text-sm">
              <div><div className="mb-1 font-semibold">Kerntaken</div><ul className="list-disc space-y-0.5 pl-5">{actief.kerntaken.map((t) => <li key={t}>{t}</li>)}</ul></div>
              <div><div className="mb-1 font-semibold">Verantwoordelijk voor</div><ul className="list-disc space-y-0.5 pl-5">{actief.verantwoordelijkheden.map((t) => <li key={t}>{t}</li>)}</ul></div>
              <div><div className="mb-1 font-semibold">Plaats</div><p>{actief.plaatsInOrganisatie}</p></div>
            </div>
          </Blok>
          <Blok titel="Profiel en weging" rechts={!isHQ(u) ? <span className="text-[12px] text-muted">alleen HQ kan wijzigen</span> : undefined}>
            <FunctieprofielEditor key={actief.id} functie={actief} items={db.profielItems} magBewerken={isHQ(u)} />
          </Blok>
        </div>
      </div>
    </>
  );
}
