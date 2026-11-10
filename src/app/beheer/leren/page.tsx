import Link from "next/link";
import { redirect } from "next/navigation";
import { ActieForm } from "@/components/actie-form";
import { cx } from "@/components/ui";
import { mag } from "@/lib/access";
import { slaLeerItemOp } from "@/lib/acties-instellingen";
import { getDb } from "@/lib/db/client";
import * as t from "@/lib/db/schema";
import { vereisGebruiker } from "@/lib/session";
import { Blok, Kop } from "../beheer-ui";

const veld = "rounded-lg border border-line px-2.5 py-1.5 text-sm";
const TYPES = [["module", "Module"], ["video", "Video"], ["quiz", "Quiz"], ["challenge", "Challenge"]] as const;

export default async function LerenBeheer({ searchParams }: PageProps<"/beheer/leren">) {
  const sp = await searchParams;
  const { u, org } = await vereisGebruiker();
  if (!mag(org, u, "leren", 1)) redirect("/beheer");
  const kan = mag(org, u, "leren");
  const db = await getDb();
  const [items, voortgang] = await Promise.all([db.select().from(t.leerItem).orderBy(t.leerItem.titel), db.select().from(t.leerVoortgang)]);
  const item = items.find((i) => i.id === sp.i);
  const nieuw = sp.i === "nieuw";
  const quizTekst = item?.quiz?.map((q) => `${q.vraag} || ${q.opties.map((o, k) => (k === q.juist ? `*${o}` : o)).join(" | ")}`).join("\n") ?? "";
  return (
    <>
      <Kop titel="Leren" sub="Modules, video's, quizzen en challenges. Vink 'onboarding' aan om een item in het startprogramma van nieuwe collega's te zetten." />
      <div className="grid gap-6 xl:grid-cols-[1fr_2fr]">
        <Blok titel={`Leeritems (${items.length})`}>
          <div className="divide-y divide-line">
            {items.map((i) => (
              <Link key={i.id} href={`/beheer/leren?i=${i.id}`} className={cx("flex items-center justify-between gap-2 py-2 text-sm", i.id === sp.i && "font-semibold text-navy-700")}>
                <span>{i.titel} <span className="text-[12px] text-muted">{i.type} · {i.duurMin} min{i.onboarding ? " · onboarding" : ""}</span></span>
                <span className="text-[12px] text-muted">{voortgang.filter((v) => v.itemId === i.id).length} gestart</span>
              </Link>
            ))}
            {kan && <Link href="/beheer/leren?i=nieuw" className="block py-2 text-sm font-semibold text-navy-600">+ Nieuw leeritem</Link>}
          </div>
        </Blok>
        <Blok titel={item ? item.titel : nieuw ? "Nieuw leeritem" : "Kies een leeritem"}>
          {!(item || nieuw) ? <p className="text-sm text-muted">Kies links een item om het aan te passen.</p> : (
            <ActieForm key={item?.id ?? "nieuw"} actie={slaLeerItemOp.bind(null, item?.id ?? null)} knop={kan ? (item ? "Opslaan" : "Toevoegen") : "Alleen bekijken"}>
              <div className="grid gap-2 md:grid-cols-[1fr_140px_100px]">
                <input name="titel" defaultValue={item?.titel} placeholder="Titel" className={cx(veld, "font-semibold")} />
                <select name="type" defaultValue={item?.type ?? "module"} className={veld}>{TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                <label className="flex items-center gap-1 text-sm"><input name="duur" type="number" min={1} defaultValue={item?.duurMin ?? 5} className={cx(veld, "w-16")} /> min</label>
              </div>
              <textarea name="inhoud" defaultValue={item?.inhoud} rows={8} placeholder="Uitleg, script of link naar de video" className={cx(veld, "w-full")} />
              <div>
                <p className="mb-1 text-[13px] text-muted">Quiz (alleen bij soort Quiz). Eén vraag per regel; zet een * voor het goede antwoord:<br /><code className="text-[12px]">Hoe warm moet de frituur zijn? || 160 °C | *175 °C | 200 °C</code></p>
                <textarea name="quiz" defaultValue={quizTekst} rows={5} className={cx(veld, "w-full font-mono text-[13px]")} />
              </div>
              <div className="text-sm"><label className="flex items-center gap-1.5 font-medium"><input type="checkbox" name="onboarding" defaultChecked={item?.onboarding} /> Onderdeel van onboarding</label>
                <p className="mt-2 text-muted">Voor welke functies (leeg = iedereen):</p>
                <div className="mt-1 flex flex-wrap gap-3">{org.functies.map((f) => <label key={f.id} className="flex items-center gap-1 text-[13px]"><input type="checkbox" name="functie" value={f.id} defaultChecked={item?.functieIds.includes(f.id)} /> {f.naam}</label>)}</div>
              </div>
            </ActieForm>
          )}
        </Blok>
      </div>
    </>
  );
}
