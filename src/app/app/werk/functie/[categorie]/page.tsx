import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, GraduationCap, TrendingUp } from "lucide-react";
import { Niveau, PageTop, Sectie } from "@/components/ui";
import { functieVan, huidigNiveau, leerItemsVoor } from "@/lib/data";
import { CATEGORIEEN, CATEGORIE_LABEL } from "@/lib/functiehuis/score";
import { vereisGebruiker } from "@/lib/session";
import type { ProfielCategorie } from "@/lib/types";

export default async function ProfielCategoriePagina({ params }: PageProps<"/app/werk/functie/[categorie]">) {
  const { categorie } = await params;
  if (!CATEGORIEEN.includes(categorie as ProfielCategorie)) notFound();
  const cat = categorie as ProfielCategorie;
  const { u, org } = await vereisGebruiker();
  const f = functieVan(org, u);
  if (!f) notFound();
  const items = org.itemMap;
  const [niveau, leer] = await Promise.all([huidigNiveau(u.id), leerItemsVoor(u)]);
  const regels = f.profiel.filter((r) => items.get(r.itemId)?.categorie === cat).sort((a, b) => b.weging - a.weging);
  const w = regels.reduce((s, r) => s + r.weging, 0);

  return (
    <>
      <PageTop terug={{ href: "/app/werk/functie", label: "Functie" }} titel={CATEGORIE_LABEL[cat]} sub={`Telt voor ${w}% mee in je beoordeling`} />
      <div className="flex gap-4 bg-white px-5 pb-3 text-[12px] text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-navy-600" /> jouw niveau</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-slate-200 ring-2 ring-brand-600 ring-offset-1" /> vereist</span>
      </div>
      <Sectie>
        <div className="space-y-3">
          {regels.map((r) => {
            const item = items.get(r.itemId)!;
            const h = niveau[r.itemId] ?? 0;
            const ok = h >= r.vereistNiveau;
            const tip = !ok ? leer.find((l) => l.profielItemId === r.itemId) : undefined;
            return (
              <div key={r.itemId} className="rounded-2xl border border-line bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{item.naam}{r.voorwaarde && <span className="ml-1.5 align-middle text-[11px] font-semibold text-brand-600">voorwaarde</span>}</div>
                    <div className="text-[13px] text-muted">{item.omschrijving}</div>
                  </div>
                  <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[13px] font-bold text-navy-800">{r.weging}%</span>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <Niveau huidig={h} vereist={r.vereistNiveau} />
                  {ok ? <span className="inline-flex items-center gap-1 text-[13px] font-medium text-emerald-700"><CheckCircle2 size={15} /> {h > r.vereistNiveau ? "boven niveau" : "op niveau"}</span>
                    : <span className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-700"><TrendingUp size={15} /> nog te ontwikkelen</span>}
                </div>
                <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-[13px]">
                  <span className="font-semibold">Vereist (niveau {r.vereistNiveau}):</span> {item.niveaus[r.vereistNiveau - 1]}
                </div>
                {tip && (
                  <Link href={`/app/leren/${tip.id}`} className="mt-2 flex items-center gap-2 rounded-lg bg-navy-50 px-3 py-2 text-[13px] font-medium text-navy-700">
                    <GraduationCap size={16} /> {tip.titel} ({tip.duurMin} min) helpt je verder
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </Sectie>
    </>
  );
}
