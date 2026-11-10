"use client";

import { useActionState, useState, useTransition } from "react";
import { klokIn, klokUit, neemOpenDienst } from "@/lib/personeel/acties";

export function OpenDienstKnop({ dienstId }: { dienstId: string }) {
  const [fout, setFout] = useState<string>();
  const [bezig, start] = useTransition();
  return (
    <div className="text-right">
      <button disabled={bezig} onClick={() => start(async () => { const r = await neemOpenDienst(dienstId); if (r.fout) setFout(r.fout); })}
        className="rounded-lg bg-brand-600 px-2.5 py-1.5 text-[12px] font-semibold text-white disabled:opacity-60">{bezig ? "…" : "Ik doe ’m"}</button>
      {fout && <div className="mt-1 max-w-40 text-[11px] leading-tight text-brand-700">{fout}</div>}
    </div>
  );
}

export function KlokInKnop({ dienstId }: { dienstId: string | null }) {
  const [bezig, start] = useTransition();
  return (
    <button disabled={bezig} onClick={(e) => { e.preventDefault(); start(() => klokIn(dienstId)); }}
      className="rounded-xl bg-brand-600 px-4 py-2.5 text-[15px] font-semibold text-white disabled:opacity-60">{bezig ? "…" : "Inklokken"}</button>
  );
}

export function UitklokForm({ pauze }: { pauze: number }) {
  const [res, actie, bezig] = useActionState(klokUit, null);
  return (
    <form action={actie} onClick={(e) => e.stopPropagation()} className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-1.5 text-[13px] text-navy-100">Pauze
        <input name="pauze" type="number" min={0} max={120} step={5} defaultValue={pauze} className="w-16 rounded-lg border-0 bg-white/15 px-2 py-1.5 text-white" /> min</label>
      <button disabled={bezig} className="ml-auto rounded-xl bg-white px-4 py-2.5 text-[15px] font-semibold text-navy-800 disabled:opacity-60">{bezig ? "…" : "Uitklokken"}</button>
      {res?.fout && <div className="w-full text-[12px] text-brand-200">{res.fout}</div>}
    </form>
  );
}
