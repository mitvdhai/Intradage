import { redirect } from "next/navigation";
import { CalendarDays, ExternalLink, Repeat } from "lucide-react";
import { WerkSegmenten } from "@/components/werk-segmenten";
import { Label, Lijst, PageTop, Rij, Sectie, dagLabel, tijdLabel, uurLabel } from "@/components/ui";
import { biedDienstAan } from "@/lib/acties";
import { ruilverzoeken, vestigingNaam, voornaamVan } from "@/lib/data";
import { vereisGebruiker } from "@/lib/session";
import { staff } from "@/lib/staff/adapter";
import type { Dienst } from "@/lib/types";

export default async function Rooster({ searchParams }: PageProps<"/app/werk">) {
  const { aanbieden } = await searchParams;
  const kiesModus = aanbieden === "1";
  const { u, org } = await vereisGebruiker();
  if (u.rol === "franchisenemer") redirect("/app/werk/taken");
  const nu = new Date();
  const eigen = await staff.rooster(u, nu, new Date(nu.getTime() + 14 * 86400000));

  // Overgenomen diensten (na akkoord) tonen we ook, tot HorecaManager is bijgewerkt
  const overgenomen: Dienst[] = [];
  const ruilen = await ruilverzoeken();
  for (const r of ruilen.filter((x) => x.overgenomenDoor === u.id && x.status !== "afgewezen")) {
    const van = org.gebruikers.find((g) => g.id === r.aangebodenDoor);
    if (!van) continue;
    const d = (await staff.rooster(van, nu, new Date(nu.getTime() + 30 * 86400000))).find((x) => x.id === r.dienstId);
    if (d) overgenomen.push(d);
  }
  const diensten = [...eigen, ...overgenomen].sort((a, b) => a.start.localeCompare(b.start));
  const ruilVan = (d: Dienst) => ruilen.find((r) => r.dienstId === d.id && r.status !== "afgewezen");
  const eindWeek = new Date(nu); eindWeek.setDate(nu.getDate() + (7 - nu.getDay()) % 7); eindWeek.setHours(23, 59);
  const groepen = [
    { titel: "Deze week", lijst: diensten.filter((d) => new Date(d.start) <= eindWeek) },
    { titel: "Volgende week", lijst: diensten.filter((d) => new Date(d.start) > eindWeek) },
  ].filter((g) => g.lijst.length);

  return (
    <>
      <PageTop titel="Mijn werk" />
      <WerkSegmenten u={u} actief="Rooster" />
      {groepen.map((g, gi) => (
        <Sectie key={g.titel} titel={g.titel} rechts={gi === 0 ? <span className="text-muted">bijgewerkt {tijdLabel(staff.laatsteSync().toISOString())}</span> : undefined}>
          <Lijst>
            {g.lijst.map((d, i) => {
              const r = ruilVan(d);
              const vanMij = d.gebruikerId === u.id;
              const eerste = gi === 0 && i === 0;
              return (
                <Rij key={d.id} toon={r ? "rood" : eerste ? "navy" : "grijs"} icoon={r ? <Repeat size={18} /> : <CalendarDays size={18} />}
                  titel={<span className="capitalize">{dagLabel(d.start)}</span>}
                  sub={`${uurLabel(d.start)} – ${uurLabel(d.eind)} · ${d.taak} · ${vestigingNaam(org, d.vestigingId)}`}
                  onderaan={r ? <div className="mt-1 text-[12px] font-medium text-brand-700">
                    {!vanMij ? `Overgenomen van ${voornaamVan(org, d.gebruikerId)} · ${r.status === "goedgekeurd" ? "goedgekeurd" : "wacht op akkoord"}` :
                      r.status === "open" ? "Aangeboden in de teamchat" : r.status === "wacht-op-akkoord" ? `${voornaamVan(org, r.overgenomenDoor!)} neemt over · wacht op akkoord` : `Overgenomen door ${voornaamVan(org, r.overgenomenDoor!)}`}
                  </div> : undefined}
                  rechts={kiesModus && !r && vanMij ? (
                    <form action={biedDienstAan.bind(null, d.id)}><button className="rounded-lg bg-brand-600 px-2.5 py-1.5 text-[12px] font-semibold text-white">Aanbieden</button></form>
                  ) : eerste && !r ? <Label>Eerstvolgend</Label> : <span />} />
              );
            })}
          </Lijst>
        </Sectie>
      ))}
      <Sectie titel="Regelen">
        <Lijst>
          {kiesModus
            ? <Rij href="/app/werk" icoon={<Repeat size={18} />} titel="Klaar met aanbieden" sub="Kies hierboven de dienst die je wilt aanbieden" />
            : <Rij href="/app/werk?aanbieden=1" icoon={<Repeat size={18} />} titel="Dienst aanbieden" sub="Collega's met jouw functie zien hem in de teamchat" />}
          <Rij icoon={<ExternalLink size={18} />} titel="Beschikbaarheid en verlof" sub="Opent de Staff-app" rechts={<ExternalLink size={16} className="text-slate-300" />} />
        </Lijst>
      </Sectie>
    </>
  );
}
