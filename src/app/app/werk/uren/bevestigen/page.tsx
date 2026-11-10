import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { ActieForm } from "@/components/actie-form";
import { PageTop, Sectie } from "@/components/ui";
import { voornaamVan, vestigingNaam } from "@/lib/data";
import { corrigeerKlok, keurUrenGoed } from "@/lib/personeel/acties";
import { bevestigVestigingen, diensten, nettoUren, teBevestigen } from "@/lib/personeel/data";
import { vereisGebruiker } from "@/lib/session";

const hhmm = (d: Date | null) => d ? d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" }) : "–";
const n2 = (n: number) => n.toFixed(2).replace(".", ",");

/** Uren van het team bevestigen: shiftleider (eigen vestiging), manager, franchisenemer. */
export default async function UrenBevestigen() {
  const { u, org } = await vereisGebruiker();
  if (!bevestigVestigingen(org, u).length) redirect("/app/werk/uren");
  const regels = (await teBevestigen(org, u)).sort((a, b) => a.in.getTime() - b.in.getTime());
  const gepland = regels.length ? await diensten({ gebruikerIds: [...new Set(regels.map((k) => k.gebruikerId))], van: new Date(Math.min(...regels.map((k) => k.in.getTime())) - 86400000), tot: new Date(Math.max(...regels.map((k) => k.in.getTime())) + 86400000) }) : [];
  return (
    <>
      <PageTop terug={{ href: "/app/werk", label: "Mijn werk" }} titel="Uren bevestigen" sub={u.vestigingIds.map((v) => vestigingNaam(org, v)).join(" · ")} />
      {regels.length === 0 ? (
        <Sectie><div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"><CheckCircle2 size={18} /> Alle uren zijn bevestigd.</div></Sectie>
      ) : (
        <>
          <div className="px-4 pt-4">
            <form action={keurUrenGoed.bind(null, regels.filter((k) => { const d = gepland.find((x) => x.id === k.dienstId); return d && Math.abs((k.uit!.getTime() - k.in.getTime()) - (d.eind.getTime() - d.start.getTime())) <= 15 * 60000; }).map((k) => k.id))}>
              <button className="tap w-full rounded-xl bg-navy-700 text-[15px] font-semibold text-white">Bevestig alles volgens rooster</button>
            </form>
            <p className="mt-1.5 text-center text-[12px] text-muted">Regels die meer dan 15 minuten afwijken, bevestig je hieronder apart.</p>
          </div>
          <Sectie titel={`Ingediend (${regels.length})`}>
            <div className="space-y-2">
              {regels.map((k) => {
                const d = gepland.find((x) => x.id === k.dienstId);
                const af = d && k.uit ? Math.round(((k.uit.getTime() - k.in.getTime()) - (d.eind.getTime() - d.start.getTime())) / 60000) : 0;
                return (
                  <div key={k.id} className="rounded-2xl border border-line bg-white p-3.5">
                    <div className="flex items-baseline justify-between">
                      <span className="font-semibold">{voornaamVan(org, k.gebruikerId)}</span>
                      <span className="text-[13px] capitalize text-muted">{k.in.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" })} · {vestigingNaam(org, k.vestigingId)}</span>
                    </div>
                    <div className="mt-1 text-[14px]"><span className="font-semibold tabular-nums">{hhmm(k.in)}–{hhmm(k.uit)}</span>{k.pauzeMin ? ` · ${k.pauzeMin} min pauze` : ""} · <b>{n2(nettoUren(k))} uur</b></div>
                    <div className={`text-[12px] ${Math.abs(af) > 15 ? "font-semibold text-amber-700" : "text-muted"}`}>{d ? `gepland ${hhmm(d.start)}–${hhmm(d.eind)}${Math.abs(af) > 1 ? ` · ${af > 0 ? "+" : ""}${af} min` : " · volgens rooster"}` : "niet ingepland"}{k.opmerking ? ` · “${k.opmerking}”` : ""}</div>
                    <div className="mt-2 flex gap-2">
                      <form action={keurUrenGoed.bind(null, [k.id])} className="flex-1"><button className="w-full rounded-lg bg-navy-700 py-2 text-[13px] font-semibold text-white">Bevestigen</button></form>
                      <details className="flex-1"><summary className="cursor-pointer rounded-lg py-2 text-center text-[13px] font-semibold ring-1 ring-line">Aanpassen</summary>
                        <div className="mt-2"><ActieForm actie={corrigeerKlok.bind(null, k.id)} knop="Aanpassen en bevestigen">
                          <div className="grid grid-cols-3 gap-1.5"><input name="in" type="time" defaultValue={hhmm(k.in)} className="rounded-lg border border-line px-1.5 py-1.5 text-sm" /><input name="uit" type="time" defaultValue={hhmm(k.uit)} className="rounded-lg border border-line px-1.5 py-1.5 text-sm" /><input name="pauze" type="number" defaultValue={k.pauzeMin} className="rounded-lg border border-line px-1.5 py-1.5 text-sm" /></div>
                          <input name="opmerking" placeholder="Reden" className="w-full rounded-lg border border-line px-2 py-1.5 text-sm" />
                        </ActieForm></div>
                      </details>
                    </div>
                  </div>
                );
              })}
            </div>
          </Sectie>
        </>
      )}
      <p className="px-5 pt-3 text-[12px] text-muted">Je bevestigt nooit je eigen uren. Bevestigde uren gaan in de uitdraai voor de loonadministratie.</p>
    </>
  );
}
