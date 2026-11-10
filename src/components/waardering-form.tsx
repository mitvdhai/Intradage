"use client";

import { useActionState, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { geefWaardering } from "@/lib/acties-betrokkenheid";
import { Knop, cx } from "./ui";

type Persoon = { id: string; naam: string; sub: string };
type Waarde = { id: string; naam: string; emoji: string; omschrijving: string };

export function WaarderingForm({ mensen, waarden, standaardAan }: { mensen: Persoon[]; waarden: Waarde[]; standaardAan?: string }) {
  const [res, actie, bezig] = useActionState(geefWaardering, null);
  const [zoek, setZoek] = useState("");
  const [aan, setAan] = useState(standaardAan ?? "");
  const [waarde, setWaarde] = useState("");
  const gefilterd = useMemo(() => mensen.filter((m) => m.naam.toLowerCase().includes(zoek.toLowerCase())).slice(0, 8), [mensen, zoek]);
  const gekozen = mensen.find((m) => m.id === aan);

  return (
    <form action={actie} className="space-y-5 px-4 pt-4">
      <input type="hidden" name="aan" value={aan} />
      <input type="hidden" name="waarde" value={waarde} />
      <section>
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">1 · Wie wil je waarderen?</h2>
        {gekozen ? (
          <div className="flex items-center gap-3 rounded-2xl border border-navy-200 bg-navy-50 px-4 py-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-600 font-semibold text-white">{gekozen.naam[0]}</span>
            <div className="flex-1"><div className="font-semibold">{gekozen.naam}</div><div className="text-[13px] text-muted">{gekozen.sub}</div></div>
            <button type="button" onClick={() => setAan("")} className="text-[13px] font-semibold text-navy-600">Wijzig</button>
          </div>
        ) : (
          <div className="rounded-2xl border border-line bg-white">
            <div className="relative border-b border-line">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input value={zoek} onChange={(e) => setZoek(e.target.value)} placeholder="Zoek een collega" className="tap w-full rounded-t-2xl pl-10 pr-3 text-[15px] outline-none" />
            </div>
            <ul className="divide-y divide-line">
              {gefilterd.map((m) => (
                <li key={m.id}><button type="button" onClick={() => setAan(m.id)} className="tap flex w-full items-center gap-3 px-4 py-2 text-left active:bg-slate-50">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-navy-100 text-sm font-semibold text-navy-700">{m.naam[0]}</span>
                  <span><span className="block text-[15px] font-medium">{m.naam}</span><span className="block text-[12px] text-muted">{m.sub}</span></span>
                </button></li>
              ))}
            </ul>
          </div>
        )}
      </section>
      <section>
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">2 · Bij welke waarde past het?</h2>
        <div className="grid grid-cols-2 gap-2">
          {waarden.map((w) => (
            <button type="button" key={w.id} onClick={() => setWaarde(w.id)}
              className={cx("rounded-2xl border p-3 text-left", waarde === w.id ? "border-brand-600 bg-brand-50" : "border-line bg-white")}>
              <div className="text-xl">{w.emoji}</div>
              <div className="font-semibold">{w.naam}</div>
              <div className="text-[12px] leading-snug text-muted">{w.omschrijving}</div>
            </button>
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">3 · Waarvoor?</h2>
        <textarea name="tekst" rows={3} required maxLength={500} placeholder="Bijvoorbeeld: bedankt dat je bijsprong toen het zaterdag zo druk was!"
          className="w-full rounded-2xl border border-line bg-white p-3 text-[15px] outline-none focus:border-navy-500" />
      </section>
      {res?.fout && <p className="text-sm text-brand-700">{res.fout}</p>}
      <Knop disabled={bezig || !aan || !waarde}>Verstuur waardering</Knop>
      <p className="text-center text-[12px] text-muted">Je waardering verschijnt op de tijdlijn van jullie team.</p>
    </form>
  );
}
