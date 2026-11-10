"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { ChecklistOnderdeel, ChecklistVraag } from "@/lib/db/schema";
import { ActieForm } from "./actie-form";
import { cx } from "./ui";

type Res = { fout?: string; ok?: boolean; info?: string } | null | undefined;
const ROLLEN = [["medewerker", "Medewerker"], ["shiftleider", "Shiftleider"], ["manager", "Manager"], ["franchisenemer", "Franchisenemer"], ["hq", "HQ"]] as const;
const veld = "rounded-md border border-line px-2 py-1 text-sm";

/** Vragenlijst van een checklist of evaluatie bewerken: onderdelen met weging, vragen met soort, knock-out en norm. */
export function SjabloonEditor({ actie, begin, alleenLezen }: {
  alleenLezen?: boolean;
  actie: (v: Res, fd: FormData) => Promise<Res>;
  begin?: { titel: string; omschrijving: string; soort: "dagtaak" | "evaluatie"; rollen: string[]; onderdelen: ChecklistOnderdeel[]; actief: boolean };
}) {
  const [soort, setSoort] = useState(begin?.soort ?? "dagtaak");
  const [ond, setOnd] = useState<ChecklistOnderdeel[]>(begin?.onderdelen ?? [{ id: "", naam: "Algemeen", weging: 100, vragen: [{ id: "", tekst: "", type: "ja-nee" }] }]);
  const zetO = (i: number, p: Partial<ChecklistOnderdeel>) => setOnd((o) => o.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const zetV = (i: number, k: number, p: Partial<ChecklistVraag>) => zetO(i, { vragen: ond[i].vragen.map((v, j) => (j === k ? { ...v, ...p } : v)) });
  const som = ond.reduce((s, o) => s + Number(o.weging || 0), 0);
  return (
    <ActieForm actie={actie} knop={alleenLezen ? "Alleen bekijken" : begin ? "Opslaan als nieuwe versie" : "Checklist toevoegen"}>
      <input type="hidden" name="onderdelen" value={JSON.stringify(ond)} />
      <div className="grid gap-2 md:grid-cols-[1fr_160px]">
        <input name="titel" defaultValue={begin?.titel} placeholder="Titel, bijv. Openen" className={veld} />
        <select name="soort" value={soort} onChange={(e) => setSoort(e.target.value as "dagtaak" | "evaluatie")} className={veld}><option value="dagtaak">Dagtaak</option><option value="evaluatie">Evaluatie (met cijfer)</option></select>
      </div>
      <input name="omschrijving" defaultValue={begin?.omschrijving} placeholder="Wanneer en door wie?" className={cx(veld, "w-full")} />
      <div className="flex flex-wrap items-center gap-3 text-sm"><span className="text-muted">Wie mag hem invullen:</span>
        {ROLLEN.map(([r, l]) => <label key={r} className="flex items-center gap-1"><input type="checkbox" name="rol" value={r} defaultChecked={begin ? begin.rollen.includes(r) : r !== "medewerker"} /> {l}</label>)}
        {begin && <label className="ml-auto flex items-center gap-1"><input type="checkbox" name="actief" defaultChecked={begin.actief} /> Actief</label>}
      </div>
      <div className="space-y-3">
        {ond.map((o, i) => (
          <div key={i} className="rounded-xl border border-line p-3">
            <div className="mb-2 flex items-center gap-2">
              <input value={o.naam} onChange={(e) => zetO(i, { naam: e.target.value })} placeholder="Onderdeel" className={cx(veld, "flex-1 font-semibold")} />
              {soort === "evaluatie" && <><input type="number" value={o.weging} onChange={(e) => zetO(i, { weging: Number(e.target.value) })} className={cx(veld, "w-16")} /><span className="text-sm text-muted">%</span></>}
              {ond.length > 1 && <button type="button" onClick={() => setOnd((x) => x.filter((_, j) => j !== i))} className="text-slate-400 hover:text-brand-600"><Trash2 size={15} /></button>}
            </div>
            <div className="space-y-1.5">
              {o.vragen.map((v, k) => (
                <div key={k} className="flex flex-wrap items-center gap-1.5">
                  <input value={v.tekst} onChange={(e) => zetV(i, k, { tekst: e.target.value })} placeholder="Vraag" className={cx(veld, "min-w-60 flex-1")} />
                  <select value={v.type} onChange={(e) => zetV(i, k, { type: e.target.value as ChecklistVraag["type"] })} className={veld}><option value="ja-nee">Ja/Nee</option><option value="score">Score 1–5</option><option value="meting">Meting</option></select>
                  {v.type === "meting" && <><input value={v.max ?? ""} onChange={(e) => zetV(i, k, { max: e.target.value === "" ? undefined : Number(e.target.value) })} placeholder="max" className={cx(veld, "w-16")} /><input value={v.eenheid ?? ""} onChange={(e) => zetV(i, k, { eenheid: e.target.value })} placeholder="°C" className={cx(veld, "w-14")} /></>}
                  <label className="flex items-center gap-1 text-[12px]"><input type="checkbox" checked={!!v.knockout} onChange={(e) => zetV(i, k, { knockout: e.target.checked })} /> knock-out</label>
                  <button type="button" onClick={() => zetO(i, { vragen: o.vragen.filter((_, j) => j !== k) })} className="text-slate-300 hover:text-brand-600"><Trash2 size={14} /></button>
                </div>
              ))}
              <button type="button" onClick={() => zetO(i, { vragen: [...o.vragen, { id: "", tekst: "", type: "ja-nee" }] })} className="inline-flex items-center gap-1 text-[13px] font-semibold text-navy-600"><Plus size={13} /> Vraag</button>
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => setOnd((x) => [...x, { id: "", naam: "", weging: 0, vragen: [{ id: "", tekst: "", type: "ja-nee" }] }])} className="inline-flex items-center gap-1 text-[13px] font-semibold text-navy-600"><Plus size={13} /> Onderdeel</button>
          {soort === "evaluatie" && <span className={cx("text-[13px] font-semibold", som === 100 ? "text-emerald-700" : "text-brand-700")}>Weging totaal {som}%</span>}
        </div>
      </div>
    </ActieForm>
  );
}
