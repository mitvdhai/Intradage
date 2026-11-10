"use client";

import { useActionState } from "react";
import { Lock } from "lucide-react";
import { kiesPersona } from "@/lib/acties";
import { Knop, cx } from "./ui";

export function PersonaKiezer({ personas, wachtwoordNodig }: { personas: { id: string; naam: string; rol: string; uitleg: string }[]; wachtwoordNodig: boolean }) {
  const [res, actie, bezig] = useActionState(kiesPersona, null);
  return (
    <form action={actie} className="space-y-4">
      <fieldset className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
        <legend className="sr-only">Kies een persoon</legend>
        {personas.map((p, i) => (
          <label key={p.id} className={cx("tap flex cursor-pointer items-center gap-3 px-4 py-3 has-[:checked]:bg-navy-50")}>
            <input type="radio" name="id" value={p.id} defaultChecked={i === 0} className="peer sr-only" />
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy-100 font-semibold text-navy-700 peer-checked:bg-navy-700 peer-checked:text-white">{p.naam[0]}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{p.naam} · {p.rol}</span>
              <span className="block text-[13px] text-muted">{p.uitleg}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {wachtwoordNodig && (
        <label className="block">
          <span className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold"><Lock size={14} /> Demo-wachtwoord</span>
          <input name="wachtwoord" type="password" required autoComplete="current-password" className="tap w-full rounded-xl border border-line px-3 text-[15px] outline-none focus:border-navy-500" />
        </label>
      )}
      {res?.fout && <p className="text-sm text-brand-700">{res.fout}</p>}
      <Knop disabled={bezig}>{bezig ? "Bezig…" : "Inloggen"}</Knop>
    </form>
  );
}
