"use client";

import { useActionState, useState } from "react";
import { Copy, Plus, Trash2 } from "lucide-react";
import { slaVestigingOp } from "@/lib/personeel/acties";
import { cx } from "./ui";

const DAGEN = [1, 2, 3, 4, 5, 6, 0];
const DAGNAAM = ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"];
interface Norm { weekdag: number; positieId: string; aantal: number; van: string; tot: string }

export function VestigingEditor({ vestigingId, opening, normen: begin, posities }: {
  vestigingId: string; opening: Record<string, { open: string; sluit: string } | null>; normen: Norm[]; posities: { id: string; naam: string; kleur: string }[];
}) {
  const [normen, setNormen] = useState<Norm[]>(begin);
  const [dicht, setDicht] = useState<Record<number, boolean>>(Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, !opening[d]])));
  const [res, actie, bezig] = useActionState(slaVestigingOp.bind(null, vestigingId), null);
  const zet = (i: number, p: Partial<Norm>) => setNormen((n) => n.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const kopieer = (van: number) => {
    const bron = normen.filter((n) => n.weekdag === van);
    const naar = DAGEN.filter((d) => d !== van && !dicht[d] && (van === 0 || van === 6 ? d === (van === 6 ? 5 : 6) : d >= 1 && d <= 4));
    setNormen((n) => [...n.filter((x) => !naar.includes(x.weekdag)), ...naar.flatMap((d) => bron.map((b) => ({ ...b, weekdag: d })))]);
  };
  const veld = "rounded-md border border-line px-2 py-1 text-sm tabular-nums";

  return (
    <form action={actie}>
      <input type="hidden" name="normen" value={JSON.stringify(normen.filter((n) => !dicht[n.weekdag]))} />
      <div className="space-y-3">
        {DAGEN.map((d) => {
          const eigen = normen.map((n, i) => ({ n, i })).filter((x) => x.n.weekdag === d);
          const mensen = eigen.reduce((s, x) => s + x.n.aantal, 0);
          return (
            <div key={d} className={cx("rounded-xl border p-3", dicht[d] ? "border-line bg-slate-50" : "border-line bg-white")}>
              <div className="flex flex-wrap items-center gap-3">
                <div className="w-24 font-semibold">{DAGNAAM[d]}</div>
                <label className="flex items-center gap-1.5 text-[13px]"><input type="checkbox" name={`dicht-${d}`} checked={dicht[d]} onChange={(e) => setDicht((x) => ({ ...x, [d]: e.target.checked }))} /> Gesloten</label>
                {!dicht[d] && <>
                  <span className="text-[13px] text-muted">open</span>
                  <input name={`open-${d}`} type="time" defaultValue={opening[d]?.open ?? "11:00"} className={veld} />
                  <span className="text-[13px] text-muted">tot</span>
                  <input name={`sluit-${d}`} type="time" defaultValue={opening[d]?.sluit ?? "21:00"} className={veld} />
                  <span className="ml-auto text-[12px] text-muted">{eigen.length} regel{eigen.length === 1 ? "" : "s"} · {mensen} {mensen === 1 ? "persoon" : "personen"}</span>
                  {eigen.length > 0 && <button type="button" onClick={() => kopieer(d)} title={d === 0 || d === 6 ? "Kopieer naar het andere weekenddag-/vrijdagpatroon" : "Kopieer naar maandag t/m donderdag"} className="inline-flex items-center gap-1 text-[12px] font-semibold text-navy-600"><Copy size={13} /> {d === 6 ? "naar vrijdag" : d === 0 ? "naar zaterdag" : "naar ma–do"}</button>}
                </>}
              </div>
              {!dicht[d] && (
                <div className="mt-2 space-y-1.5 pl-0 md:pl-24">
                  {eigen.map(({ n, i }) => (
                    <div key={i} className="flex flex-wrap items-center gap-2">
                      <select value={n.positieId} onChange={(e) => zet(i, { positieId: e.target.value })} className={veld}>
                        {posities.map((p) => <option key={p.id} value={p.id}>{p.naam}</option>)}
                      </select>
                      <input type="number" min={1} max={20} value={n.aantal} onChange={(e) => zet(i, { aantal: Number(e.target.value) })} className={cx(veld, "w-16")} />
                      <span className="text-[13px] text-muted">× van</span>
                      <input type="time" value={n.van} onChange={(e) => zet(i, { van: e.target.value })} className={veld} />
                      <span className="text-[13px] text-muted">tot</span>
                      <input type="time" value={n.tot} onChange={(e) => zet(i, { tot: e.target.value })} className={veld} />
                      <button type="button" onClick={() => setNormen((x) => x.filter((_, j) => j !== i))} className="text-slate-400 hover:text-brand-600"><Trash2 size={15} /></button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setNormen((x) => [...x, { weekdag: d, positieId: posities[0]?.id ?? "", aantal: 1, van: opening[d]?.open ?? "11:00", tot: "17:00" }])}
                    className="inline-flex items-center gap-1 text-[13px] font-semibold text-navy-600"><Plus size={14} /> Positie toevoegen</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button disabled={bezig} className="rounded-lg bg-navy-700 px-6 py-2 text-sm font-semibold text-white disabled:opacity-60">Opslaan</button>
        {res?.ok && <span className="text-sm text-emerald-700">Opgeslagen. Nieuwe suggesties gebruiken deze bezetting.</span>}
        {res?.fout && <span className="text-sm text-brand-700">{res.fout}</span>}
      </div>
    </form>
  );
}
