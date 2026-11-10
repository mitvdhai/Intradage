import { notFound } from "next/navigation";
import { EnqueteForm } from "@/components/enquete-form";
import { EnqueteResultaat } from "@/components/enquete-resultaat";
import { Kaart, PageTop, Sectie } from "@/components/ui";
import { isHQ } from "@/lib/access";
import { enqueteResultaten, enquetesVoor } from "@/lib/betrokkenheid";
import { vereisGebruiker } from "@/lib/session";

export default async function EnquetePagina({ params }: PageProps<"/app/enquetes/[id]">) {
  const { id } = await params;
  const { u, org } = await vereisGebruiker();
  const e = (await enquetesVoor(org, u)).find((x) => x.id === id);
  if (!e) notFound();
  const kanInvullen = e.open && (!e.gedaan || e.type === "idee");
  // Polls: iedereen ziet de stand na stemmen. Anonieme enquêtes: alleen HQ (en via beheer de FN). Ideeën: niet openbaar.
  const toonResultaat = e.type === "poll" ? e.gedaan || !e.open : isHQ(u) && e.type !== "idee";
  const res = toonResultaat ? await enqueteResultaten(e) : null;

  return (
    <>
      <PageTop terug={{ href: "/app/enquetes", label: "Enquêtes" }} titel={e.titel} sub={e.intro ?? undefined} />
      {kanInvullen && <EnqueteForm id={e.id} vragen={e.vragen} anoniem={e.anoniem} idee={e.type === "idee"} />}
      {!kanInvullen && !res && <div className="mx-4 mt-4 rounded-2xl bg-emerald-50 p-4 text-sm font-medium text-emerald-800">{e.gedaan ? "Je hebt deze enquête ingevuld. Dank je wel!" : "Deze enquête is gesloten."}</div>}
      {res && (
        <Sectie titel={e.type === "poll" ? "Tussenstand" : "Resultaten"}>
          <Kaart><EnqueteResultaat {...res} toonOpen={isHQ(u)} /></Kaart>
        </Sectie>
      )}
    </>
  );
}
