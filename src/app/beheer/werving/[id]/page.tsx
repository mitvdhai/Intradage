import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, Phone } from "lucide-react";
import { ActieForm } from "@/components/actie-form";
import { cx } from "@/components/ui";
import { scopeVestigingen, mag } from "@/lib/access";
import { bewerkKandidaat, neemAan, wijzigFase } from "@/lib/personeel/acties";
import { kandidaat, vacatures } from "@/lib/personeel/data";
import { leeftijdOp, regelsVoor } from "@/lib/planning/atw";
import { vereisGebruiker } from "@/lib/session";
import { Blok, Kop } from "../../beheer-ui";

const FASEN = ["nieuw", "gesprek", "proefdraaien", "aanbod"] as const;
const veld = "w-full rounded-lg border border-line px-2.5 py-1.5 text-sm";
const label = "mb-1 block text-[12px] font-semibold text-muted";

export default async function KandidaatPagina({ params }: PageProps<"/beheer/werving/[id]">) {
  const { id } = await params;
  const { u, org } = await vereisGebruiker();
  const k = await kandidaat(id);
  if (!k || !mag(org, u, "werving", 1)) notFound();
  const vac = (await vacatures(scopeVestigingen(org, u))).find((v) => v.id === k.vacatureId);
  if (!vac) notFound();
  const vandaag = new Date().toLocaleDateString("sv-SE");
  const lft = leeftijdOp(k.geboortedatum, vandaag);
  const wie = (gid: string) => org.gebruikers.find((g) => g.id === gid)?.voornaam ?? "Iemand";
  const maandag = (() => { const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7) + 7); return d.toLocaleDateString("sv-SE"); })();

  return (
    <>
      <Kop titel={`${k.voornaam} ${k.achternaam}`} sub={`${vac.titel} · ${org.vestigingen.find((v) => v.id === vac.vestigingId)?.naam} · gesolliciteerd ${k.tijd.toLocaleDateString("nl-NL", { day: "numeric", month: "long" })}`}
        rechts={<Link href="/beheer/werving" className="text-sm font-semibold text-navy-600">← Werving</Link>} />

      {k.fase !== "aangenomen" && mag(org, u, "werving") && (
        <div className="mb-5 flex flex-wrap gap-1.5">
          {FASEN.map((f) => (
            <form key={f} action={wijzigFase.bind(null, k.id, f)}>
              <button className={cx("rounded-full px-3.5 py-1.5 text-sm font-semibold capitalize", k.fase === f ? "bg-navy-700 text-white" : "bg-white text-muted ring-1 ring-line")}>{f}</button>
            </form>
          ))}
          <form action={wijzigFase.bind(null, k.id, "afgewezen")}><button className={cx("rounded-full px-3.5 py-1.5 text-sm font-semibold", k.fase === "afgewezen" ? "bg-slate-500 text-white" : "bg-white text-muted ring-1 ring-line")}>Afwijzen</button></form>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <Blok titel="Sollicitatie">
            <dl className="grid grid-cols-[140px_1fr] gap-y-1.5 text-sm">
              <dt className="text-muted">Contact</dt><dd className="flex flex-wrap gap-4"><span className="inline-flex items-center gap-1"><Mail size={14} /> {k.email}</span><span className="inline-flex items-center gap-1"><Phone size={14} /> {k.mobiel}</span></dd>
              <dt className="text-muted">Leeftijd</dt><dd>{lft !== null ? `${lft} jaar` : "–"}{lft !== null && lft < 18 && <span className="ml-2 text-[12px] font-semibold text-amber-700">ATW {regelsVoor(lft).label}: max. {regelsVoor(lft).maxDienstMin / 60} uur per dienst{regelsVoor(lft).nietNa ? `, niet na ${regelsVoor(lft).nietNa! / 60}:00` : ""}</span>}</dd>
              <dt className="text-muted">Beschikbaarheid</dt><dd>{k.beschikbaarheid ?? "–"}</dd>
              <dt className="text-muted">Bron</dt><dd>{k.bron === "referral" ? `Aangedragen door ${wie(k.aangedragenDoor ?? "")}` : "Website"}</dd>
            </dl>
            {k.motivatie && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">“{k.motivatie}”</p>}
          </Blok>
          <Blok titel="Notities en gesprek">
            <div className="mb-3 space-y-2">
              {k.notities.length === 0 && <p className="text-sm text-muted">Nog geen notities.</p>}
              {k.notities.map((n, i) => <div key={i} className="text-sm"><span className="text-[12px] text-muted">{wie(n.door)} · {new Date(n.tijd).toLocaleString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span><div>{n.tekst}</div></div>)}
            </div>
            {k.fase !== "aangenomen" && (
              <ActieForm actie={bewerkKandidaat.bind(null, k.id)} knop="Opslaan" reset>
                <textarea name="notitie" rows={2} placeholder="Notitie (bijv. indruk na gesprek)" className={veld} />
                <div className="grid gap-2 md:grid-cols-2">
                  <label className="text-[12px] text-muted">Gesprek of proefdraaien op<input name="gesprek" type="datetime-local" className={veld} /></label>
                  <label className="text-[12px] text-muted">Beoordeling (1–5)<select name="beoordeling" defaultValue={k.beoordeling ?? ""} className={veld}><option value="">–</option>{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</select></label>
                </div>
              </ActieForm>
            )}
          </Blok>
        </div>
        <div>
          {!mag(org, u, "werving") ? null : k.fase === "aangenomen" ? (
            <Blok titel="Aangenomen">
              <p className="text-sm">{k.voornaam} zit in de preboarding.</p>
              {k.gebruikerId && <Link href={`/beheer/personeel/${k.gebruikerId}`} className="mt-2 inline-block font-semibold text-navy-600">Naar het dossier →</Link>}
            </Blok>
          ) : (
            <Blok titel={`${k.voornaam} aannemen`}>
              <ActieForm actie={neemAan.bind(null, k.id)} knop="Aannemen en preboarding starten" variant="rood">
                <div className="grid gap-3 md:grid-cols-2">
                  <div><span className={label}>Eerste werkdag</span><input name="start" type="date" defaultValue={maandag} className={veld} /></div>
                  <div><span className={label}>Contract</span><select name="type" defaultValue="minmax" className={veld}><option value="oproep">0-urencontract</option><option value="minmax">Min-maxcontract</option><option value="vast">Vast aantal uren</option></select></div>
                  <div><span className={label}>Min. uren/week</span><input name="urenMin" type="number" defaultValue={8} className={veld} /></div>
                  <div><span className={label}>Max. uren/week</span><input name="urenMax" type="number" defaultValue={16} className={veld} /></div>
                  <div><span className={label}>Bruto uurloon (€)</span><input name="uurloon" type="number" step="0.01" defaultValue={lft !== null && lft < 21 ? 10.85 : 14.99} className={veld} /></div>
                  <div><span className={label}>Duur</span><select name="maanden" defaultValue="12" className={veld}><option value="6">6 maanden</option><option value="12">12 maanden</option><option value="0">Onbepaalde tijd</option></select></div>
                </div>
                <ul className="list-disc space-y-0.5 pl-4 text-[12px] text-muted">
                  <li>{k.voornaam} komt in het personeelsbestand met status <b>preboarding</b>.</li>
                  <li>Het contract wordt opgesteld vanuit het sjabloon en staat klaar om te tekenen.</li>
                  <li>{k.voornaam} krijgt een persoonlijke startlink: gegevens, ID, beschikbaarheid, contract tekenen.</li>
                  <li>Na beide handtekeningen wordt het account actief en start de onboarding (leerpad en check-ins).</li>
                </ul>
                <p className="text-[12px] text-muted">Proeftijd: alleen bij een contract van 6 maanden of langer (1 maand). Uurloon: controleer het wettelijk minimum(jeugd)loon voor {lft ?? "de"} jaar.</p>
              </ActieForm>
            </Blok>
          )}
        </div>
      </div>
    </>
  );
}
