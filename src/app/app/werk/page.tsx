import { redirect } from "next/navigation";
import { CalendarDays, CalendarPlus, CheckCheck, Clock, Hand, Palmtree, Repeat, SlidersHorizontal } from "lucide-react";
import { OpenDienstKnop } from "@/components/werk-acties";
import { WerkSegmenten } from "@/components/werk-segmenten";
import { Label, Lijst, PageTop, Rij, Sectie, dagLabel, uurLabel } from "@/components/ui";
import { biedDienstAan } from "@/lib/acties";
import { ruilverzoeken, vestigingNaam, voornaamVan } from "@/lib/data";
import { bevestigVestigingen, diensten, passendVoor, posities, urenInTeVullen } from "@/lib/personeel/data";
import { vereisGebruiker } from "@/lib/session";
import { staff } from "@/lib/staff/adapter";
import { dagenVanaf } from "@/lib/tijd";
import type { Dienst } from "@/lib/types";

export default async function Rooster({ searchParams }: PageProps<"/app/werk">) {
  const { aanbieden } = await searchParams;
  const kiesModus = aanbieden === "1";
  const { u, org } = await vereisGebruiker();
  if (u.rol === "franchisenemer") redirect("/app/werk/taken");
  const nu = new Date();
  const [mijn, ruilen, alleOpen, pos] = await Promise.all([
    staff.rooster(u, nu, dagenVanaf(21)), ruilverzoeken(),
    diensten({ vestigingIds: u.vestigingIds, van: nu, tot: dagenVanaf(21), status: "gepubliceerd", open: true }), posities(),
  ]);
  const inTeVullen = await urenInTeVullen(u.id);
  const magBevestigen = bevestigVestigingen(org, u).length > 0;
  // Alleen open diensten die bij je passen: positie, beschikbaarheid, verlof en Arbeidstijdenwet
  const open = (await passendVoor(u.id, alleOpen.filter((d) => d.start > nu))).filter((d) => !mijn.some((m) => new Date(m.start).toDateString() === d.start.toDateString()));
  const ruilVan = (d: Dienst) => ruilen.find((r) => r.dienstId === d.id && r.status !== "afgewezen");
  const eindWeek = new Date(nu); eindWeek.setDate(nu.getDate() + (7 - nu.getDay()) % 7); eindWeek.setHours(23, 59);
  const groepen = [
    { titel: "Deze week", lijst: mijn.filter((d) => new Date(d.start) <= eindWeek) },
    { titel: "Hierna", lijst: mijn.filter((d) => new Date(d.start) > eindWeek) },
  ].filter((g) => g.lijst.length);
  const uren = mijn.filter((d) => new Date(d.start) <= eindWeek).reduce((s, d) => s + (new Date(d.eind).getTime() - new Date(d.start).getTime()) / 3600000, 0);

  return (
    <>
      <PageTop titel="Mijn werk" />
      <WerkSegmenten u={u} actief="Rooster" />
      {!mijn.length && <Sectie><div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-muted">Je staat de komende drie weken nog niet ingeroosterd. Klopt je beschikbaarheid?</div></Sectie>}
      {groepen.map((g, gi) => (
        <Sectie key={g.titel} titel={g.titel} rechts={gi === 0 && uren ? <span className="text-muted">{uren.toFixed(1).replace(".", ",")} uur</span> : undefined}>
          <Lijst>
            {g.lijst.map((d, i) => {
              const r = ruilVan(d);
              const eerste = gi === 0 && i === 0;
              return (
                <Rij key={d.id} toon={r ? "rood" : eerste ? "navy" : "grijs"} icoon={r ? <Repeat size={18} /> : <CalendarDays size={18} />}
                  titel={<span className="capitalize">{dagLabel(d.start)}</span>}
                  sub={`${uurLabel(d.start)} – ${uurLabel(d.eind)} · ${d.taak} · ${vestigingNaam(org, d.vestigingId)}`}
                  onderaan={r ? <div className="mt-1 text-[12px] font-medium text-brand-700">
                    {r.status === "open" ? "Aangeboden in de teamchat" : r.status === "wacht-op-akkoord" ? `${voornaamVan(org, r.overgenomenDoor!)} neemt over · wacht op akkoord` : `Overgenomen door ${voornaamVan(org, r.overgenomenDoor!)}`}
                  </div> : undefined}
                  rechts={kiesModus && !r ? (
                    <form action={biedDienstAan.bind(null, d.id)}><button className="rounded-lg bg-brand-600 px-2.5 py-1.5 text-[12px] font-semibold text-white">Aanbieden</button></form>
                  ) : eerste && !r ? <Label>Eerstvolgend</Label> : <span />} />
              );
            })}
          </Lijst>
        </Sectie>
      ))}

      {open.length > 0 && (
        <Sectie titel="Open diensten voor jou" rechts={<span className="text-muted">past bij je beschikbaarheid</span>}>
          <Lijst>
            {open.slice(0, 8).map((d) => (
              <Rij key={d.id} toon="rood" icoon={<Hand size={18} />} titel={<span className="capitalize">{dagLabel(d.start.toISOString())}</span>}
                sub={`${uurLabel(d.start.toISOString())} – ${uurLabel(d.eind.toISOString())} · ${pos.find((p) => p.id === d.positieId)?.naam} · ${vestigingNaam(org, d.vestigingId)}`}
                rechts={<OpenDienstKnop dienstId={d.id} />} />
            ))}
          </Lijst>
        </Sectie>
      )}

      <Sectie titel="Regelen">
        <Lijst>
          {kiesModus
            ? <Rij href="/app/werk" icoon={<Repeat size={18} />} titel="Klaar met aanbieden" sub="Kies hierboven de dienst die je wilt aanbieden" />
            : <Rij href="/app/werk?aanbieden=1" icoon={<Repeat size={18} />} titel="Dienst aanbieden" sub="Collega's met jouw functie zien hem in de teamchat" />}
          <Rij href="/app/werk/beschikbaarheid" icoon={<SlidersHorizontal size={18} />} titel="Beschikbaarheid" sub="Wanneer kun je werken?" />
          <Rij href="/app/werk/verlof" icoon={<Palmtree size={18} />} titel="Verlof en ziekmelden" sub="Aanvragen, saldo en ziek of beter melden" />
          <Rij href="/app/werk/uren" toon={inTeVullen.length ? "rood" : "navy"} icoon={<Clock size={18} />} titel="Mijn uren" sub={inTeVullen.length ? `${inTeVullen.length} dienst${inTeVullen.length > 1 ? "en" : ""} nog invullen` : "Ingevulde en bevestigde uren"} />
          {magBevestigen && <Rij href="/app/werk/uren/bevestigen" icoon={<CheckCheck size={18} />} titel="Uren bevestigen" sub="Uren van je team, voor de loonadministratie" />}
          <Rij href="/app/werk/agenda" icoon={<CalendarPlus size={18} />} titel="Rooster in je agenda" sub="Zet je diensten in je eigen telefoonagenda" />
        </Lijst>
      </Sectie>
    </>
  );
}
