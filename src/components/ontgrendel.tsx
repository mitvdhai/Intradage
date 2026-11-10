"use client";

import { useActionState } from "react";
import { ShieldCheck } from "lucide-react";
import { ontgrendel } from "@/lib/acties";
import { Knop } from "./ui";

export function Ontgrendel({ mobiel }: { mobiel: string }) {
  const [res, actie, bezig] = useActionState(ontgrendel, null);
  return (
    <form action={actie} className="rounded-2xl border border-line bg-white p-4">
      <div className="mb-1 flex items-center gap-2 font-semibold"><ShieldCheck size={18} className="text-navy-700" /> Ben jij het?</div>
      <p className="mb-3 text-[13px] text-muted">Voor loonstroken en je contract vragen we een extra code. We sturen hem naar {mobiel}. <span className="text-navy-700">(Demo-code: 123456)</span></p>
      <input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required placeholder="••••••"
        className="tap mb-3 w-full rounded-xl border border-line px-3 text-center text-2xl tracking-[0.5em] outline-none focus:border-navy-500" />
      {res?.fout && <p className="mb-3 text-sm text-brand-700">{res.fout}</p>}
      <Knop variant="navy" disabled={bezig}>Ontgrendel voor 15 minuten</Knop>
    </form>
  );
}
