"use client";

import { useActionState, useMemo, useState } from "react";
import { AlertTriangle, Camera, Check, X } from "lucide-react";
import { slaChecklistOp } from "@/lib/acties-betrokkenheid";
import { berekenChecklist, vraagGefaald } from "@/lib/checklist/score";
import type { ChecklistAntwoorden, ChecklistOnderdeel } from "@/lib/db/schema";
import { Knop, cx } from "./ui";

const fmt = (n: number | null) => (n === null ? "–" : n.toFixed(1).replace(".", ","));

export function ChecklistForm({ sjabloonId, vestigingId, onderdelen, evaluatie, bestaand }: {
  sjabloonId: string; vestigingId: string; onderdelen: ChecklistOnderdeel[]; evaluatie: boolean;
  bestaand?: { id: string; antwoorden: ChecklistAntwoorden };
}) {
  const [antw, setAntw] = useState<ChecklistAntwoorden>(bestaand?.antwoorden ?? {});
  const [res, actie, bezig] = useActionState(slaChecklistOp.bind(null, sjabloonId, vestigingId, bestaand?.id ?? null), null);
  const uitslag = useMemo(() => berekenChecklist(onderdelen, antw), [onderdelen, antw]);
  const zet = (id: string, waarde: number | boolean | null) => setAntw((a) => ({ ...a, [id]: { ...a[id], waarde } }));
  const zetOpmerking = (id: string, opmerking: string) => setAntw((a) => ({ ...a, [id]: { waarde: a[id]?.waarde ?? null, opmerking } }));
  const ingevuld = uitslag.onderdelen.reduce((s, o) => s + o.ingevuld, 0);
  const totaal = uitslag.onderdelen.reduce((s, o) => s + o.totaal, 0);

  return (
    <form action={actie}>
      <input type="hidden" name="antwoorden" value={JSON.stringify(antw)} />
      <div className="sticky top-0 z-10 border-b border-line bg-white/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          {evaluatie && uitslag.onderdelen.map((o) => (
            <div key={o.id} className="flex-1 rounded-xl bg-slate-50 py-1 text-center">
              <div className="truncate px-1 text-[10px] font-semibold uppercase text-muted">{o.naam} {o.weging}%</div>
              <div className="font-bold text-navy-800">{fmt(o.cijfer)}</div>
            </div>
          ))}
          <div className={cx("rounded-xl px-3 py-1 text-center", uitslag.knockouts.length ? "bg-brand-600 text-white" : uitslag.cijfer !== null ? "bg-navy-700 text-white" : "bg-slate-100")}>
            <div className="text-[10px] font-semibold uppercase opacity-80">{evaluatie ? "Cijfer" : "Klaar"}</div>
            <div className="font-bold">{evaluatie ? fmt(uitslag.cijfer) : `${ingevuld}/${totaal}`}</div>
          </div>
        </div>
        {uitslag.knockouts.length > 0 && <div className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-brand-700"><AlertTriangle size={14} /> Knock-out: direct actie nodig. Cijfer maximaal 5,4.</div>}
      </div>

      {onderdelen.map((o) => (
        <section key={o.id} className="px-4 pt-5">
          <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{o.naam}{evaluatie ? ` · weging ${o.weging}%` : ""}</h2>
          <div className="space-y-2">
            {o.vragen.map((v) => {
              const w = antw[v.id]?.waarde;
              const fout = vraagGefaald(v, w);
              return (
                <div key={v.id} className={cx("rounded-2xl border bg-white p-3.5", fout ? "border-brand-600" : "border-line")}>
                  <div className="mb-2 flex items-start gap-2 text-[15px] font-semibold">
                    <span className="flex-1">{v.tekst}{v.max !== undefined && <span className="font-normal text-muted"> (max {v.max} {v.eenheid})</span>}</span>
                    {v.knockout && <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold uppercase text-brand-700">knock-out</span>}
                  </div>
                  {v.type === "ja-nee" && (
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => zet(v.id, true)} className={cx("tap flex items-center justify-center gap-1.5 rounded-xl border font-semibold", w === true ? "border-emerald-600 bg-emerald-600 text-white" : "border-line")}><Check size={17} /> Ja</button>
                      <button type="button" onClick={() => zet(v.id, false)} className={cx("tap flex items-center justify-center gap-1.5 rounded-xl border font-semibold", w === false ? "border-brand-600 bg-brand-600 text-white" : "border-line")}><X size={17} /> Nee</button>
                    </div>
                  )}
                  {v.type === "score" && (
                    <div className="grid grid-cols-5 gap-1.5">
                      {[1, 2, 3, 4, 5].map((n) => <button type="button" key={n} onClick={() => zet(v.id, n)} className={cx("tap rounded-xl border text-[15px] font-bold", w === n ? "border-navy-700 bg-navy-700 text-white" : "border-line")}>{n}</button>)}
                    </div>
                  )}
                  {v.type === "meting" && (
                    <div className="flex items-center gap-2">
                      <input type="number" inputMode="decimal" step="0.1" value={typeof w === "number" ? w : ""} onChange={(e) => zet(v.id, e.target.value === "" ? null : Number(e.target.value))}
                        className={cx("tap w-28 rounded-xl border px-3 text-[17px] font-semibold outline-none", fout ? "border-brand-600 text-brand-700" : "border-line focus:border-navy-500")} />
                      <span className="text-muted">{v.eenheid}</span>
                    </div>
                  )}
                  {(fout || antw[v.id]?.opmerking) && (
                    <div className="mt-2 flex gap-2">
                      <input value={antw[v.id]?.opmerking ?? ""} onChange={(e) => zetOpmerking(v.id, e.target.value)} placeholder="Wat is er aan de hand?" className="tap min-w-0 flex-1 rounded-xl border border-line px-3 text-[14px]" />
                      <label className="tap grid w-11 cursor-pointer place-items-center rounded-xl border border-line text-navy-700"><Camera size={18} /><input type="file" accept="image/*" capture="environment" className="sr-only" /></label>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <div className="space-y-2 px-4 pt-5">
        {res?.fout && <p className="text-sm text-brand-700">{res.fout}</p>}
        <div className="grid grid-cols-2 gap-2">
          <Knop variant="licht" name="stap" value="opslaan" disabled={bezig}>Tussendoor opslaan</Knop>
          <Knop name="stap" value="afronden" disabled={bezig || !uitslag.compleet}>Afronden</Knop>
        </div>
        {res?.id && !res.fout && <p className="text-center text-[13px] text-emerald-700">Opgeslagen.</p>}
      </div>
    </form>
  );
}
