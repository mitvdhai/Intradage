"use client";

import { cx } from "./ui";

/** Kies het behaalde niveau (1..4) voor één profielonderdeel. */
export function NiveauKiezer({
  naam, niveaus, vereist, waarde, zelf, onChange, uitgeschakeld,
}: {
  naam: string; niveaus: string[]; vereist: number; waarde?: number; zelf?: number; onChange?: (n: number) => void; uitgeschakeld?: boolean;
}) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {niveaus.map((tekst, i) => {
        const n = i + 1;
        return (
          <label key={n} title={tekst}
            className={cx(
              "relative flex cursor-pointer flex-col items-center rounded-xl border px-1 py-2 text-center has-[:checked]:border-navy-700 has-[:checked]:bg-navy-700 has-[:checked]:text-white",
              n === vereist ? "border-brand-600" : "border-line",
              uitgeschakeld && "pointer-events-none opacity-60",
            )}>
            <input type="radio" name={naam} value={n} defaultChecked={waarde === n} onChange={() => onChange?.(n)} className="sr-only" disabled={uitgeschakeld} />
            <span className="text-base font-bold">{n}</span>
            <span className="text-[10px] leading-tight opacity-80">{n === vereist ? "vereist" : n < vereist ? "onder" : "boven"}</span>
            {zelf === n && <span className="absolute -top-1.5 right-1 rounded-full bg-brand-600 px-1 text-[9px] font-bold text-white">zelf</span>}
          </label>
        );
      })}
    </div>
  );
}
