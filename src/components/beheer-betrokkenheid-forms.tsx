"use client";

import { useActionState, useRef, useState } from "react";
import { maakEnquete, maakEvenement } from "@/lib/acties-betrokkenheid";
import { Knop } from "./ui";

const veld = "w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy-500";

export function NieuweEnquete() {
  const [type, setType] = useState<"pulse" | "enps" | "poll">("pulse");
  const form = useRef<HTMLFormElement>(null);
  const [res, actie, bezig] = useActionState(async (v: { fout?: string; ok?: boolean } | null, fd: FormData) => {
    const r = await maakEnquete(v, fd);
    if (r.ok) form.current?.reset();
    return r;
  }, null);
  const voorbeeld = { pulse: "Hoe voelde je je deze week op het werk?", enps: "Hoe waarschijnlijk is het dat je Bram Ladage aanbeveelt als werkgever?", poll: "Welke smaak moet de nieuwe saus worden?" }[type];
  return (
    <form ref={form} action={actie} className="space-y-3">
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1 text-sm font-semibold">
        {(["pulse", "enps", "poll"] as const).map((x) => (
          <button type="button" key={x} onClick={() => setType(x)} className={`rounded-md py-1.5 ${type === x ? "bg-white text-navy-800 shadow-sm" : "text-muted"}`}>{x === "pulse" ? "Pulse" : x === "enps" ? "eNPS" : "Poll"}</button>
        ))}
      </div>
      <input type="hidden" name="type" value={type} />
      <input name="titel" required placeholder="Titel, bijv. Pulse week 46" className={veld} />
      <input name="vraag" required placeholder={voorbeeld} className={veld} />
      {type === "poll" && <textarea name="opties" rows={3} placeholder={"Een optie per regel\nKnoflook\nSambal"} className={veld} />}
      <div className="flex items-center gap-2 text-sm text-muted">Loopt <input name="dagen" type="number" min={1} max={60} defaultValue={7} className="w-16 rounded-lg border border-line px-2 py-1.5" /> dagen · {type === "poll" ? "niet anoniem" : "anoniem, drempel 5"}</div>
      {res?.fout && <p className="text-sm text-brand-700">{res.fout}</p>}
      {res?.ok && <p className="text-sm text-emerald-700">Verstuurd. Staat bij iedereen in Te doen.</p>}
      <Knop variant="navy" disabled={bezig}>Versturen</Knop>
    </form>
  );
}

export function NieuwEvenement() {
  const form = useRef<HTMLFormElement>(null);
  const [res, actie, bezig] = useActionState(async (v: { fout?: string; ok?: boolean } | null, fd: FormData) => {
    const r = await maakEvenement(v, fd);
    if (r.ok) form.current?.reset();
    return r;
  }, null);
  return (
    <form ref={form} action={actie} className="space-y-3">
      <input name="titel" required placeholder="Titel, bijv. Teamuitje Rotterdam" className={veld} />
      <div className="grid grid-cols-[1fr_90px] gap-2">
        <input name="start" type="datetime-local" required className={veld} />
        <input name="duur" type="number" min={0} max={24} defaultValue={2} title="Duur in uren" className={veld} />
      </div>
      <input name="locatie" placeholder="Locatie" className={veld} />
      <textarea name="omschrijving" rows={2} placeholder="Wat gaan we doen?" className={veld} />
      {res?.fout && <p className="text-sm text-brand-700">{res.fout}</p>}
      {res?.ok && <p className="text-sm text-emerald-700">Evenement aangemaakt.</p>}
      <Knop variant="navy" disabled={bezig}>Aanmaken</Knop>
    </form>
  );
}
