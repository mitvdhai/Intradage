import { Palmtree, Thermometer, X } from "lucide-react";
import { ActieForm } from "@/components/actie-form";
import { Kaart, Label, Lijst, PageTop, Rij, Sectie } from "@/components/ui";
import { meldBeter, meldZiek, trekVerlofIn, vraagVerlofAan } from "@/lib/personeel/acties";
import { verlofSaldo, verlofVan } from "@/lib/personeel/data";
import { vereisGebruiker } from "@/lib/session";
import { nuMs } from "@/lib/tijd";

const datum = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" });
const veld = "tap w-full rounded-xl border border-line bg-white px-3 text-[15px]";

export default async function VerlofPagina() {
  const { u } = await vereisGebruiker();
  const [lijst, saldo] = await Promise.all([verlofVan({ gebruikerIds: [u.id] }), verlofSaldo(u.id)]);
  const ziek = lijst.find((v) => v.type === "ziek" && !v.tot);
  const morgen = new Date(nuMs() + 86400000).toLocaleDateString("sv-SE");
  return (
    <>
      <PageTop terug={{ href: "/app/werk", label: "Mijn werk" }} titel="Verlof en ziekmelden" />
      <div className="px-4 pt-4">
        {ziek ? (
          <Kaart className="border-brand-100 bg-brand-50">
            <div className="flex items-center gap-2 font-semibold text-brand-700"><Thermometer size={18} /> Je bent ziek gemeld sinds {datum(ziek.van)}</div>
            <p className="mt-1 text-[13px] text-brand-800">Beterschap! Meld je beter zodra je weer kunt werken.</p>
            <form action={meldBeter.bind(null, ziek.id)} className="mt-3"><button className="tap w-full rounded-xl bg-brand-600 text-[15px] font-semibold text-white">Ik ben beter</button></form>
          </Kaart>
        ) : (
          <details className="rounded-2xl border border-line bg-white p-4">
            <summary className="flex cursor-pointer items-center gap-2 font-semibold text-brand-700"><Thermometer size={18} /> Ziek melden</summary>
            <ActieForm actie={meldZiek} knop="Ziek melden" variant="rood" className="mt-3">
              <input name="opmerking" placeholder="Optioneel: iets wat je leidinggevende moet weten" className={veld} />
              <p className="text-[12px] text-muted">Je diensten van vandaag en morgen komen open te staan, zodat een collega ze kan overnemen. Bel bij een dienst die binnen 2 uur begint ook even je shiftleider.</p>
            </ActieForm>
          </details>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 px-4 pt-4 text-center">
        {[["Opgebouwd", saldo.opgebouwd], ["Opgenomen", saldo.opgenomen], ["Over", saldo.saldo]].map(([l, w]) => (
          <div key={l} className="rounded-2xl border border-line bg-white py-2.5"><div className="text-xl font-bold text-navy-800">{w} u</div><div className="text-[11px] font-semibold uppercase tracking-wider text-muted">{l}</div></div>
        ))}
      </div>
      <p className="px-5 pt-1.5 text-[12px] text-muted">Vakantie-uren dit jaar, berekend op je contract ({saldo.weekuren} uur per week gemiddeld). Je loonstrook is leidend.</p>
      <Sectie titel="Verlof aanvragen">
        <ActieForm actie={vraagVerlofAan} knop="Aanvragen" variant="navy" succes="Aangevraagd. Je krijgt bericht als het is beoordeeld." reset>
          <select name="type" className={veld}><option value="vakantie">Vakantie</option><option value="bijzonder">Bijzonder verlof (bijv. examen, bruiloft)</option><option value="onbetaald">Onbetaald verlof</option></select>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[12px] text-muted">Van<input name="van" type="date" min={morgen} defaultValue={morgen} className={veld} /></label>
            <label className="text-[12px] text-muted">Tot en met<input name="tot" type="date" min={morgen} defaultValue={morgen} className={veld} /></label>
          </div>
          <input name="uren" type="number" step="0.5" placeholder="Aantal uur (optioneel)" className={veld} />
          <input name="opmerking" placeholder="Toelichting (optioneel)" className={veld} />
        </ActieForm>
      </Sectie>
      <Sectie titel="Mijn aanvragen">
        <Lijst>
          {lijst.filter((v) => v.type !== "ziek").reverse().map((v) => (
            <Rij key={v.id} toon={v.status === "goedgekeurd" ? "groen" : v.status === "afgewezen" ? "grijs" : "navy"} icoon={<Palmtree size={18} />}
              titel={<span className="capitalize">{v.type}</span>} sub={`${datum(v.van)}${v.tot && v.tot !== v.van ? ` – ${datum(v.tot)}` : ""}${v.uren ? ` · ${v.uren} uur` : ""}`}
              rechts={v.status === "aangevraagd" ? <form action={trekVerlofIn.bind(null, v.id)} className="flex items-center gap-2"><Label>Wacht</Label><button title="Intrekken" className="text-slate-400"><X size={16} /></button></form>
                : <Label toon={v.status === "goedgekeurd" ? "groen" : "grijs"}>{v.status}</Label>} />
          ))}
          {!lijst.some((v) => v.type !== "ziek") && <Rij titel="Nog geen aanvragen" />}
        </Lijst>
      </Sectie>
    </>
  );
}
