"use client";

import { useActionState, useState, useTransition } from "react";
import { Loader2, Sparkles, Trash2 } from "lucide-react";
import { maakRoosterSuggestie, verwijderDienst, voegDienstToe, wijsDienstToe } from "@/lib/personeel/acties";
import { cx } from "./ui";

export interface Optie { id: string; naam: string; ok: boolean; reden?: string; uren: number }

/** Kaartje van één dienst in het weekrooster, met wie hem doet. */
export function DienstKaart({ id, tijd, gebruikerId, opties, concept, kleur, verleden }: {
  id: string; tijd: string; gebruikerId: string | null; opties: Optie[]; concept: boolean; kleur: string; verleden: boolean;
}) {
  const [fout, setFout] = useState<string>();
  const [bezig, start] = useTransition();
  const huidig = opties.find((o) => o.id === gebruikerId);
  return (
    <div className={cx("rounded-lg border bg-white px-2 py-1.5 text-[12px]", concept ? "border-dashed" : "border-solid", !gebruikerId ? "border-brand-600 bg-brand-50" : "border-line")} style={{ borderLeft: `3px solid ${kleur}` }}>
      <div className="flex items-center justify-between gap-1">
        <span className="font-semibold tabular-nums">{tijd}</span>
        {!verleden && <button type="button" title="Dienst verwijderen" onClick={() => start(() => verwijderDienst(id))} className="text-slate-300 hover:text-brand-600"><Trash2 size={12} /></button>}
      </div>
      {verleden ? <div className={cx("truncate", !gebruikerId && "font-semibold text-brand-700")}>{huidig?.naam ?? (gebruikerId ? "—" : "Open")}</div> : (
        <select value={gebruikerId ?? ""} disabled={bezig} onChange={(e) => {
          const nieuw = e.target.value || null;
          setFout(undefined);
          start(async () => { const r = await wijsDienstToe(id, nieuw); if (r?.fout) setFout(r.fout); });
        }} className={cx("mt-0.5 w-full truncate rounded border-0 bg-transparent p-0 text-[12px] focus:ring-1", !gebruikerId && "font-semibold text-brand-700")}>
          <option value="">Open dienst</option>
          {opties.filter((o) => o.ok || o.id === gebruikerId).map((o) => <option key={o.id} value={o.id}>{o.naam} · {o.uren.toFixed(0)}u</option>)}
          {opties.some((o) => !o.ok && o.id !== gebruikerId) && <optgroup label="Kan niet">
            {opties.filter((o) => !o.ok && o.id !== gebruikerId).map((o) => <option key={o.id} value={o.id} disabled>{o.naam} · {o.reden}</option>)}
          </optgroup>}
        </select>
      )}
      {bezig && <Loader2 size={11} className="animate-spin text-muted" />}
      {fout && <div className="mt-1 text-[11px] leading-tight text-brand-700">{fout}</div>}
    </div>
  );
}

export function SuggestieKnop({ vestigingId, maandag, heeftConcept }: { vestigingId: string; maandag: string; heeftConcept: boolean }) {
  const [res, actie, bezig] = useActionState(async () => maakRoosterSuggestie(vestigingId, maandag), null);
  return (
    <form action={actie} className="flex items-center gap-2">
      {res?.info && <span className="text-[13px] text-emerald-700">{res.info}</span>}
      {res?.fout && <span className="text-[13px] text-brand-700">{res.fout}</span>}
      <button disabled={bezig} title={heeftConcept ? "Vervangt de eerdere suggestie; handmatige en gepubliceerde diensten blijven staan" : undefined}
        className="inline-flex items-center gap-2 rounded-lg bg-navy-700 px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {bezig ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} {heeftConcept ? "Opnieuw voorstellen" : "Rooster voorstellen"}
      </button>
    </form>
  );
}

export function NieuweDienst({ vestigingId, dagen, posities, mensen }: { vestigingId: string; dagen: { datum: string; label: string }[]; posities: { id: string; naam: string }[]; mensen: { id: string; naam: string }[] }) {
  const [res, actie, bezig] = useActionState(voegDienstToe.bind(null, vestigingId), null);
  const veld = "rounded-lg border border-line px-2 py-1.5 text-sm";
  return (
    <form action={actie} className="flex flex-wrap items-end gap-2">
      <select name="datum" className={veld}>{dagen.map((d) => <option key={d.datum} value={d.datum}>{d.label}</option>)}</select>
      <select name="positie" className={veld}>{posities.map((p) => <option key={p.id} value={p.id}>{p.naam}</option>)}</select>
      <input name="van" type="time" defaultValue="17:00" className={veld} />
      <input name="tot" type="time" defaultValue="21:00" className={veld} />
      <select name="gebruiker" className={veld}><option value="">Open dienst</option>{mensen.map((m) => <option key={m.id} value={m.id}>{m.naam}</option>)}</select>
      <button disabled={bezig} className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold ring-1 ring-line">Toevoegen</button>
      {res?.fout && <span className="text-[13px] text-brand-700">{res.fout}</span>}
    </form>
  );
}
