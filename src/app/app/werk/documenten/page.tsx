import { FileSignature, FileText, Lock, Receipt } from "lucide-react";
import { ActieForm } from "@/components/actie-form";
import { Ontgrendel } from "@/components/ontgrendel";
import { WerkSegmenten } from "@/components/werk-segmenten";
import { Label, Lijst, PageTop, Rij, Sectie } from "@/components/ui";
import { documentenVan, isOntgrendeld } from "@/lib/data";
import { uploadDocument } from "@/lib/personeel/acties";
import { contractenVan, dossierVan } from "@/lib/personeel/data";
import { vereisGebruiker } from "@/lib/session";

const TYPE = { oproep: "0-urencontract", minmax: "Min-maxcontract", vast: "Vast contract" } as const;
const veld = "tap w-full rounded-xl border border-line bg-white px-3 text-[15px]";

export default async function Documenten() {
  const { u } = await vereisGebruiker();
  const [open, docs, contracten, dossier] = await Promise.all([isOntgrendeld(u.id), documentenVan(u.id), contractenVan([u.id]), dossierVan(u.id)]);
  const loon = docs.filter((d) => d.type === "loonstrook").sort((a, b) => b.datum.localeCompare(a.datum));
  const datum = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
  const eigen = dossier.filter((d) => d.categorie !== "contract");

  return (
    <>
      <PageTop titel="Mijn werk" />
      <WerkSegmenten u={u} actief="Documenten" />
      <Sectie titel="Contracten">
        <Lijst>
          {contracten.map((c) => (
            <Rij key={c.id} href={`/app/werk/contract/${c.id}`} toon={c.status === "ter-ondertekening" && !c.ondertekendWerknemer ? "rood" : "navy"} icoon={<FileSignature size={18} />}
              titel={`${TYPE[c.type]} · ${c.urenMin === c.urenMax ? c.urenMax : `${c.urenMin}–${c.urenMax}`} uur`} sub={`${datum(c.start)} – ${c.eind ? datum(c.eind) : "onbepaalde tijd"}`}
              rechts={c.status === "ter-ondertekening" ? <Label toon={c.ondertekendWerknemer ? "navy" : "rood-vol"}>{c.ondertekendWerknemer ? "Wacht op werkgever" : "Tekenen"}</Label> : c.status === "getekend" ? <Label toon="groen">Getekend</Label> : <Label toon="grijs">Afgelopen</Label>} />
          ))}
        </Lijst>
      </Sectie>
      {!open && <Sectie><Ontgrendel mobiel={u.mobiel} /></Sectie>}
      <Sectie titel="Loonstroken" rechts={open ? <span className="text-emerald-700">ontgrendeld</span> : "extra beveiligd"}>
        <Lijst>
          {loon.map((d) => <Rij key={d.id} href={open ? "#" : undefined} toon={open ? "navy" : "grijs"} icoon={open ? <Receipt size={18} /> : <Lock size={18} />} titel={<span className="capitalize">{d.titel}</span>} sub={`Uitbetaald ${datum(d.datum)}`} />)}
        </Lijst>
        <p className="mt-2 px-1 text-[12px] text-muted">Loonstroken komen van de loonadministratie. Elke inzage wordt gelogd en niets wordt op je telefoon bewaard.</p>
      </Sectie>
      <Sectie titel="Mijn dossier">
        <Lijst>
          {eigen.map((d) => (
            <Rij key={d.id} href={d.heeftBestand ? `/dossier/${d.id}` : undefined} icoon={<FileText size={18} />} titel={d.titel}
              sub={`${d.categorie}${d.vervalt ? ` · geldig tot ${datum(d.vervalt)}` : ""}`} toon={d.vervalt && d.vervalt < new Date().toLocaleDateString("sv-SE") ? "rood" : "navy"} />
          ))}
          {!eigen.length && <Rij titel="Nog geen documenten" />}
        </Lijst>
        <details className="mt-3 rounded-2xl border border-line bg-white p-4">
          <summary className="cursor-pointer font-semibold text-navy-700">Document toevoegen (bijv. certificaat of diploma)</summary>
          <ActieForm actie={uploadDocument.bind(null, null)} knop="Uploaden" className="mt-3" reset succes="Toegevoegd aan je dossier.">
            <select name="categorie" className={veld}><option value="certificaat">Certificaat (HACCP, BHV…)</option><option value="diploma">Diploma</option><option value="identiteit">Identiteitsbewijs</option><option value="verklaring">Verklaring (bijv. toestemming ouders)</option><option value="overig">Overig</option></select>
            <input name="titel" placeholder="Bijv. HACCP-certificaat" className={veld} />
            <label className="block text-[12px] text-muted">Geldig tot (als het verloopt)<input name="vervalt" type="date" className={veld} /></label>
            <input name="bestand" type="file" accept="image/*,application/pdf" capture="environment" className="text-sm" />
          </ActieForm>
        </details>
      </Sectie>
    </>
  );
}
