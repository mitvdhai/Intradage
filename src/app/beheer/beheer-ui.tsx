import type { ReactNode } from "react";
import { cx } from "@/components/ui";

export function Kop({ titel, sub, rechts }: { titel: string; sub?: string; rechts?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{titel}</h1>
        {sub && <p className="text-sm text-muted">{sub}</p>}
      </div>
      {rechts}
    </div>
  );
}

export function Blok({ titel, children, className, rechts }: { titel?: string; children: ReactNode; className?: string; rechts?: ReactNode }) {
  return (
    <section className={cx("rounded-2xl border border-line bg-white", className)}>
      {titel && <div className="flex items-center justify-between border-b border-line px-5 py-3"><h2 className="font-semibold">{titel}</h2>{rechts}</div>}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Kpi({ waarde, label, toon = "navy" }: { waarde: string; label: string; toon?: "navy" | "rood" }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <div className={cx("text-3xl font-bold tracking-tight", toon === "rood" ? "text-brand-600" : "text-navy-800")}>{waarde}</div>
      <div className="mt-0.5 text-[13px] text-muted">{label}</div>
    </div>
  );
}

export function Tabel({ kop, children }: { kop: ReactNode[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead><tr className="border-b border-line text-[11px] uppercase tracking-wider text-muted">{kop.map((k, i) => <th key={i} className="px-3 py-2 font-semibold">{k}</th>)}</tr></thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

/** Kleur een percentage: hoe lager, hoe roder. */
export function Pct({ v }: { v: number | null }) {
  if (v === null) return <span className="text-muted">–</span>;
  const cls = v >= 85 ? "bg-emerald-50 text-emerald-700" : v >= 65 ? "bg-navy-50 text-navy-700" : "bg-brand-50 text-brand-700";
  return <span className={cx("inline-block min-w-12 rounded-md px-2 py-0.5 text-center font-semibold", cls)}>{v}%</span>;
}
