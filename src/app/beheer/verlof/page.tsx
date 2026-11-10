import Link from "next/link";
import { redirect } from "next/navigation";
import { Check, Thermometer, X } from "lucide-react";
import { cx } from "@/components/ui";
import { beslisVerlof } from "@/lib/personeel/acties";
import { diensten, magPersoneel, medewerkers, vandaagIso, verlofVan } from "@/lib/personeel/data";
import { deadlineVan } from "@/lib/personeel/sjablonen";
import { vereisGebruiker } from "@/lib/session";
import { nuMs } from "@/lib/tijd";
import { Blok, Kop, Kpi } from "../beheer-ui";

const datum = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" });

export default async function VerlofBeheer() {
  const { u, org } = await vereisGebruiker();
  if (!magPersoneel(u)) redirect("/beheer");
  const mensen = await medewerkers(org, u);
  const ids = mensen.map((m) => m.id);
  const vandaag = vandaagIso();
  const alle = await verlofVan({ gebruikerIds: ids, vanaf: deadlineVan(vandaag, -30) });
  const aanvragen = alle.filter((v) => v.status === "aangevraagd");
  const ziek = alle.filter((v) => v.type === "ziek" && !v.tot);
  const komend = alle.filter((v) => v.status === "goedgekeurd" && v.type !== "ziek" && (v.tot ?? v.van) >= vandaag);
  const naam = (id: string) => { const m = mensen.find((x) => x.id === id); return m ? `${m.voornaam} ${m.achternaam}` : id; };
  // Welke diensten raakt een aanvraag?
  const geraakt = await diensten({ gebruikerIds: aanvragen.map((v) => v.gebruikerId), van: new Date(), tot: new Date(nuMs() + 60 * 86400000) });
  const telDiensten = (v: (typeof alle)[number]) => geraakt.filter((d) => d.gebruikerId === v.gebruikerId && d.start.toLocaleDateString("sv-SE") >= v.van && d.start.toLocaleDateString("sv-SE") <= (v.tot ?? v.van)).length;

  return (
    <>
      <Kop titel="Verlof en ziekte" sub="Aanvragen beoordelen, ziekmeldingen volgen en zien wie er weg is" />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi waarde={String(aanvragen.length)} label="aanvragen te beoordelen" toon={aanvragen.length ? "rood" : "navy"} />
        <Kpi waarde={String(ziek.length)} label="nu ziek gemeld" toon={ziek.length ? "rood" : "navy"} />
        <Kpi waarde={String(komend.length)} label="goedgekeurd verlof (komend)" />
        <Kpi waarde={`${mensen.length ? Math.round((ziek.length / mensen.length) * 1000) / 10 : 0}%`} label="verzuim vandaag" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Blok titel="Aanvragen">
          {aanvragen.length === 0 ? <p className="text-sm text-muted">Geen openstaande aanvragen.</p> : (
            <div className="divide-y divide-line">
              {aanvragen.map((v) => {
                const n = telDiensten(v);
                return (
                  <div key={v.id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <Link href={`/beheer/personeel/${v.gebruikerId}`} className="font-semibold hover:underline">{naam(v.gebruikerId)}</Link>
                      <div className="text-sm"><span className="capitalize">{v.type}</span> · {datum(v.van)}{v.tot && v.tot !== v.van ? ` t/m ${datum(v.tot)}` : ""}{v.uren ? ` · ${v.uren} uur` : ""}</div>
                      <div className="text-[12px] text-muted">{v.opmerking ? `“${v.opmerking}” · ` : ""}{n ? <span className="font-semibold text-amber-700">{n} ingeplande dienst{n > 1 ? "en" : ""} in deze periode</span> : "geen ingeplande diensten"}</div>
                    </div>
                    <form action={beslisVerlof.bind(null, v.id, true)}><button className="inline-flex items-center gap-1 rounded-lg bg-navy-700 px-3 py-1.5 text-sm font-semibold text-white"><Check size={15} /> Goedkeuren</button></form>
                    <form action={beslisVerlof.bind(null, v.id, false)}><button className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold text-muted ring-1 ring-line"><X size={15} /> Afwijzen</button></form>
                  </div>
                );
              })}
            </div>
          )}
          <p className="mt-3 text-[12px] text-muted">Goedgekeurd verlof blokkeert de planning: het roostervoorstel plant niemand in op dagen met verlof, en handmatig toewijzen wordt geweigerd.</p>
        </Blok>
        <div className="space-y-6">
          <Blok titel="Ziek gemeld">
            {ziek.length === 0 ? <p className="text-sm text-muted">Niemand ziek. 💪</p> : ziek.map((v) => (
              <div key={v.id} className="flex items-center gap-2 py-1.5 text-sm">
                <Thermometer size={16} className="text-brand-600" />
                <span className="flex-1">{naam(v.gebruikerId)}{v.opmerking ? <span className="text-muted"> · {v.opmerking}</span> : ""}</span>
                <span className="text-[12px] text-muted">sinds {datum(v.van)}</span>
              </div>
            ))}
            <p className="mt-2 text-[12px] text-muted">Bij een ziekmelding komen de diensten van vandaag en morgen automatisch open te staan. Verzuim langer dan een week: meld het bij de arbodienst (Wet verbetering poortwachter).</p>
          </Blok>
          <Blok titel="Komend verlof">
            {komend.map((v) => (
              <div key={v.id} className={cx("flex justify-between py-1 text-sm")}>
                <span>{naam(v.gebruikerId)} · <span className="capitalize">{v.type}</span></span>
                <span className="text-muted">{datum(v.van)}{v.tot && v.tot !== v.van ? ` – ${datum(v.tot)}` : ""}</span>
              </div>
            ))}
            {!komend.length && <p className="text-sm text-muted">Geen.</p>}
          </Blok>
        </div>
      </div>
    </>
  );
}
