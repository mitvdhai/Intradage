"use client";

import { useActionState } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { beantwoordEnquete } from "@/lib/acties-betrokkenheid";
import type { EnqueteVraag } from "@/lib/db/schema";
import { Knop, cx } from "./ui";

export function EnqueteForm({ id, vragen, anoniem, idee }: { id: string; vragen: EnqueteVraag[]; anoniem: boolean; idee: boolean }) {
  const [res, actie, bezig] = useActionState(beantwoordEnquete.bind(null, id), null);
  if (res?.ok) {
    return (
      <div className="mx-4 mt-4 rounded-2xl bg-emerald-50 p-5 text-center text-emerald-800">
        <CheckCircle2 className="mx-auto mb-2" />
        <div className="font-semibold">{idee ? "Bedankt voor je idee!" : "Bedankt voor je antwoord!"}</div>
        <div className="text-[13px]">{idee ? "HQ leest alle ideeën en laat weten wat ermee gebeurt." : anoniem ? "Je antwoord is anoniem opgeslagen." : "Je stem is geteld."}</div>
      </div>
    );
  }
  return (
    <form action={actie} className="space-y-4 px-4 pt-4">
      {vragen.map((q) => (
        <fieldset key={q.id} className="rounded-2xl border border-line bg-white p-4">
          <legend className="sr-only">{q.tekst}</legend>
          <div className="mb-3 font-semibold">{q.tekst}</div>
          {q.type === "keuze" && (
            <div className="space-y-2">
              {q.opties.map((o) => (
                <label key={o} className="tap flex items-center gap-3 rounded-xl border border-line px-3 has-[:checked]:border-navy-600 has-[:checked]:bg-navy-50">
                  <input type="radio" name={q.id} value={o} required className="accent-navy-700" /> {o}
                </label>
              ))}
            </div>
          )}
          {q.type === "schaal" && (
            <div>
              <div className={cx("grid gap-1", q.max - q.min + 1 > 6 ? "grid-cols-11" : "grid-cols-5")}>
                {Array.from({ length: q.max - q.min + 1 }, (_, i) => q.min + i).map((n) => (
                  <label key={n} className="relative">
                    <input type="radio" name={q.id} value={n} required className="peer sr-only" />
                    <span className="grid h-11 cursor-pointer place-items-center rounded-xl border border-line text-[15px] font-semibold peer-checked:border-navy-700 peer-checked:bg-navy-700 peer-checked:text-white">{n}</span>
                  </label>
                ))}
              </div>
              {q.labels && <div className="mt-1.5 flex justify-between text-[12px] text-muted"><span>{q.labels[0]}</span><span>{q.labels[1]}</span></div>}
            </div>
          )}
          {q.type === "open" && <textarea name={q.id} rows={3} required={idee} maxLength={1000} className="w-full rounded-xl border border-line p-3 text-[15px] outline-none focus:border-navy-500" />}
        </fieldset>
      ))}
      {anoniem && <p className="flex items-center gap-2 px-1 text-[12px] text-muted"><ShieldCheck size={16} className="text-navy-600" /> Anoniem: we slaan je antwoord los van je naam op en tonen resultaten pas vanaf 5 antwoorden.</p>}
      {res?.fout && <p className="text-sm text-brand-700">{res.fout}</p>}
      <Knop disabled={bezig}>{idee ? "Idee insturen" : "Versturen"}</Knop>
    </form>
  );
}
