import { Clock } from "lucide-react";
import { Label, Lijst, PageTop, Rij, Sectie } from "@/components/ui";
import { klokVan, nettoUren, vestigingen } from "@/lib/personeel/data";
import { vereisGebruiker } from "@/lib/session";
import { nuMs } from "@/lib/tijd";

const n1 = (n: number) => n.toFixed(2).replace(".", ",");
const hhmm = (d: Date | null) => d ? d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" }) : "…";

export default async function MijnUren() {
  const { u } = await vereisGebruiker();
  const [klok, vest] = await Promise.all([klokVan({ gebruikerIds: [u.id], van: new Date(nuMs() - 42 * 86400000) }), vestigingen(u.vestigingIds)]);
  const maand = new Date(); maand.setDate(1); maand.setHours(0, 0, 0, 0);
  const dezeMaand = klok.filter((k) => k.in >= maand).reduce((s, k) => s + nettoUren(k), 0);
  return (
    <>
      <PageTop terug={{ href: "/app/werk", label: "Mijn werk" }} titel="Mijn uren" sub="In- en uitklokken doe je op het startscherm, bij je dienst." />
      <div className="grid grid-cols-2 gap-2 px-4 pt-4 text-center">
        <div className="rounded-2xl border border-line bg-white py-3"><div className="text-2xl font-bold text-navy-800">{n1(dezeMaand)}</div><div className="text-[11px] font-semibold uppercase tracking-wider text-muted">uur deze maand</div></div>
        <div className="rounded-2xl border border-line bg-white py-3"><div className="text-2xl font-bold text-navy-800">{klok.filter((k) => k.status === "ingediend").length}</div><div className="text-[11px] font-semibold uppercase tracking-wider text-muted">wacht op akkoord</div></div>
      </div>
      <Sectie titel="Laatste 6 weken">
        <Lijst>
          {klok.map((k) => (
            <Rij key={k.id} toon={k.status === "goedgekeurd" ? "groen" : "navy"} icoon={<Clock size={18} />}
              titel={<span className="capitalize">{k.in.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "short" })}</span>}
              sub={`${hhmm(k.in)} – ${hhmm(k.uit)}${k.pauzeMin ? ` · ${k.pauzeMin} min pauze` : ""} · ${vest.find((v) => v.id === k.vestigingId)?.naam ?? ""}`}
              rechts={<div className="text-right"><div className="font-semibold tabular-nums">{k.uit ? `${n1(nettoUren(k))} u` : "nu"}</div><Label toon={k.status === "goedgekeurd" ? "groen" : "navy"}>{k.status === "open" ? "ingeklokt" : k.status}</Label></div>} />
          ))}
          {!klok.length && <Rij titel="Nog geen geklokte uren" />}
        </Lijst>
      </Sectie>
      <p className="px-5 pt-3 text-[12px] text-muted">Klopt er iets niet? Vraag je leidinggevende om het te corrigeren. Goedgekeurde uren gaan naar de loonadministratie.</p>
    </>
  );
}
