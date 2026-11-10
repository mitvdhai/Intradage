import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

// Bouwstenen voor een rustige app: één lijststijl, één kaartstijl,
// kleur alleen voor betekenis (rood = actie/urgent, blauw = info/structuur).

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function PageTop({ titel, sub, terug, rechts }: { titel: string; sub?: ReactNode; terug?: { href: string; label: string }; rechts?: ReactNode }) {
  return (
    <header className="bg-white px-5 pb-4 pt-4">
      {terug && (
        <Link href={terug.href} className="-ml-1 mb-1 inline-flex items-center gap-0.5 text-sm font-medium text-navy-600">
          <ChevronLeft size={18} /> {terug.label}
        </Link>
      )}
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          {sub && <div className="text-[13px] text-muted">{sub}</div>}
          <h1 className={cx("font-bold tracking-tight text-ink", terug ? "text-xl" : "text-2xl")}>{titel}</h1>
        </div>
        {rechts}
      </div>
    </header>
  );
}

export function Sectie({ titel, rechts, children, className }: { titel?: string; rechts?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("px-4 pt-5", className)}>
      {titel && (
        <div className="mb-2 flex items-baseline justify-between px-1">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{titel}</h2>
          {rechts && <div className="text-xs font-medium text-navy-600">{rechts}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Lijst({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">{children}</div>;
}

type Toon = "navy" | "rood" | "groen" | "grijs";
const TOON: Record<Toon, string> = {
  navy: "bg-navy-50 text-navy-700",
  rood: "bg-brand-50 text-brand-600",
  groen: "bg-emerald-50 text-emerald-700",
  grijs: "bg-slate-100 text-slate-500",
};

export function Rij({
  icoon, titel, sub, href, toon = "navy", rechts, children, onderaan,
}: {
  icoon?: ReactNode; titel: ReactNode; sub?: ReactNode; href?: string; toon?: Toon; rechts?: ReactNode; children?: ReactNode; onderaan?: ReactNode;
}) {
  const inhoud = (
    <div className="tap flex items-center gap-3 px-3.5 py-3">
      {icoon && <div className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-xl", TOON[toon])}>{icoon}</div>}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold text-ink">{titel}</div>
        {sub && <div className="truncate text-[13px] text-muted">{sub}</div>}
        {onderaan}
      </div>
      {rechts ?? (href ? <ChevronRight size={18} className="shrink-0 text-slate-300" /> : null)}
      {children}
    </div>
  );
  return href ? <Link href={href} className="block active:bg-slate-50">{inhoud}</Link> : inhoud;
}

export function Kaart({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-2xl border border-line bg-white p-4", className)}>{children}</div>;
}

export function Voortgang({ pct, rood }: { pct: number; rood?: boolean }) {
  return (
    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
      <div className={cx("h-full rounded-full", rood ? "bg-brand-600" : "bg-navy-600")} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

export function Label({ children, toon = "navy" }: { children: ReactNode; toon?: Toon | "rood-vol" }) {
  const cls = toon === "rood-vol" ? "bg-brand-600 text-white" : TOON[toon];
  return <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold", cls)}>{children}</span>;
}

/** Segmenten bovenaan een scherm (bijv. Rooster | Functie | Documenten). */
export function Segmenten({ items, actief }: { items: { label: string; href: string }[]; actief: string }) {
  return (
    <div className="bg-white px-4 pb-3">
      <div className="flex rounded-xl bg-slate-100 p-1">
        {items.map((i) => (
          <Link key={i.href} href={i.href}
            className={cx("flex-1 rounded-lg py-1.5 text-center text-[13px] font-semibold", i.label === actief ? "bg-navy-700 text-white shadow-sm" : "text-slate-600")}>
            {i.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

/** Niveau 1..4: gevulde blokjes = huidig, rode rand = vereist. */
export function Niveau({ huidig, vereist }: { huidig: number; vereist: number }) {
  return (
    <span className="inline-flex gap-1" aria-label={`Niveau ${huidig} van 4, vereist ${vereist}`}>
      {[1, 2, 3, 4].map((n) => (
        <span key={n} className={cx("h-2.5 w-5 rounded-sm", n <= huidig ? "bg-navy-600" : "bg-slate-200", n === vereist && "ring-2 ring-brand-600 ring-offset-1")} />
      ))}
    </span>
  );
}

export function Knop({ children, variant = "rood", className, ...rest }: { children: ReactNode; variant?: "rood" | "navy" | "licht" } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const v = {
    rood: "bg-brand-600 text-white active:bg-brand-700",
    navy: "bg-navy-700 text-white active:bg-navy-800",
    licht: "border border-line bg-white text-ink active:bg-slate-50",
  }[variant];
  return (
    <button {...rest} className={cx("tap inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-semibold disabled:opacity-50", v, className)}>
      {children}
    </button>
  );
}

export function Leeg({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-line bg-white px-4 py-6 text-center text-sm text-muted">{children}</div>;
}

export const tijdLabel = (iso: string) => {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "zojuist";
  if (diff < 3600) return `${Math.round(diff / 60)} min geleden`;
  if (diff < 86400) return `${Math.round(diff / 3600)} uur geleden`;
  if (diff < 172800) return "gisteren";
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
};

export const dagLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" });
export const uurLabel = (iso: string) => new Date(iso).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
export const euro = (n: number) => `€ ${n.toFixed(2).replace(".", ",")}`;
