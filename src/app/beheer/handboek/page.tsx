import Link from "next/link";
import { redirect } from "next/navigation";
import { ActieForm } from "@/components/actie-form";
import { cx } from "@/components/ui";
import { mag } from "@/lib/access";
import { slaHandboekDocOp } from "@/lib/acties-instellingen";
import { getDb } from "@/lib/db/client";
import * as t from "@/lib/db/schema";
import { vereisGebruiker } from "@/lib/session";
import { Blok, Kop } from "../beheer-ui";

const veld = "rounded-lg border border-line px-2.5 py-1.5 text-sm";
const DISC = ["operations", "marketing", "hr", "inkoop", "kwaliteit"] as const;
const ROLLEN = [["medewerker", "Medewerker"], ["shiftleider", "Shiftleider"], ["manager", "Manager"], ["franchisenemer", "Franchisenemer"]] as const;
const dag = (d: Date) => d.toISOString().slice(0, 10);

export default async function HandboekBeheer({ searchParams }: PageProps<"/beheer/handboek">) {
  const sp = await searchParams;
  const { u, org } = await vereisGebruiker();
  if (!mag(org, u, "handboek", 1)) redirect("/beheer");
  const kan = mag(org, u, "handboek");
  const db = await getDb();
  const docs = await db.select().from(t.handboekDoc).orderBy(t.handboekDoc.titel);
  const nu = new Date();
  const doc = docs.find((d) => d.id === sp.d);
  const nieuw = sp.d === "nieuw";
  const toon = doc || nieuw;
  return (
    <>
      <Kop titel="Handboek" sub="De bron voor de assistent en voor 'Lees en bevestig'. Elke wijziging krijgt een nieuw versienummer." />
      <div className="grid gap-6 xl:grid-cols-[1fr_2fr]">
        <Blok titel={`Documenten (${docs.length})`}>
          <div className="divide-y divide-line">
            {docs.map((d) => (
              <Link key={d.id} href={`/beheer/handboek?d=${d.id}`} className={cx("flex items-center justify-between gap-2 py-2 text-sm", d.id === sp.d && "font-semibold text-navy-700")}>
                <span>{d.titel} <span className="text-[12px] text-muted">v{d.versie} · {d.eigenaar}</span></span>
                {d.reviewVoor < nu && <span className="rounded-full bg-amber-100 px-2 text-[11px] font-semibold text-amber-800">review verlopen</span>}
              </Link>
            ))}
            {kan && <Link href="/beheer/handboek?d=nieuw" className="block py-2 text-sm font-semibold text-navy-600">+ Nieuw document</Link>}
          </div>
        </Blok>
        <Blok titel={doc ? `${doc.titel} · v${doc.versie}` : nieuw ? "Nieuw document" : "Kies een document"}>
          {!toon ? <p className="text-sm text-muted">Kies links een document. Verlopen reviews staan gemarkeerd: loop ze na en sla op, dan schuift de reviewdatum mee.</p> : (
            <ActieForm key={doc?.id ?? "nieuw"} actie={slaHandboekDocOp.bind(null, doc?.id ?? null)} knop={kan ? (doc ? "Opslaan" : "Document toevoegen") : "Alleen bekijken"}>
              <input name="titel" defaultValue={doc?.titel} placeholder="Titel" className={cx(veld, "w-full font-semibold")} />
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <label className="flex items-center gap-1.5">Eigenaar <select name="eigenaar" defaultValue={doc?.eigenaar ?? "operations"} className={veld}>{DISC.map((d) => <option key={d}>{d}</option>)}</select></label>
                <label className="flex items-center gap-1.5">Review vóór <input type="date" name="review" defaultValue={dag(doc?.reviewVoor ?? new Date(nu.getTime() + 365 * 864e5))} className={veld} /></label>
                {doc && <label className="flex items-center gap-1.5"><input type="checkbox" name="groot" /> Grote wijziging (nieuwe hoofdversie)</label>}
              </div>
              <textarea name="inhoud" defaultValue={doc?.inhoud} rows={16} placeholder="De instructie. Gebruik korte stappen; de assistent citeert hieruit." className={cx(veld, "w-full font-mono text-[13px]")} />
              <div className="text-sm"><span className="text-muted">Voor wie (leeg = iedereen):</span>
                <div className="mt-1 flex flex-wrap gap-3">{ROLLEN.map(([r, l]) => <label key={r} className="flex items-center gap-1"><input type="checkbox" name="rol" value={r} defaultChecked={doc?.doelgroep.rollen?.includes(r)} /> {l}</label>)}</div>
                <div className="mt-1 flex flex-wrap gap-3">{org.functies.map((f) => <label key={f.id} className="flex items-center gap-1 text-[13px]"><input type="checkbox" name="functie" value={f.id} defaultChecked={doc?.doelgroep.functieIds?.includes(f.id)} /> {f.naam}</label>)}</div>
              </div>
            </ActieForm>
          )}
        </Blok>
      </div>
    </>
  );
}
