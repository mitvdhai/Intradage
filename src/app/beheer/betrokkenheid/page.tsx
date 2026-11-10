import { NieuweEnquete, NieuwEvenement } from "@/components/beheer-betrokkenheid-forms";
import { EnqueteResultaat } from "@/components/enquete-resultaat";
import { tijdLabel } from "@/components/ui";
import { isHQ, ontvangers, scopeVestigingen } from "@/lib/access";
import { behandelBeloning } from "@/lib/acties-betrokkenheid";
import { beloningAanvragen, beloningen, deelnameAantal, enqueteResultaten, enquetesVoor, evenementenVoor, waarden, waarderingen } from "@/lib/betrokkenheid";
import { naamVan, vestigingNaam } from "@/lib/data";
import { vereisGebruiker } from "@/lib/session";
import { nuMs } from "@/lib/tijd";
import { Blok, Kop, Kpi, Pct, Tabel } from "../beheer-ui";

export default async function BeheerBetrokkenheid() {
  const { u, org } = await vereisGebruiker();
  const scope = new Set(scopeVestigingen(org, u));
  const mensen = org.gebruikers.filter((g) => g.rol !== "hq" && g.vestigingIds.some((v) => scope.has(v)));
  const ids = new Set(mensen.map((m) => m.id));
  const maand = new Date(nuMs() - 30 * 86400000);
  const fnFilter = isHQ(u) ? undefined : u.franchisenemerId ?? undefined;

  const [ws, recent, enq, ev, aanvr, cat] = await Promise.all([
    waarden(), waarderingen(org, u, { sinds: maand, limiet: 1000 }), enquetesVoor(org, u), evenementenVoor(org, u), beloningAanvragen({ status: "aangevraagd" }), beloningen(),
  ]);
  const inScope = recent.filter((w) => ids.has(w.aanId));
  const bereikt = new Set(inScope.map((w) => w.aanId)).size;
  const gevers = new Set(inScope.map((w) => w.vanId)).size;
  const peilingen = enq.filter((e) => e.type !== "idee");
  const resultaten = await Promise.all(peilingen.map(async (e) => ({ e, r: await enqueteResultaten(e, fnFilter), n: await deelnameAantal(e.id), doel: ontvangers(org, e.doelgroep, u).length })));
  const enps = resultaten.find((x) => x.e.type === "enps")?.r.vragen.find((v) => v.enps)?.enps?.score;
  const mijnAanvragen = aanvr.filter((a) => ids.has(a.gebruikerId));

  return (
    <>
      <Kop titel="Betrokkenheid" sub="Waardering, peilingen, evenementen en beloningen" />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi waarde={String(inScope.length)} label="waarderingen laatste 30 dagen" />
        <Kpi waarde={`${mensen.length ? Math.round((bereikt / mensen.length) * 100) : 0}%`} label={`medewerkers gewaardeerd (${gevers} gevers)`} />
        <Kpi waarde={enps === undefined ? "–" : `${enps > 0 ? "+" : ""}${enps}`} label="eNPS (laatste meting)" toon={enps !== undefined && enps < 0 ? "rood" : "navy"} />
        <Kpi waarde={String(mijnAanvragen.length)} label="beloningen om uit te reiken" toon={mijnAanvragen.length ? "rood" : "navy"} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
        <div className="space-y-6">
          <Blok titel="Peilingen en enquêtes">
            <div className="space-y-6">
              {resultaten.map(({ e, r, n, doel }) => (
                <div key={e.id} className="border-b border-line pb-5 last:border-0 last:pb-0">
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                    <div><span className="font-semibold">{e.titel}</span> <span className="text-[12px] uppercase text-muted">· {e.type}{e.anoniem ? " · anoniem" : ""}</span></div>
                    <div className="flex items-center gap-2 text-[13px] text-muted">deelname <Pct v={doel ? Math.min(100, Math.round((n / doel) * 100)) : null} /></div>
                  </div>
                  <EnqueteResultaat vragen={r.vragen} aantal={r.aantal} teWeinig={r.teWeinig} />
                </div>
              ))}
            </div>
          </Blok>
          <Blok titel="Waardering per kernwaarde (30 dagen)">
            <Tabel kop={["Kernwaarde", "Aantal", ""]}>
              {ws.map((w) => {
                const n = inScope.filter((x) => x.waarde.id === w.id).length;
                const max = Math.max(1, ...ws.map((y) => inScope.filter((x) => x.waarde.id === y.id).length));
                return (
                  <tr key={w.id}><td className="px-3 py-2">{w.emoji} {w.naam}</td><td className="px-3 py-2 font-semibold">{n}</td>
                    <td className="w-1/2 px-3 py-2"><div className="h-3 rounded bg-slate-100"><div className="h-full rounded bg-brand-600" style={{ width: `${(n / max) * 100}%` }} /></div></td></tr>
                );
              })}
            </Tabel>
          </Blok>
        </div>
        <div className="space-y-6">
          <Blok titel="Nieuwe peiling"><NieuweEnquete /></Blok>
          <Blok titel="Beloningen uitreiken">
            {mijnAanvragen.length === 0 ? <p className="text-sm text-muted">Niets open.</p> : (
              <div className="divide-y divide-line">
                {mijnAanvragen.map((a) => {
                  const b = cat.find((x) => x.id === a.beloningId);
                  const g = org.gebruikers.find((x) => x.id === a.gebruikerId);
                  return (
                    <div key={a.id} className="flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1"><div className="font-medium">{b?.emoji} {b?.titel}</div><div className="text-[12px] text-muted">{naamVan(org, a.gebruikerId)} · {g ? vestigingNaam(org, g.vestigingIds[0] ?? "") : ""} · {tijdLabel(a.tijd.toISOString())}</div></div>
                      <form action={behandelBeloning.bind(null, a.id, true)}><button className="rounded-lg bg-navy-700 px-3 py-1.5 text-[13px] font-semibold text-white">Uitgereikt</button></form>
                      <form action={behandelBeloning.bind(null, a.id, false)}><button className="rounded-lg px-3 py-1.5 text-[13px] font-semibold text-muted ring-1 ring-line">Afwijzen</button></form>
                    </div>
                  );
                })}
              </div>
            )}
          </Blok>
          <Blok titel="Evenementen">
            <div className="mb-4 divide-y divide-line">
              {ev.map((e) => <div key={e.id} className="flex justify-between py-2 text-sm"><span className="font-medium">{e.titel}</span><span className="text-muted">{e.start.toLocaleDateString("nl-NL", { day: "numeric", month: "short" })} · {e.ja.length} gaan</span></div>)}
            </div>
            <NieuwEvenement />
          </Blok>
        </div>
      </div>
    </>
  );
}
