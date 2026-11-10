"use client";

import { useActionState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { beantwoordQuiz } from "@/lib/acties";
import { Knop, cx } from "./ui";

export function Quiz({ itemId, vragen }: { itemId: string; vragen: { vraag: string; opties: string[] }[] }) {
  const [res, actie, bezig] = useActionState(beantwoordQuiz.bind(null, itemId), null);
  const alles = res && res.goed === res.totaal;
  return (
    <form action={actie} className="space-y-4">
      {vragen.map((q, i) => (
        <fieldset key={i} className="rounded-2xl border border-line bg-white p-4">
          <legend className="sr-only">Vraag {i + 1}</legend>
          <div className="mb-2 font-semibold">{i + 1}. {q.vraag}</div>
          <div className="space-y-2">
            {q.opties.map((o, j) => (
              <label key={j} className="tap flex items-center gap-3 rounded-xl border border-line px-3 has-[:checked]:border-navy-600 has-[:checked]:bg-navy-50">
                <input type="radio" name={`q${i}`} value={j} required className="accent-navy-700" /> {o}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      {res && (
        <div className={cx("flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold", alles ? "bg-emerald-50 text-emerald-800" : "bg-brand-50 text-brand-700")}>
          {alles ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
          {alles ? "Alles goed! Afgerond." : `${res.goed} van ${res.totaal} goed. Kijk nog eens in het handboek en probeer het opnieuw.`}
        </div>
      )}
      {!alles && <Knop disabled={bezig}>{bezig ? "Controleren…" : "Controleer antwoorden"}</Knop>}
    </form>
  );
}
