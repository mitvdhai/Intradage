import { Clock } from "lucide-react";
import { ActieForm } from "@/components/actie-form";
import { dienUrenIn } from "@/lib/personeel/acties";
import { Label, Lijst, PageTop, Rij, Sectie } from "@/components/ui";
import { klokVan, nettoUren, posities, urenInTeVullen, vestigingen } from "@/lib/personeel/data";
import { vereisGebruiker } from "@/lib/session";
import { nuMs } from "@/lib/tijd";

const n1 = (n: number) => n.toFixed(2).replace(".", ",");
const hhmm = (d: Date | null) => d ? d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" }) : "…";

export default async function MijnUren() {
  const { u } = await vereisGebruiker();
  const [klok, vest, open, pos] = await Promise.all([klokVan({ gebruikerIds: [u.id], van: new Date(nuMs() - 42 * 86400000) }), vestigingen(u.vestigingIds), urenInTeVullen(u.id), posities()]);
  const maand = new Date(); maand.setDate(1); maand.setHours(0, 0, 0, 0);
  const dezeMaand = klok.filter((k) => k.in >= maand).reduce((s, k) => s + nettoUren(k), 0);
  return (
    <>
      <PageTop terug={{ href: "/app/werk", label: "Mijn werk" }} titel="Mijn uren" sub="Na elke dienst vul je je uren in. Je shiftleider of leidinggevende bevestigt ze." />
      {open.length > 0 && (
        <Sectie titel="In te vullen" rechts={<span className="font-semibold text-brand-700">{open.length}</span>}>
          <div className="space-y-3">
            {open.map((d) => (
              <div key={d.id} className="rounded-2xl border border-brand-100 bg-white p-4">
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="font-semibold capitalize">{d.start.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "short" })}</span>
                  <span className="text-[13px] text-muted">gepland {hhmm(d.start)}–{hhmm(d.eind)} · {pos.find((p) => p.id === d.positieId)?.naam}</span>
                </div>
                <ActieForm actie={dienUrenIn.bind(null, d.id)} knop="Indienen" variant="rood" succes="Ingediend, wacht op bevestiging.">
                  <div className="grid grid-cols-3 gap-2">
                    <label className="text-[12px] text-muted">Begin<input name="in" type="time" defaultValue={hhmm(d.start)} className="tap w-full rounded-xl border border-line px-2 text-[15px] tabular-nums" /></label>
                    <label className="text-[12px] text-muted">Eind<input name="uit" type="time" defaultValue={hhmm(d.eind)} className="tap w-full rounded-xl border border-line px-2 text-[15px] tabular-nums" /></label>
                    <label className="text-[12px] text-muted">Pauze (min)<input name="pauze" type="number" min={0} max={120} step={5} defaultValue={d.pauzeMin} className="tap w-full rounded-xl border border-line px-2 text-[15px]" /></label>
                  </div>
                  <input name="opmerking" placeholder="Andere tijden? Schrijf kort waarom" className="tap w-full rounded-xl border border-line px-3 text-[14px]" />
                </ActieForm>
              </div>
            ))}
          </div>
          <p className="mt-2 px-1 text-[12px] text-muted">De geplande tijden staan al ingevuld. Klopt het? Tik dan alleen op Indienen.</p>
        </Sectie>
      )}
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
