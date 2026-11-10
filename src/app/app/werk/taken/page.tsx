import { CheckCircle2, ClipboardList, Lock, Thermometer } from "lucide-react";
import { WerkSegmenten } from "@/components/werk-segmenten";
import { Label, Lijst, PageTop, Rij, Sectie, uurLabel } from "@/components/ui";
import { actiepunten, checklistVestigingen, sjablonen, uitvoeringen } from "@/lib/betrokkenheid";
import { vestigingNaam, voornaamVan } from "@/lib/data";
import { vereisGebruiker } from "@/lib/session";
import type { Rol } from "@/lib/types";

export default async function Taken({ searchParams }: PageProps<"/app/werk/taken">) {
  const { klaar } = await searchParams;
  const { u, org } = await vereisGebruiker();
  const vest = checklistVestigingen(org, u);
  const vandaag = new Date(); vandaag.setHours(0, 0, 0, 0);
  const [lijsten, gedaan, acties] = await Promise.all([sjablonen("dagtaak"), uitvoeringen({ vestigingIds: vest, soort: "dagtaak", sinds: vandaag }), actiepunten({ vestigingIds: vest, open: true })]);
  const mijnActies = acties.filter((a) => a.eigenaarId === u.id || u.rol !== "medewerker");

  return (
    <>
      <PageTop titel="Mijn werk" />
      <WerkSegmenten u={u} actief="Taken" />
      {klaar && <div className="mx-4 mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"><CheckCircle2 size={18} /> Afgerond en opgeslagen.</div>}
      <Sectie titel={`Vandaag · ${vestigingNaam(org, vest[0] ?? "")}`}>
        <Lijst>
          {lijsten.map((s) => {
            const mag = s.rollen.includes(u.rol as Rol);
            const af = gedaan.filter((g) => g.sjabloonId === s.id && g.status === "afgerond");
            const laatste = af[0];
            const I = s.id === "cl-haccp" ? Thermometer : ClipboardList;
            return (
              <Rij key={s.id} href={mag ? `/app/checklist/${s.id}` : undefined} toon={laatste ? "groen" : mag ? "navy" : "grijs"} icoon={mag ? <I size={18} /> : <Lock size={18} />}
                titel={s.titel}
                sub={laatste ? `Gedaan door ${voornaamVan(org, laatste.uitgevoerdDoor)} om ${uurLabel(laatste.datum.toISOString())}${laatste.knockout ? " · afwijking!" : ""}` : mag ? s.omschrijving : "Doet de shiftleider"}
                rechts={laatste ? <Label toon={laatste.knockout ? "rood" : "groen"}>{laatste.knockout ? "Afwijking" : "Klaar"}</Label> : undefined} />
            );
          })}
        </Lijst>
      </Sectie>
      {mijnActies.length > 0 && (
        <Sectie titel="Openstaande actiepunten">
          <Lijst>
            {mijnActies.map((a) => (
              <Rij key={a.id} href={a.uitvoeringId ? `/app/evaluaties/${a.uitvoeringId}` : undefined} toon={a.deadline < new Date().toISOString().slice(0, 10) ? "rood" : "navy"} icoon={<ClipboardList size={18} />}
                titel={a.tekst} sub={`${voornaamVan(org, a.eigenaarId)} · voor ${new Date(a.deadline).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })} · ${vestigingNaam(org, a.vestigingId)}`} />
            ))}
          </Lijst>
        </Sectie>
      )}
    </>
  );
}
