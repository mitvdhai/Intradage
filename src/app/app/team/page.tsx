import { redirect } from "next/navigation";
import { Camera, ClipboardCheck, Repeat } from "lucide-react";
import { Label, Leeg, Lijst, PageTop, Rij, Sectie, dagLabel, uurLabel } from "@/components/ui";
import { isLeiding, teamVan } from "@/lib/access";
import { beslisRuil, startBeoordeling } from "@/lib/acties";
import { functieVan, vestigingNaam, voornaamVan } from "@/lib/data";
import { vereisGebruiker } from "@/lib/session";
import { db, staff } from "@/lib/store";
import type { BeoordelingStatus } from "@/lib/types";
import { nuMs } from "@/lib/tijd";

const STATUS: Record<BeoordelingStatus, { tekst: string; toon: "navy" | "rood" | "groen" | "grijs" }> = {
  zelfbeoordeling: { tekst: "Wacht op zelfbeoordeling", toon: "grijs" },
  beoordelen: { tekst: "Te beoordelen", toon: "rood" },
  gesprek: { tekst: "Klaar voor gesprek", toon: "navy" },
  besloten: { tekst: "Afgerond", toon: "groen" },
};

export default async function Team() {
  const u = await vereisGebruiker();
  if (!isLeiding(u)) redirect("/app");
  const team = teamVan(u);
  const ids = new Set(team.map((t) => t.id));
  const inzendingen = db.voortgang.filter((v) => v.status === "ingediend" && ids.has(v.gebruikerId));
  const ruil = db.ruilverzoeken.filter((r) => r.status === "wacht-op-akkoord" && ids.has(r.aangebodenDoor));
  const ruilDiensten = await Promise.all(ruil.map(async (r) => {
    const g = db.gebruikers.find((x) => x.id === r.aangebodenDoor)!;
    return { r, d: (await staff.rooster(g, new Date(0), new Date(nuMs() + 30 * 86400000))).find((x) => x.id === r.dienstId) };
  }));

  return (
    <>
      <PageTop titel="Mijn team" sub={u.vestigingIds.map(vestigingNaam).join(" · ")} />

      {ruilDiensten.length > 0 && (
        <Sectie titel="Ruilverzoeken">
          <Lijst>
            {ruilDiensten.map(({ r, d }) => (
              <Rij key={r.id} toon="rood" icoon={<Repeat size={18} />} titel={`${voornaamVan(r.overgenomenDoor!)} neemt over van ${voornaamVan(r.aangebodenDoor)}`}
                sub={d ? `${dagLabel(d.start)} · ${uurLabel(d.start)} – ${uurLabel(d.eind)}` : r.dienstId}
                rechts={<div className="flex gap-1.5">
                  <form action={beslisRuil.bind(null, r.id, false)}><button className="rounded-lg px-2.5 py-1.5 text-[12px] font-semibold ring-1 ring-line">Nee</button></form>
                  <form action={beslisRuil.bind(null, r.id, true)}><button className="rounded-lg bg-brand-600 px-2.5 py-1.5 text-[12px] font-semibold text-white">Akkoord</button></form>
                </div>} />
            ))}
          </Lijst>
          <p className="mt-2 px-1 text-[12px] text-muted">HorecaManager ondersteunt nog geen terugschrijven: na akkoord verschijnt een taak om de ruil in Staff te verwerken.</p>
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
              const b = db.beoordelingen.find((x) => x.gebruikerId === m.id && x.periode === "2026");
              const s = b ? STATUS[b.status] : null;
              return (
                <Rij key={m.id} href={b ? `/app/team/${m.id}` : undefined} toon={s?.toon ?? "grijs"} icoon={<ClipboardCheck size={18} />}
                  titel={`${m.voornaam} ${m.achternaam}`} sub={`${functieVan(m)?.naam ?? "—"} · ${vestigingNaam(m.vestigingIds[0])}`}
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
