import { notFound } from "next/navigation";
import { ChecklistForm } from "@/components/checklist-form";
import { PageTop, Segmenten } from "@/components/ui";
import { checklistVestigingen, sjabloon, uitvoeringen } from "@/lib/betrokkenheid";
import { vestigingNaam } from "@/lib/data";
import { vereisGebruiker } from "@/lib/session";
import type { Rol } from "@/lib/types";

/** Een checklist of evaluatie invullen. ?v=vestiging kiest de vestiging (leiding/HQ). */
export default async function ChecklistPagina({ params, searchParams }: PageProps<"/app/checklist/[id]">) {
  const { id } = await params;
  const { v } = await searchParams;
  const { u, org } = await vereisGebruiker();
  const s = await sjabloon(id);
  const mag = checklistVestigingen(org, u);
  if (!s || !s.rollen.includes(u.rol as Rol) || !mag.length) notFound();
  const vestigingId = typeof v === "string" && mag.includes(v) ? v : mag[0];
  // Een eigen concept van vandaag pakken we weer op
  const vandaag = new Date(); vandaag.setHours(0, 0, 0, 0);
  const concept = (await uitvoeringen({ vestigingIds: [vestigingId], sjabloonId: s.id, sinds: vandaag })).find((x) => x.status === "concept" && x.uitgevoerdDoor === u.id);
  const evaluatie = s.soort === "evaluatie";

  return (
    <>
      <PageTop terug={evaluatie ? { href: "/app/evaluaties", label: "Evaluaties" } : { href: "/app/werk/taken", label: "Taken" }}
        titel={s.titel} sub={`${vestigingNaam(org, vestigingId)} · ${new Date().toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" })}`} />
      {mag.length > 1 && <Segmenten actief={vestigingNaam(org, vestigingId)} items={mag.map((x) => ({ label: vestigingNaam(org, x), href: `/app/checklist/${s.id}?v=${x}` }))} />}
      <ChecklistForm key={vestigingId} sjabloonId={s.id} vestigingId={vestigingId} onderdelen={s.onderdelen} evaluatie={evaluatie}
        bestaand={concept ? { id: concept.id, antwoorden: concept.antwoorden } : undefined} />
    </>
  );
}
