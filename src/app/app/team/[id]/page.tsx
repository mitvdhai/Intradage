import { notFound } from "next/navigation";
import { BeoordelingFormulier } from "@/components/beoordeling-formulier";
import { PageTop } from "@/components/ui";
import { magMedewerkerZien } from "@/lib/access";
import { functieVan, naamVan, voornaamVan } from "@/lib/data";
import { vereisGebruiker } from "@/lib/session";
import { db } from "@/lib/store";

export default async function BeoordelingPagina({ params }: PageProps<"/app/team/[id]">) {
  const { id } = await params;
  const u = await vereisGebruiker();
  if (!magMedewerkerZien(u, id) || u.id === id) notFound();
  const m = db.gebruikers.find((g) => g.id === id)!;
  const b = db.beoordelingen.find((x) => x.gebruikerId === id && x.periode === "2026");
  const f = functieVan(m);
  if (!b || !f) notFound();
  const isBeoordelaar = b.beoordelaarId === u.id;

  return (
    <>
      <PageTop terug={{ href: "/app/team", label: "Team" }} titel={`Beoordeling ${b.periode} · ${m.voornaam}`}
        sub={`${f.naam} · beoordelaar ${voornaamVan(b.beoordelaarId)}${b.status === "zelfbeoordeling" ? " · zelfbeoordeling nog niet ingevuld" : ""}`} />
      <BeoordelingFormulier
        beoordeling={b} functie={f} items={db.profielItems} regeling={db.regeling}
        salaris={u.rol === "franchisenemer" ? db.salaris.find((s) => s.gebruikerId === id) : undefined}
        magBewerken={isBeoordelaar && b.status !== "zelfbeoordeling"}
        magBesluiten={isBeoordelaar && u.rol === "franchisenemer"} />
      {!isBeoordelaar && <p className="px-5 pt-4 text-[13px] text-muted">Alleen {naamVan(b.beoordelaarId)} kan deze beoordeling invullen.</p>}
    </>
  );
}
