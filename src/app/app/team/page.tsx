import { redirect } from "next/navigation";
import { Camera, ClipboardCheck, Palmtree, Repeat, Users } from "lucide-react";
import { scopeVestigingen } from "@/lib/access";
import { beslisVerlof } from "@/lib/personeel/acties";
import { diensten, posities, verlofVan } from "@/lib/personeel/data";
import { Label, Leeg, Lijst, PageTop, Rij, Sectie, dagLabel, uurLabel } from "@/components/ui";
import { isLeiding, teamVan } from "@/lib/access";
import { beslisRuil, startBeoordeling } from "@/lib/acties";
import { beoordelingen, functieVan, inzendingenVan, ruilverzoeken, vestigingNaam, voornaamVan } from "@/lib/data";
import { vereisGebruiker } from "@/lib/session";
import { staff } from "@/lib/staff/adapter";
import { dagenVanaf } from "@/lib/tijd";
import type { BeoordelingStatus } from "@/lib/types";

const STATUS: Record<BeoordelingStatus, { tekst: string; toon: "navy" | "rood" | "groen" | "grijs" }> = {
  zelfbeoordeling: { tekst: "Wacht op zelfbeoordeling", toon: "grijs" },
  beoordelen: { tekst: "Te beoordelen", toon: "rood" },
  gesprek: { tekst: "Klaar voor gesprek", toon: "navy" },
  besloten: { tekst: "Afgerond", toon: "groen" },
};

export default async function Team() {
  const { u, org } = await vereisGebruiker();
  if (!isLeiding(u)) redirect("/app");
  const team = teamVan(org, u);
  const ids = new Set(team.map((t) => t.id));
  const [inzendingen, ruilen, beo] = await Promise.all([inzendingenVan([...ids]), ruilverzoeken(), beoordelingen({ gebruikerIds: [...ids] })]);
  const ruil = ruilen.filter((r) => r.status === "wacht-op-akkoord" && ids.has(r.aangebodenDoor));
  const vandaagStart = new Date(); vandaagStart.setHours(0, 0, 0, 0);
  const [aanvragen, vandaag, pos] = await Promise.all([
    verlofVan({ gebruikerIds: [...ids], status: "aangevraagd" }),
    diensten({ vestigingIds: scopeVestigingen(org, u), van: vandaagStart, tot: new Date(vandaagStart.getTime() + 86400000), status: "gepubliceerd" }), posities(),
  ]);
  const ruilDiensten = await Promise.all(ruil.map(async (r) => {
    const g = org.gebruikers.find((x) => x.id === r.aangebodenDoor)!;
    return { r, d: (await staff.rooster(g, new Date(0), dagenVanaf(30))).find((x) => x.id === r.dienstId) };
  }));

  return (
    <>
      <PageTop titel="Mijn team" sub={u.vestigingIds.map((v) => vestigingNaam(org, v)).join(" · ")} />

      {ruilDiensten.length > 0 && (
        <Sectie titel="Ruilverzoeken">
          <Lijst>
            {ruilDiensten.map(({ r, d }) => (
              <Rij key={r.id} toon="rood" icoon={<Repeat size={18} />} titel={`${voornaamVan(org, r.overgenomenDoor!)} neemt over van ${voornaamVan(org, r.aangebodenDoor)}`}
                sub={d ? `${dagLabel(d.start)} · ${uurLabel(d.start)} – ${uurLabel(d.eind)}` : r.dienstId}
                rechts={<div className="flex gap-1.5">
                  <form action={beslisRuil.bind(null, r.id, false)}><button className="rounded-lg px-2.5 py-1.5 text-[12px] font-semibold ring-1 ring-line">Nee</button></form>
                  <form action={beslisRuil.bind(null, r.id, true)}><button className="rounded-lg bg-brand-600 px-2.5 py-1.5 text-[12px] font-semibold text-white">Akkoord</button></form>
                </div>} />
            ))}
          </Lijst>
          <p className="mt-2 px-1 text-[12px] text-muted">Na akkoord wordt het rooster direct aangepast.</p>
        </Sectie>
      )}

      {aanvragen.length > 0 && (
        <Sectie titel="Verlofaanvragen">
          <Lijst>
            {aanvragen.map((v) => (
              <Rij key={v.id} toon="rood" icoon={<Palmtree size={18} />} titel={`${voornaamVan(org, v.gebruikerId)} · ${v.type}`}
                sub={`${new Date(`${v.van}T12:00:00`).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}${v.tot && v.tot !== v.van ? ` – ${new Date(`${v.tot}T12:00:00`).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}` : ""}${v.opmerking ? ` · ${v.opmerking}` : ""}`}
                rechts={<div className="flex gap-1.5">
                  <form action={beslisVerlof.bind(null, v.id, false)}><button className="rounded-lg px-2.5 py-1.5 text-[12px] font-semibold ring-1 ring-line">Nee</button></form>
                  <form action={beslisVerlof.bind(null, v.id, true)}><button className="rounded-lg bg-brand-600 px-2.5 py-1.5 text-[12px] font-semibold text-white">Akkoord</button></form>
                </div>} />
            ))}
          </Lijst>
        </Sectie>
      )}

      {vandaag.length > 0 && (
        <Sectie titel="Vandaag op de vloer" rechts={<span className="text-muted">{vandaag.filter((d) => !d.gebruikerId).length ? `${vandaag.filter((d) => !d.gebruikerId).length} open` : "alles bezet"}</span>}>
          <Lijst>
            {vandaag.sort((a, b) => a.start.getTime() - b.start.getTime()).map((d) => (
              <Rij key={d.id} toon={d.gebruikerId ? "navy" : "rood"} icoon={<Users size={18} />} titel={d.gebruikerId ? voornaamVan(org, d.gebruikerId) : "Open dienst"}
                sub={`${uurLabel(d.start.toISOString())} – ${uurLabel(d.eind.toISOString())} · ${pos.find((p) => p.id === d.positieId)?.naam} · ${vestigingNaam(org, d.vestigingId)}`} />
            ))}
          </Lijst>
        </Sectie>
      )}

      {inzendingen.length > 0 && (
        <Sectie titel="Te beoordelen">
          <Lijst><Rij href="/app/team/inzendingen" toon="rood" icoon={<Camera size={18} />} titel={`${inzendingen.length} challenge-inzending${inzendingen.length > 1 ? "en" : ""}`} sub="Foto's van je team" /></Lijst>
        </Sectie>
      )}

      <Sectie titel="Beoordelingen 2026">
        {team.length ? (
          <Lijst>
            {team.map((m) => {
              const b = beo.find((x) => x.gebruikerId === m.id && x.periode === "2026");
              const s = b ? STATUS[b.status] : null;
              return (
                <Rij key={m.id} href={b ? `/app/team/${m.id}` : undefined} toon={s?.toon ?? "grijs"} icoon={<ClipboardCheck size={18} />}
                  titel={`${m.voornaam} ${m.achternaam}`} sub={`${functieVan(org, m)?.naam ?? "—"} · ${vestigingNaam(org, m.vestigingIds[0])}`}
                  rechts={s ? <Label toon={s.toon}>{s.tekst}</Label> : u.rol === "franchisenemer" ? (
                    <form action={startBeoordeling.bind(null, m.id)}><button className="rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-navy-700 ring-1 ring-line">Start</button></form>
                  ) : <Label toon="grijs">Nog niet gestart</Label>} />
              );
            })}
          </Lijst>
        ) : <Leeg>Geen medewerkers in je scope.</Leeg>}
      </Sectie>
    </>
  );
}
