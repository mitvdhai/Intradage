import type { VraagResultaat } from "@/lib/betrokkenheid";

export function EnqueteResultaat({ vragen, aantal, teWeinig, toonOpen = true }: { vragen: VraagResultaat[]; aantal: number; teWeinig: boolean; toonOpen?: boolean }) {
  if (teWeinig) return <p className="text-[13px] text-muted">{aantal} antwoord{aantal === 1 ? "" : "en"}. Resultaten worden zichtbaar vanaf 5 antwoorden, zodat niemand herleidbaar is.</p>;
  return (
    <div className="space-y-5">
      {vragen.map((v) => (
        <div key={v.vraagId}>
          <div className="mb-2 text-[14px] font-semibold">{v.tekst}</div>
          {v.enps && (
            <div className="mb-3 flex items-center gap-4">
              <div className="rounded-xl bg-navy-700 px-4 py-2 text-white"><div className="text-[11px] uppercase opacity-80">eNPS</div><div className="text-2xl font-bold">{v.enps.score > 0 ? "+" : ""}{v.enps.score}</div></div>
              <div className="text-[13px] text-muted">{v.enps.promotors} promotors · {v.enps.passief} passief · {v.enps.criticasters} criticasters</div>
            </div>
          )}
          {v.gemiddelde !== undefined && !v.enps && <div className="mb-2 text-[13px] text-muted">Gemiddeld <b className="text-ink">{v.gemiddelde.toString().replace(".", ",")}</b></div>}
          {v.verdeling && (() => {
            const max = Math.max(1, ...v.verdeling.map((d) => d.aantal));
            return (
              <div className="space-y-1.5">
                {v.verdeling.map((d) => (
                  <div key={d.label} className="flex items-center gap-2 text-[13px]">
                    <span className="w-28 shrink-0 truncate text-muted">{d.label}</span>
                    <div className="h-4 flex-1 rounded bg-slate-100"><div className="h-full rounded bg-navy-600" style={{ width: `${(d.aantal / max) * 100}%` }} /></div>
                    <span className="w-6 text-right font-semibold">{d.aantal}</span>
                  </div>
                ))}
              </div>
            );
          })()}
          {toonOpen && v.open && (v.open.length ? <ul className="space-y-1.5">{v.open.map((o, i) => <li key={i} className="rounded-xl bg-slate-50 px-3 py-2 text-[13px]">“{o}”</li>)}</ul> : <p className="text-[13px] text-muted">Geen open antwoorden.</p>)}
        </div>
      ))}
      <p className="text-[12px] text-muted">{aantal} antwoord{aantal === 1 ? "" : "en"}</p>
    </div>
  );
}
