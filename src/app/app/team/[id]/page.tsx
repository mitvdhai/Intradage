import { notFound } from "next/navigation";
import { BeoordelingFormulier } from "@/components/beoordeling-formulier";
import { PageTop } from "@/components/ui";
import { magMedewerkerZien } from "@/lib/access";
import { beoordelingen, functieVan, naamVan, salarisVan, voornaamVan } from "@/lib/data";
import { vereisGebruiker } from "@/lib/session";

export default async function BeoordelingPagina({ params }: PageProps<"/app/team/[id]">) {
  const { id } = await params;
  const { u, org } = await vereisGebruiker();
  if (!magMedewerkerZien(org, u, id) || u.id === id) notFound();
  const m = org.gebruikers.find((g) => g.id === id)!;
  const b = (await beoordelingen({ gebruikerIds: [id] })).find((x) => x.periode === "2026");
  const f = functieVan(org, m);
  if (!b || !f) notFound();
  const isBeoordelaar = b.beoordelaarId === u.id;

  return (
    <>
      <PageTop terug={{ href: "/app/team", label: "Team" }} titel={`Beoordeling ${b.periode} · ${m.voornaam}`}
        sub={`${f.naam} · beoordelaar ${voornaamVan(org, b.beoordelaarId)}${b.status === "zelfbeoordeling" ? " · zelfbeoordeling nog niet ingevuld" : ""}`} />
      <BeoordelingFormulier
        beoordeling={b} functie={f} items={org.profielItems} regeling={org.regeling}
        salaris={u.rol === "franchisenemer" ? await salarisVan(id) : undefined}
        magBewerken={isBeoordelaar && b.status !== "zelfbeoordeling"}
        magBesluiten={isBeoordelaar && u.rol === "franchisenemer"} />
      {!isBeoordelaar && <p className="px-5 pt-4 text-[13px] text-muted">Alleen {naamVan(org, b.beoordelaarId)} kan deze beoordeling invullen.</p>}
    </>
  );
}
