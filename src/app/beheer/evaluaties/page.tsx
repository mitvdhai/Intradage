import { redirect } from "next/navigation";
import Link from "next/link";
import { scopeVestigingen, mag } from "@/lib/access";
import { actiepunten, uitvoeringen } from "@/lib/betrokkenheid";
import { vestigingNaam, voornaamVan } from "@/lib/data";
import { vereisGebruiker } from "@/lib/session";
import { cx } from "@/components/ui";
import { Blok, Kop, Kpi, Tabel } from "../beheer-ui";

const fmt = (n: number | null | undefined) => (n == null ? "–" : n.toFixed(1).replace(".", ","));

function Cijfer({ v, ko }: { v: number | null | undefined; ko?: boolean }) {
  const cls = v == null ? "text-muted" : ko || v < 5.5 ? "bg-brand-50 text-brand-700" : v >= 7.5 ? "bg-emerald-50 text-emerald-700" : "bg-navy-50 text-navy-700";
  return <span className={cx("inline-block min-w-12 rounded-md px-2 py-0.5 text-center font-semibold", cls)}>{fmt(v)}</span>;
}

export default async function BeheerEvaluaties() {
  const { u, org } = await vereisGebruiker();
  if (!mag(org, u, "evaluaties", 1)) redirect("/beheer");
  const scope = scopeVestigingen(org, u);
  const vandaag = new Date(); vandaag.setHours(0, 0, 0, 0);
  const [evals, dag, acties] = await Promise.all([
    uitvoeringen({ vestigingIds: scope, sjabloonId: "cl-evaluatie" }), uitvoeringen({ vestigingIds: scope, soort: "dagtaak", sinds: vandaag }), actiepunten({ vestigingIds: scope, open: true }),
  ]);
  const af = evals.filter((e) => e.status === "afgerond");
  const laatstePer = scope.map((v) => af.filter((e) => e.vestigingId === v));
  const scores = laatstePer.map((l) => l[0]?.score).filter((s): s is number => s != null);
  const gem = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  const nu = new Date().toISOString().slice(0, 10);
  const telaat = acties.filter((a) => a.deadline < nu);

  return (
    <>
      <Kop titel="Evaluaties en taken" sub="Kwaliteit per vestiging, knock-outs en opvolging" />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi waarde={fmt(gem)} label="gemiddeld laatste evaluatie" />
        <Kpi waarde={String(laatstePer.filter((l) => l[0]?.knockout).length)} label="vestigingen met knock-out" toon={laatstePer.some((l) => l[0]?.knockout) ? "rood" : "navy"} />
        <Kpi waarde={String(acties.length)} label={`open actiepunten (${telaat.length} te laat)`} toon={telaat.length ? "rood" : "navy"} />
        <Kpi waarde={`${new Set(dag.filter((d) => d.status === "afgerond").map((d) => d.vestigingId)).size}/${scope.length}`} label="vestigingen met dagtaken vandaag" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Blok titel="Per vestiging">
          <Tabel kop={["Vestiging", "Laatste", "Vorige", "Trend", "Datum", "Open acties", "Dagtaken vandaag"]}>
            {scope.map((v, i) => {
              const [l, p] = laatstePer[i];
              const trend = l?.score != null && p?.score != null ? l.score - p.score : null;
              return (
                <tr key={v}>
                  <td className="px-3 py-2.5 font-medium">{l ? <Link href={`/app/evaluaties/${l.id}`} className="hover:underline">{vestigingNaam(org, v)}</Link> : vestigingNaam(org, v)}</td>
                  <td className="px-3 py-2.5"><Cijfer v={l?.score} ko={l?.knockout} />{l?.knockout && <span className="ml-1 text-[11px] font-bold text-brand-600">KO</span>}</td>
                  <td className="px-3 py-2.5"><Cijfer v={p?.score} ko={p?.knockout} /></td>
                  <td className={cx("px-3 py-2.5 font-semibold", trend == null ? "text-muted" : trend >= 0 ? "text-emerald-700" : "text-brand-700")}>{trend == null ? "–" : `${trend >= 0 ? "▲" : "▼"} ${fmt(Math.abs(trend))}`}</td>
                  <td className="px-3 py-2.5 text-muted">{l ? l.datum.toLocaleDateString("nl-NL", { day: "numeric", month: "short" }) : "–"}</td>
                  <td className="px-3 py-2.5">{acties.filter((a) => a.vestigingId === v).length}</td>
                  <td className="px-3 py-2.5">{dag.filter((d) => d.vestigingId === v && d.status === "afgerond").length}</td>
                </tr>
              );
            })}
          </Tabel>
        </Blok>
        <Blok titel="Open actiepunten">
          {acties.length === 0 ? <p className="text-sm text-muted">Alles opgevolgd.</p> : (
            <div className="divide-y divide-line">
              {acties.map((a) => (
                <div key={a.id} className="py-2.5 text-sm">
                  <div className="font-medium">{a.tekst}</div>
                  <div className={cx("text-[12px]", a.deadline < nu ? "font-semibold text-brand-600" : "text-muted")}>{vestigingNaam(org, a.vestigingId)} · {voornaamVan(org, a.eigenaarId)} · voor {new Date(a.deadline).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}{a.deadline < nu ? " · te laat" : ""}</div>
                </div>
              ))}
            </div>
          )}
        </Blok>
      </div>
    </>
  );
}
