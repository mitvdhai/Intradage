import { FileText } from "lucide-react";
import { VraagHandboek } from "@/components/vraag-handboek";
import { Lijst, PageTop, Rij, Sectie, tijdLabel } from "@/components/ui";
import { handboekVoor } from "@/lib/data";
import { vereisGebruiker } from "@/lib/session";

export default async function Handboek() {
  const u = await vereisGebruiker();
  const docs = handboekVoor(u).sort((a, b) => b.bijgewerkt.localeCompare(a.bijgewerkt));
  return (
    <>
      <PageTop titel="Handboek" sub="Antwoorden komen alleen uit onze eigen documenten" />
      <div className="bg-white px-4 pb-4"><VraagHandboek /></div>
      <Sectie titel="Documenten">
        <Lijst>
          {docs.map((d) => <Rij key={d.id} href={`/app/handboek/${d.id}`} icoon={<FileText size={18} />} titel={d.titel} sub={`Versie ${d.versie} · bijgewerkt ${tijdLabel(d.bijgewerkt)}`} />)}
        </Lijst>
      </Sectie>
    </>
  );
}
