import { redirect } from "next/navigation";
import { AlertTriangle, ClipboardCheck, Plus } from "lucide-react";
import Link from "next/link";
import { Lijst, PageTop, Rij, Sectie } from "@/components/ui";
import { isHQ, isLeiding } from "@/lib/access";
import { actiepunten, checklistVestigingen, uitvoeringen } from "@/lib/betrokkenheid";
import { vereisGebruiker } from "@/lib/session";

const cijfer = (n: number | null) => (n === null ? "–" : n.toFixed(1).replace(".", ","));

export default async function Evaluaties() {
  const { u, org } = await vereisGebruiker();
  if (!isHQ(u) && !isLeiding(u)) redirect("/app");
  const vest = checklistVestigingen(org, u);
  const [lijst, acties] = await Promise.all([uitvoeringen({ vestigingIds: vest, sjabloonId: "cl-evaluatie" }), actiepunten({ vestigingIds: vest, open: true })]);
  const afgerond = lijst.filter((x) => x.status === "afgerond");

  return (
    <>
      <PageTop terug={{ href: "/app/meer", label: "Meer" }} titel="Vestigingsevaluaties" />
      <div className="px-4 pt-4">
        <Link href="/app/checklist/cl-evaluatie" className="tap flex items-center justify-center gap-2 rounded-xl bg-brand-600 text-[15px] font-semibold text-white"><Plus size={18} /> Nieuwe evaluatie</Link>
      </div>
      <Sectie titel="Per vestiging">
        <Lijst>
          {org.vestigingen.filter((v) => vest.includes(v.id)).map((v) => {
            const eigen = afgerond.filter((x) => x.vestigingId === v.id);
            const [laatste, vorige] = eigen;
            const trend = laatste?.score != null && vorige?.score != null ? laatste.score - vorige.score : null;
            const open = acties.filter((a) => a.vestigingId === v.id).length;
            return (
              <Rij key={v.id} href={laatste ? `/app/evaluaties/${laatste.id}` : undefined} toon={laatste?.knockout || (laatste?.score ?? 10) < 5.5 ? "rood" : "navy"}
                icoon={laatste?.knockout ? <AlertTriangle size={18} /> : <ClipboardCheck size={18} />} titel={`${v.naam} · ${v.plaats}`}
                sub={laatste ? `${laatste.datum.toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}${trend !== null ? ` · ${trend >= 0 ? "▲" : "▼"} ${cijfer(Math.abs(trend))}` : ""}${open ? ` · ${open} open actie${open > 1 ? "s" : ""}` : ""}` : "Nog niet geëvalueerd"}
                rechts={<span className={`rounded-lg px-2.5 py-1 text-[15px] font-bold ${laatste?.knockout || (laatste?.score ?? 10) < 5.5 ? "bg-brand-50 text-brand-700" : "bg-navy-50 text-navy-800"}`}>{cijfer(laatste?.score ?? null)}</span>} />
            );
          })}
        </Lijst>
      </Sectie>
    </>
  );
}
