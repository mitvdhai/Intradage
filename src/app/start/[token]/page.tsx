import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CheckCircle2, Circle } from "lucide-react";
import { ActieForm, Handtekening } from "@/components/actie-form";
import { BeschikbaarheidVelden } from "@/components/beschikbaarheid-velden";
import { PubliekeKop } from "@/components/publiek";
import { cx } from "@/components/ui";
import { getOrg } from "@/lib/org";
import { preboardingBeschikbaarheid, preboardingDocument, preboardingGegevens, preboardingTeken } from "@/lib/personeel/acties";
import { beschikbaarheidVan, contractenVan, lifecycleVan, medewerkerOpToken } from "@/lib/personeel/data";

const veld = "tap w-full rounded-xl border border-line bg-white px-3 text-[15px] outline-none focus:border-navy-500";

/** Preboarding: de nieuwe medewerker regelt alles vóór de eerste werkdag, zonder account, via een persoonlijke link. */
export default async function Start({ params }: PageProps<"/start/[token]">) {
  await connection();
  const { token } = await params;
  const g = await medewerkerOpToken(token);
  if (!g) notFound();
  const org = await getOrg();
  if (g.status !== "preboarding") {
    return (
      <main className="mx-auto min-h-screen max-w-md bg-canvas">
        <PubliekeKop titel={`Welkom in het team, ${g.voornaam}!`} sub="Alles is geregeld. Je kunt inloggen in de app met je mobiele nummer." />
      </main>
    );
  }
  const [taken, contracten, besch] = await Promise.all([lifecycleVan(g.id), contractenVan([g.id]), beschikbaarheidVan([g.id])]);
  const eigen = taken.filter((t) => t.fase === "preboarding" && t.wie === "medewerker");
  const klaar = (s: string) => !!eigen.find((t) => t.sleutel === s)?.klaar;
  const contract = contracten.find((c) => c.status === "ter-ondertekening");
  const vest = org.vestigingen.find((v) => g.franchisenemerId && v.franchisenemerId === g.franchisenemerId);
  const start = new Date(`${g.inDienstSinds}T12:00:00`).toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" });
  const allesKlaar = eigen.every((t) => t.klaar);

  const eersteOpen = eigen.find((t) => !t.klaar)?.sleutel;
  const stap = (sleutel: string) => ({ klaar: klaar(sleutel), open: eersteOpen === sleutel });

  return (
    <main className="mx-auto min-h-screen max-w-md bg-canvas pb-10">
      <PubliekeKop titel={`Welkom, ${g.voornaam}! 🍟`} sub={`Je begint op ${start}${vest ? ` bij ${vest.naam} in ${vest.plaats}` : ""}. Regel hieronder alvast alles, dan kun je op je eerste dag meteen aan de slag.`}>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-white" style={{ width: `${(eigen.filter((t) => t.klaar).length / Math.max(1, eigen.length)) * 100}%` }} /></div>
        <div className="mt-1 text-[13px] text-navy-100">{eigen.filter((t) => t.klaar).length} van {eigen.length} stappen klaar</div>
      </PubliekeKop>
      <div className="space-y-3 px-4 pt-5">
        {allesKlaar && <div className="rounded-2xl bg-emerald-50 p-4 text-emerald-900"><b>Top, je bent klaar!</b> Je leidinggevende tekent je contract en plant je eerste dienst. Daarna krijg je een sms om in te loggen in de app.</div>}
        <Stap nr={1} {...stap("gegevens")} titel="Je gegevens">
          <ActieForm actie={preboardingGegevens.bind(null, token)} knop="Opslaan" variant="rood">
            <input name="adres" placeholder="Straat en huisnummer" className={veld} />
            <div className="grid grid-cols-[120px_1fr] gap-2"><input name="postcode" placeholder="Postcode" className={veld} /><input name="woonplaats" placeholder="Woonplaats" className={veld} /></div>
            <input name="iban" placeholder="IBAN (voor je salaris)" className={veld} />
            <input name="bsn" inputMode="numeric" placeholder="BSN (staat op je ID-kaart)" className={veld} />
            <fieldset className="rounded-xl bg-slate-50 p-3 text-[14px]"><legend className="px-1 text-[13px] text-muted">Loonheffingskorting toepassen bij ons?</legend>
              <label className="mr-4"><input type="radio" name="loonheffing" value="ja" defaultChecked /> Ja</label><label><input type="radio" name="loonheffing" value="nee" /> Nee (bijv. al bij een andere baan)</label></fieldset>
            <div className="grid grid-cols-2 gap-2"><input name="noodNaam" placeholder="Noodcontact (naam)" className={veld} /><input name="noodTel" placeholder="Telefoon noodcontact" className={veld} /></div>
            <p className="text-[12px] text-muted">IBAN en BSN gaan versleuteld naar de loonadministratie. In de app zie je alleen de laatste cijfers.</p>
          </ActieForm>
        </Stap>
        <Stap nr={2} {...stap("identiteit")} titel="Foto van je ID-kaart of paspoort">
          <ActieForm actie={preboardingDocument.bind(null, token)} knop="Uploaden" variant="rood">
            <input type="hidden" name="categorie" value="identiteit" /><input type="hidden" name="titel" value="Kopie identiteitsbewijs" />
            <input name="bestand" type="file" accept="image/*,application/pdf" capture="environment" className="text-sm" />
            <p className="text-[12px] text-muted">Dit is wettelijk verplicht voor je werkgever. Tip: maak je BSN en pasfoto onzichtbaar met de KopieID-app van de overheid; je werkgever mag die niet bewaren.</p>
          </ActieForm>
        </Stap>
        <Stap nr={3} {...stap("beschikbaarheid")} titel="Wanneer kun je werken?">
          <ActieForm actie={preboardingBeschikbaarheid.bind(null, token)} knop="Opslaan" variant="rood">
            <BeschikbaarheidVelden huidig={besch} />
          </ActieForm>
        </Stap>
        <Stap nr={4} {...stap("contract-werknemer")} titel="Je contract tekenen">
          {contract ? (
            <ActieForm actie={preboardingTeken.bind(null, token, contract.id)} knop="Contract tekenen" variant="rood" succes="Getekend! Je werkgever tekent nu ook.">
              <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-3 font-sans text-[13px] leading-relaxed">{contract.tekst}</pre>
              <label className="flex items-start gap-2.5 text-[14px]"><input type="checkbox" name="akkoord" className="mt-0.5 h-5 w-5" /> Ik heb het contract gelezen en ga akkoord.</label>
              {g.geboortedatum && Number(g.inDienstSinds.slice(0, 4)) - Number(g.geboortedatum.slice(0, 4)) < 18 && <p className="rounded-lg bg-amber-50 p-2.5 text-[12px] text-amber-800">Ben je jonger dan 18? Laat je ouder of verzorger meelezen. Zij kunnen een toestemmingsverklaring uploaden bij stap 2.</p>}
              <Handtekening />
            </ActieForm>
          ) : <p className="text-sm text-muted">{klaar("contract-werknemer") ? "Je hebt je contract getekend." : "Je contract wordt nog opgesteld. Je krijgt bericht."}</p>}
        </Stap>
        <div className="rounded-2xl border border-line bg-white p-4 text-[14px]">
          <div className="mb-1 font-semibold">Wat je leidinggevende regelt</div>
          {taken.filter((t) => t.fase === "preboarding" && t.wie === "leiding").map((t) => (
            <div key={t.id} className="flex items-center gap-2 py-0.5 text-muted">{t.klaar ? <CheckCircle2 size={16} className="text-emerald-600" /> : <Circle size={16} className="text-slate-300" />} {t.titel}</div>
          ))}
        </div>
      </div>
    </main>
  );
}

function Stap({ nr, klaar, open, titel, children }: { nr: number; klaar: boolean; open: boolean; titel: string; children: React.ReactNode }) {
  return (
    <details open={open} className={cx("rounded-2xl border bg-white", klaar ? "border-emerald-200" : "border-line")}>
      <summary className="flex cursor-pointer items-center gap-3 p-4">
        {klaar ? <CheckCircle2 className="shrink-0 text-emerald-600" /> : <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-navy-700 text-[13px] font-bold text-white">{nr}</span>}
        <span className="flex-1 font-semibold">{titel}</span>
        {klaar && <span className="text-[12px] font-semibold text-emerald-700">klaar</span>}
      </summary>
      <div className="border-t border-line p-4">{children}</div>
    </details>
  );
}
