"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { solliciteer } from "@/lib/personeel/acties";
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
  return (
    <form action={actie} className="space-y-3 rounded-2xl bg-white p-4">
      <h2 className="text-lg font-bold">Solliciteer in 1 minuut</h2>
      <input type="hidden" name="ref" value={refCode} />
      <div className="grid grid-cols-2 gap-2"><input name="voornaam" required placeholder="Voornaam" className={veld} /><input name="achternaam" required placeholder="Achternaam" className={veld} /></div>
      <input name="email" type="email" required placeholder="E-mailadres" className={veld} />
      <input name="mobiel" type="tel" required placeholder="Mobiel nummer" className={veld} />
      <label className="block text-[13px] text-muted">Geboortedatum<input name="geboortedatum" type="date" className={veld} /></label>
      <input name="beschikbaarheid" placeholder="Wanneer kun je werken? Bijv. woensdagmiddag en zaterdag" className={veld} />
      <textarea name="motivatie" rows={3} placeholder="Waarom wil je bij ons werken? (mag kort!)" className="w-full rounded-xl border border-line p-3 text-[15px]" />
      <label className="flex items-start gap-2 text-[13px] text-muted"><input type="checkbox" name="privacy" className="mt-0.5 h-5 w-5" /> Ik geef toestemming om mijn gegevens te gebruiken voor deze sollicitatie. Ze worden na 4 weken verwijderd als ik niet word aangenomen.</label>
      {res?.fout && <p className="text-sm text-brand-700">{res.fout}</p>}
      <Knop disabled={bezig}>Verstuur sollicitatie</Knop>
    </form>
  );
}
