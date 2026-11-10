import { redirect } from "next/navigation";
import { NiveauKiezer } from "@/components/niveau-kiezer";
import { Knop, PageTop, Sectie } from "@/components/ui";
import { slaZelfbeoordelingOp } from "@/lib/acties";
import { functieVan } from "@/lib/data";
import { CATEGORIEEN, CATEGORIE_LABEL } from "@/lib/functiehuis/score";
import { vereisGebruiker } from "@/lib/session";
import { db, profielItemMap } from "@/lib/store";

export default async function Zelfbeoordeling() {
  const u = await vereisGebruiker();
  const f = functieVan(u);
  const b = db.beoordelingen.find((x) => x.gebruikerId === u.id && x.status === "zelfbeoordeling");
  if (!f || !b) redirect("/app/werk/functie");
  const items = profielItemMap();

  return (
    <>
      <PageTop terug={{ href: "/app/werk/functie", label: "Functie" }} titel={`Zelfbeoordeling ${b.periode}`} sub="Hoe sta je ervoor? Je leidinggevende ziet je antwoorden vóór het gesprek." />
      <form action={slaZelfbeoordelingOp}>
        {CATEGORIEEN.map((cat) => {
          const regels = f.profiel.filter((r) => items.get(r.itemId)?.categorie === cat);
          if (!regels.length) return null;
          return (
            <Sectie key={cat} titel={CATEGORIE_LABEL[cat]}>
              <div className="space-y-3">
                {regels.map((r) => {
                  const it = items.get(r.itemId)!;
                  return (
                    <div key={r.itemId} className="rounded-2xl border border-line bg-white p-4">
                      <div className="mb-1 font-semibold">{it.naam}</div>
                      <div className="mb-3 text-[13px] text-muted">Vereist: {it.niveaus[r.vereistNiveau - 1]}</div>
                      <NiveauKiezer naam={`n-${r.itemId}`} niveaus={[...it.niveaus]} vereist={r.vereistNiveau} />
                    </div>
                  );
                })}
              </div>
            </Sectie>
          );
        })}
        <div className="px-4 pt-5"><Knop>Indienen</Knop></div>
      </form>
    </>
  );
}
