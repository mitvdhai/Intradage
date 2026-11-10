import { redirect } from "next/navigation";
import { ActieForm } from "@/components/actie-form";
import { mag, scopeVestigingen } from "@/lib/access";
import { voegMedewerkerToe } from "@/lib/personeel/acties";
import { vandaagIso } from "@/lib/personeel/data";
import { vereisGebruiker } from "@/lib/session";
import { Blok, Kop } from "../../beheer-ui";

const veld = "w-full rounded-lg border border-line px-3 py-2 text-sm";
const label = "mb-1 block text-[12px] font-semibold uppercase tracking-wide text-muted";

export default async function NieuweMedewerker() {
  const { u, org } = await vereisGebruiker();
  if (!mag(org, u, "medewerkers")) redirect("/beheer/personeel");
  const vest = org.vestigingen.filter((v) => scopeVestigingen(org, u).includes(v.id));
  const v = new Date(`${vandaagIso()}T12:00:00`); v.setDate(v.getDate() + ((8 - v.getDay()) % 7 || 7));
  const maandag = v.toISOString().slice(0, 10);
  return (
    <>
      <Kop titel="Medewerker toevoegen" sub="Voor wie niet via een vacature binnenkomt: een herintreder, een overname of iemand via via. Kandidaten van vacatures neem je aan vanuit Werving." />
      <Blok>
        <ActieForm actie={voegMedewerkerToe} knop="Toevoegen en preboarding starten" variant="rood" className="max-w-3xl">
          <div className="grid gap-3 md:grid-cols-2">
            <div><span className={label}>Voornaam</span><input name="voornaam" className={veld} /></div>
            <div><span className={label}>Achternaam</span><input name="achternaam" className={veld} /></div>
            <div><span className={label}>Mobiel</span><input name="mobiel" placeholder="06 12345678" className={veld} /></div>
            <div><span className={label}>E-mail (optioneel)</span><input name="email" type="email" className={veld} /></div>
            <div><span className={label}>Geboortedatum</span><input name="geboortedatum" type="date" className={veld} /></div>
            <div><span className={label}>Vestiging</span><select name="vestiging" className={veld}>{vest.map((x) => <option key={x.id} value={x.id}>{x.naam}</option>)}</select></div>
            <div><span className={label}>Functie</span><select name="functie" defaultValue="f-medewerker" className={veld}>{org.functies.map((f) => <option key={f.id} value={f.id}>{f.naam}</option>)}</select></div>
            <div><span className={label}>Rol in de app</span><select name="rol" className={veld}><option value="medewerker">Medewerker</option><option value="shiftleider">Shiftleider</option>{["hq", "franchisenemer"].includes(u.rol) && <option value="manager">Manager</option>}</select></div>
          </div>
          <hr className="border-line" />
          <div className="grid gap-3 md:grid-cols-3">
            <div><span className={label}>Eerste werkdag</span><input name="start" type="date" defaultValue={maandag} className={veld} /></div>
            <div><span className={label}>Contract</span><select name="type" defaultValue="minmax" className={veld}><option value="oproep">0-urencontract</option><option value="minmax">Min-maxcontract</option><option value="vast">Vast aantal uren</option></select></div>
            <div><span className={label}>Duur</span><select name="maanden" defaultValue="12" className={veld}><option value="6">6 maanden</option><option value="12">12 maanden</option><option value="0">Onbepaalde tijd</option></select></div>
            <div><span className={label}>Min. uren/week</span><input name="urenMin" type="number" defaultValue={8} className={veld} /></div>
            <div><span className={label}>Max. uren/week</span><input name="urenMax" type="number" defaultValue={16} className={veld} /></div>
            <div><span className={label}>Bruto uurloon (€)</span><input name="uurloon" type="number" step="0.01" defaultValue={14.99} className={veld} /></div>
          </div>
          <p className="text-[12px] text-muted">Daarna gaat het net als bij aannemen via werving: de nieuwe collega krijgt een startlink om gegevens, ID, beschikbaarheid en het contract in te vullen en te tekenen. Posities worden alleen toegekend als de leeftijd het toelaat.</p>
        </ActieForm>
      </Blok>
    </>
  );
}
