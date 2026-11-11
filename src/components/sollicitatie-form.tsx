"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { solliciteer } from "@/lib/personeel/acties";
import { BeschikbaarheidVelden } from "./beschikbaarheid-velden";
import { Knop } from "./ui";

const veld = "tap w-full rounded-xl border border-line bg-white px-3 text-[15px] outline-none focus:border-navy-500";

export function SollicitatieForm({ slug, refCode }: { slug: string; refCode: string }) {
  const [res, actie, bezig] = useActionState(solliciteer.bind(null, slug), null);
  if (res?.ok) return (
    <div className="rounded-2xl bg-emerald-50 p-5 text-center text-emerald-900">
      <CheckCircle2 className="mx-auto mb-2" />
      <div className="text-lg font-bold">Bedankt voor je sollicitatie!</div>
      <p className="text-[14px]">We nemen binnen 3 werkdagen contact met je op via WhatsApp of telefoon.</p>
    </div>
  );
  const kop = "pt-2 text-[13px] font-bold uppercase tracking-wide text-navy-700";
  return (
    <form action={actie} className="space-y-3 rounded-2xl bg-white p-4">
      <h2 className="text-lg font-bold">Solliciteer in 3 minuten</h2>
      <p className="text-[13px] text-muted">Wat je hier invult, gebruiken we ook als je wordt aangenomen. Je hoeft het dus maar één keer te doen.</p>
      <input type="hidden" name="ref" value={refCode} />
      <div className={kop}>Over jou</div>
      <div className="grid grid-cols-2 gap-2"><input name="voornaam" required placeholder="Voornaam" className={veld} /><input name="achternaam" required placeholder="Achternaam" className={veld} /></div>
      <label className="block text-[13px] text-muted">Geboortedatum<input name="geboortedatum" type="date" required className={veld} /></label>
      <input name="email" type="email" required placeholder="E-mailadres" className={veld} />
      <input name="mobiel" type="tel" required placeholder="Mobiel nummer" className={veld} />
      <div className={kop}>Adres</div>
      <input name="adres" required placeholder="Straat en huisnummer" className={veld} />
      <div className="grid grid-cols-[120px_1fr] gap-2"><input name="postcode" required placeholder="1234 AB" className={veld} /><input name="woonplaats" required placeholder="Woonplaats" className={veld} /></div>
      <div className={kop}>Wanneer kun je werken?</div>
      <p className="text-[13px] text-muted">Vink de dagen aan en geef aan van hoe laat tot hoe laat. Je kunt het later altijd aanpassen.</p>
      <BeschikbaarheidVelden huidig={[]} />
      <input name="opmerking" placeholder="Nog iets over je beschikbaarheid? Bijv. 'in de zomer meer'" className={veld} />
      <div className={kop}>Nog even dit</div>
      <label className="block text-[13px] text-muted">CV (mag, hoeft niet: pdf, Word of foto, max. 2 MB)<input name="bestand" type="file" accept="application/pdf,.doc,.docx,image/*" className="mt-1 block text-sm" /></label>
      <textarea name="motivatie" rows={3} placeholder="Waarom wil je bij ons werken? (mag kort!)" className="w-full rounded-xl border border-line p-3 text-[15px]" />
      <label className="flex items-start gap-2 text-[13px] text-muted"><input type="checkbox" name="privacy" className="mt-0.5 h-5 w-5" /> Ik geef toestemming om mijn gegevens te gebruiken voor deze sollicitatie. Ze worden 4 weken na een afwijzing verwijderd.</label>
      {res?.fout && <p className="text-sm text-brand-700">{res.fout}</p>}
      <Knop disabled={bezig}>Verstuur sollicitatie</Knop>
    </form>
  );
}
