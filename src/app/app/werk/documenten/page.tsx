import { FileSignature, Lock, Receipt } from "lucide-react";
import { Ontgrendel } from "@/components/ontgrendel";
import { WerkSegmenten } from "@/components/werk-segmenten";
import { Lijst, PageTop, Rij, Sectie } from "@/components/ui";
import { vereisGebruiker } from "@/lib/session";
import { db } from "@/lib/store";
import { nuMs } from "@/lib/tijd";

export default async function Documenten() {
  const u = await vereisGebruiker();
  const open = (db.ontgrendeld[u.id] ?? 0) > nuMs();
  const docs = db.documenten.filter((d) => d.gebruikerId === u.id);
  const loon = docs.filter((d) => d.type === "loonstrook").sort((a, b) => b.datum.localeCompare(a.datum));
  const contract = docs.filter((d) => d.type === "contract");
  const datum = (iso: string) => new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });

  return (
    <>
      <PageTop titel="Mijn werk" />
      <WerkSegmenten u={u} actief="Documenten" />
      {!open && <Sectie><Ontgrendel mobiel={u.mobiel} /></Sectie>}
      <Sectie titel="Loonstroken" rechts={open ? <span className="text-emerald-700">ontgrendeld</span> : "extra beveiligd"}>
        <Lijst>
          {loon.map((d) => <Rij key={d.id} href={open ? "#" : undefined} toon={open ? "navy" : "grijs"} icoon={open ? <Receipt size={18} /> : <Lock size={18} />} titel={<span className="capitalize">{d.titel}</span>} sub={`Uitbetaald ${datum(d.datum)}`} />)}
        </Lijst>
      </Sectie>
      <Sectie titel="Contract">
        <Lijst>
          {contract.map((d) => <Rij key={d.id} href={open ? "#" : undefined} toon={open ? "navy" : "grijs"} icoon={open ? <FileSignature size={18} /> : <Lock size={18} />} titel={d.titel} sub={`Ingangsdatum ${datum(d.datum)}`} />)}
        </Lijst>
        <p className="mt-3 px-1 text-[12px] text-muted">Documenten worden pas opgehaald uit HorecaManager als je ze opent en worden niet op je telefoon bewaard. Elke inzage wordt gelogd.</p>
      </Sectie>
    </>
  );
}
