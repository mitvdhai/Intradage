import type { ReactNode } from "react";

/** Kop voor openbare pagina's (werken bij, preboarding): Bram Ladage-huisstijl, geen app-navigatie. */
export function PubliekeKop({ titel, sub, children }: { titel: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="relative overflow-hidden bg-navy-700 px-6 pb-8 pt-10 text-white">
      <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-brand-600" />
      <div className="relative">
        <div className="mb-5 inline-flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-white font-bold text-brand-600">B</span><span className="font-bold">Werken bij Bram Ladage</span></div>
        <h1 className="text-3xl font-bold leading-tight tracking-tight">{titel}</h1>
        {sub && <p className="mt-1.5 text-navy-100">{sub}</p>}
        {children}
      </div>
    </div>
  );
}
