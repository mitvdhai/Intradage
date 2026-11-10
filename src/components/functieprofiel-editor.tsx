"use client";

import { useActionState, useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { slaFunctieprofielOp } from "@/lib/acties";
import type { Functie, ProfielCategorie, ProfielItem } from "@/lib/types";
import { cx } from "./ui";

const LABEL: Record<ProfielCategorie, string> = { competentie: "Competenties", vaardigheid: "Vaardigheden", kennis: "Kennis & skills" };

export function FunctieprofielEditor({ functie, items, magBewerken }: { functie: Functie; items: ProfielItem[]; magBewerken: boolean }) {
  const map = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const [w, setW] = useState<Record<string, number>>(Object.fromEntries(functie.profiel.map((r) => [r.itemId, r.weging])));
  const [res, actie, bezig] = useActionState(slaFunctieprofielOp.bind(null, functie.id), null);
  const totaal = Object.values(w).reduce((s, x) => s + (Number(x) || 0), 0);
  const perCat = (c: ProfielCategorie) => functie.profiel.filter((r) => map.get(r.itemId)?.categorie === c).reduce((s, r) => s + (Number(w[r.itemId]) || 0), 0);

  return (
    <form action={actie}>
      <div className="mb-4 grid grid-cols-4 gap-3">
        {(["competentie", "vaardigheid", "kennis"] as const).map((c) => (
          <div key={c} className="rounded-xl bg-slate-50 px-4 py-3"><div className="text-[12px] text-muted">{LABEL[c]}</div><div className="text-xl font-bold text-navy-800">{perCat(c)}%</div></div>
        ))}
        <div className={cx("rounded-xl px-4 py-3", totaal === 100 ? "bg-navy-700 text-white" : "bg-brand-50 text-brand-700")}>
          <div className="text-[12px] opacity-80">Totaal</div><div className="text-xl font-bold">{totaal}%</div>
        </div>
      </div>
      <table className="w-full text-left text-sm">
        <thead><tr className="border-b border-line text-[11px] uppercase tracking-wider text-muted">
          <th className="px-2 py-2">Onderdeel</th><th className="px-2 py-2">Categorie</th><th className="px-2 py-2">Vereist niveau</th><th className="px-2 py-2">Weging</th>
        </tr></thead>
        <tbody className="divide-y divide-line">
          {functie.profiel.map((r) => {
            const it = map.get(r.itemId)!;
            return (
              <tr key={r.itemId}>
                <td className="px-2 py-2"><div className="font-medium">{it.naam}{r.voorwaarde && <span className="ml-1.5 text-[11px] font-semibold text-brand-600">voorwaarde</span>}</div><div className="text-[12px] text-muted">{it.niveaus[r.vereistNiveau - 1]}</div></td>
                <td className="px-2 py-2 text-muted">{LABEL[it.categorie]}</td>
                <td className="px-2 py-2">
                  <select name={`r-${r.itemId}`} defaultValue={r.vereistNiveau} disabled={!magBewerken} className="rounded-lg border border-line bg-white px-2 py-1">
                    {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </td>
                <td className="px-2 py-2">
                  <div className="flex items-center gap-1">
                    <input name={`w-${r.itemId}`} type="number" min={1} max={100} value={w[r.itemId]} disabled={!magBewerken}
                      onChange={(e) => setW((s) => ({ ...s, [r.itemId]: Number(e.target.value) }))} className="w-16 rounded-lg border border-line px-2 py-1 text-right" />%
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {magBewerken && (
        <div className="mt-4 flex items-center gap-3">
          <button disabled={bezig || totaal !== 100} className="rounded-xl bg-navy-700 px-5 py-2.5 font-semibold text-white disabled:opacity-50">Opslaan</button>
          {totaal !== 100 && <span className="text-sm text-brand-700">De wegingen moeten samen 100% zijn.</span>}
          {res?.fout && <span className="text-sm text-brand-700">{res.fout}</span>}
          {res?.ok && <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700"><CheckCircle2 size={16} /> Opgeslagen. Lopende beoordelingen rekenen direct met de nieuwe weging.</span>}
        </div>
      )}
    </form>
  );
}
