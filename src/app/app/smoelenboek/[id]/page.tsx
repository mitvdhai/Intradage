import Link from "next/link";
import { notFound } from "next/navigation";
import { Award } from "lucide-react";
import { Kaart, Knop, PageTop, Sectie, tijdLabel } from "@/components/ui";
import { ROL_LABEL } from "@/lib/access";
import { slaOverMijOp } from "@/lib/acties-betrokkenheid";
import { waarderingen, zichtbareMensen } from "@/lib/betrokkenheid";
import { DISCIPLINE_LABEL, functieVan, vestigingNaam, voornaamVan } from "@/lib/data";
import { vereisGebruiker } from "@/lib/session";

export default async function Profiel({ params }: PageProps<"/app/smoelenboek/[id]">) {
  const { id } = await params;
  const { u, org } = await vereisGebruiker();
  const g = zichtbareMensen(org, u).find((x) => x.id === id);
  if (!g) notFound();
  const ik = g.id === u.id;
  const ontvangen = await waarderingen(org, u, { aanId: g.id, limiet: 5 });
  const jaren = new Date().getFullYear() - new Date(g.inDienstSinds).getFullYear();

  return (
    <>
      <PageTop terug={{ href: "/app/smoelenboek", label: "Smoelenboek" }} titel={`${g.voornaam} ${g.achternaam}`} />
      <div className="px-4 pt-4">
        <Kaart className="flex items-center gap-4">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-navy-700 text-2xl font-bold text-white">{g.voornaam[0]}</span>
          <div>
            <div className="font-bold">{g.rol === "hq" ? `HQ ${DISCIPLINE_LABEL[g.discipline ?? "operations"]}` : functieVan(org, g)?.naam ?? ROL_LABEL[g.rol]}</div>
            <div className="text-[13px] text-muted">{g.vestigingIds.map((v) => vestigingNaam(org, v)).join(", ") || "Hoofdkantoor"}</div>
            <div className="text-[13px] text-muted">{jaren >= 1 ? `${jaren} jaar bij Bram Ladage` : "Nieuw bij Bram Ladage"}</div>
          </div>
        </Kaart>
        {g.overMij && !ik && <p className="mt-3 rounded-2xl bg-white px-4 py-3 text-[15px] ring-1 ring-line">“{g.overMij}”</p>}
      </div>

      {ik ? (
        <Sectie titel="Over mij">
          <form action={slaOverMijOp} className="space-y-3">
            <textarea name="overMij" defaultValue={g.overMij} rows={3} maxLength={280} placeholder="Vertel iets over jezelf: hobby's, favoriete snack…" className="w-full rounded-2xl border border-line bg-white p-3 text-[15px] outline-none focus:border-navy-500" />
            <label className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 text-[14px]">
              <input type="checkbox" name="toonVerjaardag" defaultChecked={g.toonVerjaardag} className="h-5 w-5 accent-navy-700" />
              Laat collega&apos;s zien wanneer ik jarig ben
            </label>
            <Knop variant="navy">Opslaan</Knop>
          </form>
        </Sectie>
      ) : (
        <div className="px-4 pt-4"><Link href={`/app/waardering/geven?aan=${g.id}`} className="tap flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 text-[15px] font-semibold text-white"><Award size={18} /> Waardeer {g.voornaam}</Link></div>
      )}

      {ontvangen.length > 0 && (
        <Sectie titel="Ontvangen waardering">
          <div className="space-y-2">
            {ontvangen.map((w) => (
              <div key={w.id} className="rounded-2xl bg-white px-4 py-3 ring-1 ring-line">
                <div className="text-[12px] font-semibold text-brand-700">{w.waarde.emoji} {w.waarde.naam} · van {voornaamVan(org, w.vanId)} · {tijdLabel(w.tijd)}</div>
                <div className="text-[14px]">“{w.tekst}”</div>
              </div>
            ))}
          </div>
        </Sectie>
      )}
    </>
  );
}
