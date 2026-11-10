"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { maakActiepunt } from "@/lib/acties-betrokkenheid";
import { Knop } from "./ui";

export function ActiepuntForm({ uitvoeringId, mensen }: { uitvoeringId: string; mensen: { id: string; naam: string }[] }) {
  const [res, actie, bezig] = useActionState(maakActiepunt.bind(null, uitvoeringId), null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (res?.ok) form.current?.reset(); }, [res]);
  const [standaard] = useState(() => new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  return (
    <form ref={form} action={actie} className="space-y-2 rounded-2xl border border-line bg-white p-4">
      <input name="tekst" required placeholder="Wat moet er gebeuren?" className="tap w-full rounded-xl border border-line px-3 text-[15px]" />
      <div className="grid grid-cols-2 gap-2">
        <select name="eigenaar" required className="tap rounded-xl border border-line bg-white px-2 text-[14px]">
          {mensen.map((m) => <option key={m.id} value={m.id}>{m.naam}</option>)}
        </select>
        <input type="date" name="deadline" required defaultValue={standaard} className="tap rounded-xl border border-line px-2 text-[14px]" />
      </div>
      {res?.fout && <p className="text-sm text-brand-700">{res.fout}</p>}
      <Knop variant="navy" disabled={bezig}>Actiepunt toevoegen</Knop>
    </form>
  );
}
