import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink, Star, Users } from "lucide-react";
import { ActieForm } from "@/components/actie-form";
import { cx } from "@/components/ui";
import { scopeVestigingen } from "@/lib/access";
import { maakVacature, sluitVacature } from "@/lib/personeel/acties";
import { kandidaten, magPersoneel, vacatures } from "@/lib/personeel/data";
import { leeftijdOp } from "@/lib/planning/atw";
import { vereisGebruiker } from "@/lib/session";
import { Blok, Kop, Kpi } from "../beheer-ui";

const FASEN = [
  { id: "nieuw", label: "Nieuw" }, { id: "gesprek", label: "Gesprek" }, { id: "proefdraaien", label: "Proefdraaien" },
  { id: "aanbod", label: "Aanbod" }, { id: "aangenomen", label: "Aangenomen" },
] as const;
const veld = "w-full rounded-lg border border-line px-2.5 py-1.5 text-sm";

export default async function Werving() {
  const { u, org } = await vereisGebruiker();
  if (!magPersoneel(u)) redirect("/beheer");
  const scope = scopeVestigingen(org, u);
  const vac = await vacatures(scope);
  const kand = await kandidaten(vac.map((v) => v.id));
  const vandaag = new Date().toLocaleDateString("sv-SE");
  const actief = kand.filter((k) => k.fase !== "afgewezen");
  const naam = (vid: string) => org.vestigingen.find((x) => x.id === vid)?.naam;

  return (
    <>
      <Kop titel="Werving" sub="Van vacature tot eerste werkdag: sollicitatie, gesprek, proefdraaien, aanbod, preboarding" />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi waarde={String(vac.filter((v) => v.status === "open").length)} label="open vacatures" />
        <Kpi waarde={String(actief.filter((k) => k.fase !== "aangenomen").length)} label="kandidaten in procedure" />
        <Kpi waarde={String(kand.filter((k) => k.fase === "nieuw").length)} label="nieuwe sollicitaties" toon={kand.some((k) => k.fase === "nieuw") ? "rood" : "navy"} />
        <Kpi waarde={String(kand.filter((k) => k.bron === "referral").length)} label="aangedragen door collega's" />
      </div>

      <Blok titel="Kandidaten">
        <div className="grid grid-cols-5 gap-3">
          {FASEN.map((f) => {
            const lijst = actief.filter((k) => k.fase === f.id);
            return (
              <div key={f.id} className="min-h-40 rounded-xl bg-slate-50 p-2">
                <div className="mb-2 flex justify-between px-1 text-[12px] font-semibold uppercase tracking-wider text-muted"><span>{f.label}</span><span>{lijst.length}</span></div>
                <div className="space-y-2">
                  {lijst.map((k) => {
                    const v = vac.find((x) => x.id === k.vacatureId);
                    const lft = leeftijdOp(k.geboortedatum, vandaag);
                    return (
                      <Link key={k.id} href={`/beheer/werving/${k.id}`} className="block rounded-lg border border-line bg-white p-2.5 text-[13px] hover:border-navy-300">
                        <div className="font-semibold">{k.voornaam} {k.achternaam}</div>
                        <div className="text-[12px] text-muted">{v?.titel} · {naam(v?.vestigingId ?? "")}{lft !== null ? ` · ${lft} jr` : ""}</div>
                        <div className="mt-1 flex items-center gap-2 text-[11px]">
                          {k.beoordeling ? <span className="inline-flex items-center gap-0.5 text-amber-600"><Star size={11} fill="currentColor" /> {k.beoordeling}</span> : null}
                          {k.bron === "referral" && <span className="rounded bg-navy-50 px-1.5 font-semibold text-navy-700">via collega</span>}
                          {k.gesprekOp && f.id === "gesprek" && <span className="text-navy-600">{k.gesprekOp.toLocaleString("nl-NL", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Blok>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Blok titel="Vacatures">
          <div className="divide-y divide-line">
            {vac.map((v) => {
              const n = kand.filter((k) => k.vacatureId === v.id && k.fase !== "afgewezen").length;
              return (
                <div key={v.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{v.titel} · {naam(v.vestigingId)}</div>
                    <div className="text-[12px] text-muted">{v.uren} · geplaatst {v.gemaakt.toLocaleDateString("nl-NL", { day: "numeric", month: "short" })} · <Users size={11} className="inline" /> {n}</div>
                  </div>
                  {v.status === "open" && <Link href={`/werken-bij/${v.slug}`} target="_blank" className="inline-flex items-center gap-1 text-[13px] font-semibold text-navy-600">Bekijk <ExternalLink size={13} /></Link>}
                  <span className={cx("rounded-full px-2 py-0.5 text-[11px] font-semibold", v.status === "open" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-muted")}>{v.status}</span>
                  <form action={sluitVacature.bind(null, v.id)}><button className="text-[12px] font-semibold text-muted underline">{v.status === "open" ? "Sluiten" : "Heropenen"}</button></form>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[12px] text-muted">Open vacatures staan op <Link href="/werken-bij" className="underline">/werken-bij</Link>. Medewerkers delen een vacature met hun eigen link; een aangedragen collega die wordt aangenomen levert 50 punten op.</p>
        </Blok>
        <Blok titel="Nieuwe vacature">
          <ActieForm actie={maakVacature} knop="Vacature plaatsen" variant="rood" reset>
            <div className="grid gap-2 md:grid-cols-2">
              <select name="vestiging" className={veld}>{org.vestigingen.filter((v) => scope.includes(v.id)).map((v) => <option key={v.id} value={v.id}>{v.naam} · {v.plaats}</option>)}</select>
              <select name="functie" className={veld}>{org.functies.filter((f) => f.familie === "vestiging").map((f) => <option key={f.id} value={f.id}>{f.naam}</option>)}</select>
              <input name="titel" placeholder="Titel, bijv. Medewerker weekend" className={veld} />
              <input name="uren" placeholder="Bijv. 8 – 16 uur per week" className={veld} />
            </div>
            <textarea name="omschrijving" rows={3} placeholder="Wat ga je doen, wie zoeken we, wat bieden we?" className={veld} />
          </ActieForm>
        </Blok>
      </div>
    </>
  );
}
