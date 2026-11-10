"use client";

import { useOptimistic, useState, useTransition } from "react";
import { toggleLike } from "@/lib/acties-betrokkenheid";
import { cx } from "./ui";

/**
 * Het "sausje": ons eigen like. Een hartje gespoten met ketchup uit de knijpfles,
 * in één doorlopende lijn. Leeg = alleen de omtrek; gegeven = ketchup met glans en spatjes.
 */
const LIJN = "M13.3 20.4C9.6 17.3 4.2 13.6 4 9.2 3.9 6.6 5.6 4.9 7.7 4.9c1.9 0 3.3 1.3 4.2 3.2.8-2 2.4-3.4 4.4-3.3 2.2.1 3.8 2 3.6 4.5-.3 4.2-5.1 7.6-8.6 11.2-.3.3-.6.2-.9 0";

export function KetchupHart({ vol, className }: { vol: boolean; className?: string }) {
  const lijn = { d: LIJN, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 24 24" className={cx("h-[21px] w-[21px]", className)} aria-hidden>
      {vol ? (
        <>
          <path {...lijn} stroke="#8f0c12" strokeWidth="3.6" transform="translate(.25 .35)" />
          <path {...lijn} stroke="#d81e1e" strokeWidth="3.3" />
          <path {...lijn} stroke="#fff" strokeOpacity=".55" strokeWidth=".8" strokeDasharray="3 2.2 6 30" transform="translate(-.45 -.5)" />
          <circle cx="19.6" cy="17.6" r=".9" fill="#d81e1e" />
          <circle cx="4.6" cy="18.4" r=".6" fill="#d81e1e" />
        </>
      ) : (
        <path {...lijn} stroke="currentColor" strokeWidth="1.9" />
      )}
    </svg>
  );
}

export function SausjeKnop({ type, id, aantal, gegeven }: { type: "bericht" | "waardering"; id: string; aantal: number; gegeven: boolean }) {
  const [stand, zet] = useOptimistic({ aantal, gegeven }, (s, nieuw: boolean) => ({ gegeven: nieuw, aantal: s.aantal + (nieuw ? 1 : -1) }));
  const [, start] = useTransition();
  const [spat, setSpat] = useState(0);
  return (
    <button type="button" aria-pressed={stand.gegeven} title={stand.gegeven ? "Sausje terugnemen" : "Geef een sausje"}
      onClick={() => {
        const nieuw = !stand.gegeven;
        if (nieuw) setSpat((n) => n + 1);
        start(async () => { zet(nieuw); await toggleLike(type, id); });
      }}
      className={cx("tap inline-flex items-center gap-1.5 rounded-lg px-2 text-[13px] font-semibold", stand.gegeven ? "text-brand-700" : "text-muted")}>
      <span key={spat} className={spat && stand.gegeven ? "sausje-plop" : undefined}><KetchupHart vol={stand.gegeven} /></span>
      {stand.aantal > 0 ? <span>{stand.aantal}</span> : <span>Sausje</span>}
      <span className="sr-only">{stand.gegeven ? " · je gaf een sausje" : " · geef een sausje"}</span>
    </button>
  );
}
