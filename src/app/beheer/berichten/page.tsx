import { NieuwBericht } from "@/components/nieuw-bericht";
import { tijdLabel } from "@/components/ui";
import { ontvangers, scopeVestigingen, ROL_LABEL } from "@/lib/access";
import { afzenderLabel, status } from "@/lib/data";
import { vereisGebruiker } from "@/lib/session";
import { db } from "@/lib/store";
import { Blok, Kop, Pct, Tabel } from "../beheer-ui";

export default async function BeheerBerichten() {
  const u = await vereisGebruiker();
  const scope = scopeVestigingen(u);
  const mensen = db.gebruikers.filter((g) => g.rol !== "hq" && g.vestigingIds.some((v) => scope.includes(v)));
  const lijst = db.berichten.filter((b) => ontvangers(b.doelgroep, u).length > 0).slice(0, 12);

  return (
    <>
      <Kop titel="Berichten" sub="Gericht versturen in plaats van mailen" />
      <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
        <Blok titel="Nieuw bericht">
          <NieuwBericht
            mensen={mensen.map((m) => ({ rol: m.rol, functieId: m.functieId, vestigingIds: m.vestigingIds }))}
            rollen={(["medewerker", "shiftleider", "manager", "franchisenemer"] as const).map((r) => ({ id: r, label: ROL_LABEL[r] }))}
            functies={db.functies.map((f) => ({ id: f.id, label: f.naam }))}
            vestigingen={db.vestigingen.filter((v) => scope.includes(v.id)).map((v) => ({ id: v.id, label: `${v.naam} (${v.plaats})` }))} />
        </Blok>
        <Blok titel="Bereik">
          <Tabel kop={["Bericht", "Ontvangers", "Gelezen", "Bevestigd"]}>
            {lijst.map((b) => {
              const o = ontvangers(b.doelgroep, u);
              const gel = o.filter((m) => status(b, m).gelezen).length;
              const bev = o.filter((m) => status(b, m).bevestigd).length;
              return (
                <tr key={b.id}>
                  <td className="px-3 py-2.5">
                    <div className="font-medium">{b.titel}</div>
                    <div className="text-[12px] text-muted">{afzenderLabel(b)} · {tijdLabel(b.gepubliceerd)}{b.urgentie === "verplicht" && <span className="ml-1 font-semibold text-brand-600">· verplicht</span>}</div>
                  </td>
                  <td className="px-3 py-2.5">{o.length}</td>
                  <td className="px-3 py-2.5"><Pct v={o.length ? Math.round((gel / o.length) * 100) : null} /></td>
                  <td className="px-3 py-2.5">{b.urgentie === "verplicht" ? <Pct v={o.length ? Math.round((bev / o.length) * 100) : null} /> : <span className="text-muted">n.v.t.</span>}</td>
                </tr>
              );
            })}
          </Tabel>
        </Blok>
      </div>
    </>
  );
}
