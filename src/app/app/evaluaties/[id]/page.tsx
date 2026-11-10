import { notFound } from "next/navigation";
import { AlertTriangle, Check, ClipboardList } from "lucide-react";
import { ActiepuntForm } from "@/components/actiepunt-form";
import { Kaart, Label, Lijst, PageTop, Rij, Sectie } from "@/components/ui";
import { isHQ, isLeiding } from "@/lib/access";
import { rondActiepuntAf } from "@/lib/acties-betrokkenheid";
import { actiepunten, checklistVestigingen, sjabloon, uitvoering } from "@/lib/betrokkenheid";
import { berekenChecklist, vraagGefaald } from "@/lib/checklist/score";
import { vestigingNaam, voornaamVan } from "@/lib/data";
import { vereisGebruiker } from "@/lib/session";

const fmt = (n: number | null) => (n === null ? "–" : n.toFixed(1).replace(".", ","));

export default async function EvaluatieDetail({ params }: PageProps<"/app/evaluaties/[id]">) {
  const { id } = await params;
  const { u, org } = await vereisGebruiker();
  const ui = await uitvoering(id);
  if (!ui || !checklistVestigingen(org, u).includes(ui.vestigingId) || !(isHQ(u) || isLeiding(u) || ui.uitgevoerdDoor === u.id)) notFound();
  const [s, acties] = await Promise.all([sjabloon(ui.sjabloonId), actiepunten({ uitvoeringId: ui.id })]);
  const uitslag = berekenChecklist(s.onderdelen, ui.antwoorden);
  const afwijkingen = s.onderdelen.flatMap((o) => o.vragen.filter((v) => vraagGefaald(v, ui.antwoorden[v.id]?.waarde) || (ui.antwoorden[v.id]?.opmerking ?? "")).map((v) => ({ v, a: ui.antwoorden[v.id] })));
  const v = org.vestigingen.find((x) => x.id === ui.vestigingId)!;
  const mensen = org.gebruikers.filter((g) => g.vestigingIds.includes(ui.vestigingId) && g.rol !== "medewerker" || (g.rol === "franchisenemer" && g.franchisenemerId === v.franchisenemerId))
    .map((g) => ({ id: g.id, naam: `${g.voornaam} ${g.achternaam}` }));

  return (
    <>
      <PageTop terug={{ href: "/app/evaluaties", label: "Evaluaties" }} titel={`${s.titel} · ${vestigingNaam(org, ui.vestigingId)}`}
        sub={`${ui.datum.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })} · door ${voornaamVan(org, ui.uitgevoerdDoor)}`} />
      <div className="px-4 pt-4">
        <Kaart className={ui.knockout ? "border-brand-100 bg-brand-50" : "border-navy-100 bg-navy-50"}>
          <div className="flex items-end justify-between">
            <div><div className="text-[12px] font-semibold uppercase tracking-wider text-muted">Eindcijfer</div><div className={`text-4xl font-bold ${ui.knockout ? "text-brand-700" : "text-navy-800"}`}>{fmt(ui.score)}</div></div>
            {ui.knockout && <Label toon="rood-vol"><AlertTriangle size={12} className="mr-1" /> Knock-out</Label>}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {uitslag.onderdelen.map((o) => (
              <div key={o.id} className="rounded-xl bg-white px-2 py-1.5 text-center ring-1 ring-line">
                <div className="truncate text-[10px] font-semibold uppercase text-muted">{o.naam}</div>
                <div className="font-bold text-navy-800">{fmt(o.cijfer)}</div>
                <div className="text-[10px] text-muted">{o.weging}%</div>
              </div>
            ))}
          </div>
        </Kaart>
      </div>
      {afwijkingen.length > 0 && (
        <Sectie titel="Afwijkingen en opmerkingen">
          <Lijst>
            {afwijkingen.map(({ v: q, a }) => <Rij key={q.id} toon={q.knockout ? "rood" : "navy"} icoon={<AlertTriangle size={18} />} titel={q.tekst} sub={`${a?.waarde === false ? "Nee" : a?.waarde ?? "–"}${q.eenheid ? ` ${q.eenheid}` : ""}${a?.opmerking ? ` · ${a.opmerking}` : ""}`} />)}
          </Lijst>
        </Sectie>
      )}
      <Sectie titel="Actiepunten">
        <div className="space-y-3">
          {acties.length > 0 && (
            <Lijst>
              {acties.map((ap) => (
                <Rij key={ap.id} toon={ap.status === "klaar" ? "groen" : ap.deadline < new Date().toISOString().slice(0, 10) ? "rood" : "navy"} icoon={ap.status === "klaar" ? <Check size={18} /> : <ClipboardList size={18} />}
                  titel={ap.tekst} sub={`${voornaamVan(org, ap.eigenaarId)} · voor ${new Date(ap.deadline).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}`}
                  rechts={ap.status === "klaar" ? <Label toon="groen">Klaar</Label> : <form action={rondActiepuntAf.bind(null, ap.id)}><button className="rounded-lg px-2.5 py-1.5 text-[12px] font-semibold ring-1 ring-line">Afronden</button></form>} />
              ))}
            </Lijst>
          )}
          {(isHQ(u) || isLeiding(u)) && <ActiepuntForm uitvoeringId={ui.id} mensen={mensen} />}
        </div>
      </Sectie>
    </>
  );
}
