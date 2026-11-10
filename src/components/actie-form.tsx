"use client";

import { useActionState, useRef, useState, type ReactNode } from "react";
import { Eraser } from "lucide-react";
import { cx } from "./ui";

type Res = { fout?: string; ok?: boolean; info?: string } | null | undefined;

/** Formulier rond een server action, met foutmelding en bevestiging. */
export function ActieForm({ actie, children, knop, className, variant = "navy", succes = "Opgeslagen.", reset }: {
  actie: (vorige: Res, fd: FormData) => Promise<Res>; children: ReactNode; knop: string; className?: string; variant?: "navy" | "rood" | "licht"; succes?: string; reset?: boolean;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [res, run, bezig] = useActionState(async (v: Res, fd: FormData) => {
    const r = await actie(v, fd);
    if (r?.ok && reset) ref.current?.reset();
    return r;
  }, null);
  const kleur = variant === "rood" ? "bg-brand-600 text-white" : variant === "navy" ? "bg-navy-700 text-white" : "bg-white ring-1 ring-line";
  return (
    <form ref={ref} action={run} className={cx("space-y-3", className)}>
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={bezig || knop === "Alleen bekijken"} className={cx("rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60", kleur)}>{bezig ? "Bezig…" : knop}</button>
        {res?.fout && <span className="text-sm text-brand-700">{res.fout}</span>}
        {res?.ok && <span className="text-sm text-emerald-700">{res.info ?? succes}</span>}
      </div>
    </form>
  );
}

/** Handtekening zetten met vinger of muis. Slaat een SVG-pad op (geen afbeelding), in een verborgen veld. */
export function Handtekening({ name = "handtekening", label = "Zet hier je handtekening" }: { name?: string; label?: string }) {
  const [pad, setPad] = useState("");
  const tekenen = useRef(false);
  const svg = useRef<SVGSVGElement>(null);
  const punt = (e: React.PointerEvent) => {
    const r = svg.current!.getBoundingClientRect();
    return `${Math.round(((e.clientX - r.left) / r.width) * 300)} ${Math.round(((e.clientY - r.top) / r.height) * 100)}`;
  };
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[13px] text-muted">
        <span>{label}</span>
        {pad && <button type="button" onClick={() => setPad("")} className="inline-flex items-center gap-1 font-semibold text-navy-600"><Eraser size={13} /> Opnieuw</button>}
      </div>
      <svg ref={svg} viewBox="0 0 300 100" className="h-28 w-full touch-none rounded-xl border-2 border-dashed border-line bg-white"
        onPointerDown={(e) => { tekenen.current = true; (e.target as Element).setPointerCapture?.(e.pointerId); setPad((p) => `${p} M ${punt(e)}`); }}
        onPointerMove={(e) => { if (tekenen.current) setPad((p) => `${p} L ${punt(e)}`); }}
        onPointerUp={() => { tekenen.current = false; }} onPointerLeave={() => { tekenen.current = false; }}>
        <line x1="20" y1="80" x2="280" y2="80" stroke="#e3e8f1" strokeWidth="1" />
        <path d={pad} fill="none" stroke="#16336e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <input type="hidden" name={name} value={pad.trim()} />
    </div>
  );
}

/** Een opgeslagen handtekening tonen. */
export function HandtekeningWeergave({ pad, className }: { pad: string; className?: string }) {
  return (
    <svg viewBox="0 0 300 100" className={cx("h-16 w-48", className)}>
      <path d={pad} fill="none" stroke="#16336e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
