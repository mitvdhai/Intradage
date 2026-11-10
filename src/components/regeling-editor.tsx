"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { slaRegelingOp } from "@/lib/acties";
import type { Beloningsregeling } from "@/lib/types";

export function RegelingEditor({ regeling, magBewerken }: { regeling: Beloningsregeling; magBewerken: boolean }) {
  const [res, actie, bezig] = useActionState(slaRegelingOp, null);
  return (
    <form action={actie}>
      <table className="w-full text-left text-sm">
        <thead><tr className="border-b border-line text-[11px] uppercase tracking-wider text-muted"><th className="px-2 py-2">Uitkomst</th><th className="px-2 py-2">Vanaf gewogen score</th><th className="px-2 py-2">Verhoging</th></tr></thead>
        <tbody className="divide-y divide-line">
          {regeling.banden.map((b) => (
            <tr key={b.uitkomst}>
              <td className="px-2 py-2 font-medium capitalize">{b.uitkomst}</td>
              <td className="px-2 py-2"><input name={`vanaf-${b.uitkomst}`} defaultValue={b.vanaf} disabled={!magBewerken} inputMode="decimal" className="w-20 rounded-lg border border-line px-2 py-1 text-right" /></td>
              <td className="px-2 py-2"><input name={`pct-${b.uitkomst}`} defaultValue={regeling.verhoging[b.uitkomst]} disabled={!magBewerken} inputMode="decimal" className="w-20 rounded-lg border border-line px-2 py-1 text-right" /> %</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-[13px] text-muted">Ontbreekt een voorwaarde (zoals een geldig HACCP-certificaat), dan is de uitkomst maximaal <b className="capitalize">{regeling.maxUitkomstBijOntbrekendeVoorwaarde}</b>.</p>
      {magBewerken && (
        <div className="mt-4 flex items-center gap-3">
          <button disabled={bezig} className="rounded-xl bg-navy-700 px-5 py-2.5 font-semibold text-white">Opslaan</button>
          {res?.fout && <span className="text-sm text-brand-700">{res.fout}</span>}
          {res?.ok && <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700"><CheckCircle2 size={16} /> Opgeslagen</span>}
        </div>
      )}
    </form>
  );
}
