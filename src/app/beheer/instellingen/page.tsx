import Link from "next/link";
import { redirect } from "next/navigation";
import { ActieForm } from "@/components/actie-form";
import { SjabloonEditor } from "@/components/sjabloon-editor";
import { cx } from "@/components/ui";
import { mag } from "@/lib/access";
import { maakFranchisenemer, slaBeloningOp, slaPositieOp, slaSjabloonOp, slaVestigingOrgOp, slaWaardeOp } from "@/lib/acties-instellingen";
import { getDb } from "@/lib/db/client";
import * as t from "@/lib/db/schema";
import { vereisGebruiker } from "@/lib/session";
import { Blok, Kop } from "../beheer-ui";

const veld = "rounded-lg border border-line px-2.5 py-1.5 text-sm";

export default async function Instellingen({ searchParams }: PageProps<"/beheer/instellingen">) {
  const sp = await searchParams;
  const { u, org } = await vereisGebruiker();
  const magInst = mag(org, u, "instellingen", 1), magOrg = mag(org, u, "organisatie", 1);
  if (!magInst && !magOrg) redirect("/beheer");
  const kanInst = mag(org, u, "instellingen"), kanOrg = mag(org, u, "organisatie");
  const knop = (k: boolean) => (k ? "Opslaan" : "Alleen bekijken");
  const tabs = [...(magInst ? [["posities", "Posities"], ["waardering", "Kernwaarden en beloningen"], ["checklists", "Checklists en evaluaties"]] : []), ...(magOrg ? [["organisatie", "Franchisenemers en vestigingen"]] : [])];
  const tab = tabs.find(([k]) => k === sp.tab)?.[0] ?? tabs[0][0];
  const db = await getDb();
  const [pos, waarden, beloningen, sjablonen] = await Promise.all([
    db.select().from(t.positie).orderBy(t.positie.volgorde), db.select().from(t.waarde).orderBy(t.waarde.volgorde), db.select().from(t.beloning).orderBy(t.beloning.punten), db.select().from(t.checklistSjabloon),
  ]);
  const actiefSjabloon = sjablonen.find((s) => s.id === sp.s);

  return (
    <>
      <Kop titel="Instellingen" sub="Alles wat de app gebruikt en wat je zelf wilt kunnen aanpassen. Wijzigingen staan in het logboek." />
      <div className="mb-5 flex flex-wrap gap-1.5">
        {tabs.map(([k, l]) => <Link key={k} href={`/beheer/instellingen?tab=${k}`} className={cx("rounded-full px-3.5 py-1.5 text-sm font-semibold", tab === k ? "bg-navy-700 text-white" : "bg-white ring-1 ring-line")}>{l}</Link>)}
      </div>

      {tab === "posities" && (
        <Blok titel="Posities op de werkvloer">
          <p className="mb-3 text-[13px] text-muted">De minimumleeftijd is een harde regel: niemand die jonger is kan op deze positie worden ingepland, ook niet handmatig of door een open dienst te nemen.</p>
          <div className="space-y-2">
            {pos.map((p) => (
              <ActieForm key={p.id} actie={slaPositieOp.bind(null, p.id)} knop={knop(kanInst)} variant="licht" className="rounded-xl border border-line p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <input type="color" name="kleur" defaultValue={p.kleur} className="h-8 w-10 rounded" />
                  <input name="naam" defaultValue={p.naam} className={veld} />
                  <label className="flex items-center gap-1.5 text-sm text-muted">vanaf <input name="minLeeftijd" type="number" min={0} max={21} defaultValue={p.minLeeftijd} className={cx(veld, "w-16")} /> jaar</label>
                </div>
              </ActieForm>
            ))}
            {kanInst && <ActieForm actie={slaPositieOp.bind(null, null)} knop="Positie toevoegen" reset className="rounded-xl bg-slate-50 p-3">
              <div className="flex flex-wrap items-center gap-2"><input type="color" name="kleur" defaultValue="#2f56a6" className="h-8 w-10 rounded" /><input name="naam" placeholder="Nieuwe positie, bijv. Drive-in" className={veld} />
                <label className="flex items-center gap-1.5 text-sm text-muted">vanaf <input name="minLeeftijd" type="number" min={0} max={21} defaultValue={0} className={cx(veld, "w-16")} /> jaar</label></div>
            </ActieForm>}
          </div>
        </Blok>
      )}

      {tab === "waardering" && (
        <div className="grid gap-6 xl:grid-cols-2">
          <Blok titel="Kernwaarden">
            <div className="space-y-2">
              {waarden.map((w) => (
                <ActieForm key={w.id} actie={slaWaardeOp.bind(null, w.id)} knop={knop(kanInst)} variant="licht" className="rounded-xl border border-line p-3">
                  <div className="flex gap-2"><input name="emoji" defaultValue={w.emoji} className={cx(veld, "w-14 text-center")} /><input name="naam" defaultValue={w.naam} className={cx(veld, "flex-1")} /></div>
                  <input name="omschrijving" defaultValue={w.omschrijving} className={cx(veld, "w-full")} />
                </ActieForm>
              ))}
              {kanInst && <ActieForm actie={slaWaardeOp.bind(null, null)} knop="Kernwaarde toevoegen" reset className="rounded-xl bg-slate-50 p-3">
                <div className="flex gap-2"><input name="emoji" placeholder="🙂" className={cx(veld, "w-14 text-center")} /><input name="naam" placeholder="Naam" className={cx(veld, "flex-1")} /></div>
                <input name="omschrijving" placeholder="Wat betekent het in de praktijk?" className={cx(veld, "w-full")} />
              </ActieForm>}
            </div>
          </Blok>
          <Blok titel="Beloningscatalogus">
            <div className="space-y-2">
              {beloningen.map((b) => (
                <ActieForm key={b.id} actie={slaBeloningOp.bind(null, b.id)} knop={knop(kanInst)} variant="licht" className={cx("rounded-xl border p-3", b.actief ? "border-line" : "border-dashed border-slate-300 opacity-70")}>
                  <div className="flex gap-2"><input name="emoji" defaultValue={b.emoji} className={cx(veld, "w-14 text-center")} /><input name="titel" defaultValue={b.titel} className={cx(veld, "flex-1")} /><input name="punten" type="number" defaultValue={b.punten} className={cx(veld, "w-20")} /><span className="self-center text-sm text-muted">p</span></div>
                  <div className="flex gap-2"><input name="omschrijving" defaultValue={b.omschrijving} className={cx(veld, "flex-1")} /><label className="flex items-center gap-1 text-sm"><input type="checkbox" name="actief" defaultChecked={b.actief} /> In catalogus</label></div>
                </ActieForm>
              ))}
              {kanInst && <ActieForm actie={slaBeloningOp.bind(null, null)} knop="Beloning toevoegen" reset className="rounded-xl bg-slate-50 p-3">
                <div className="flex gap-2"><input name="emoji" placeholder="🎁" className={cx(veld, "w-14 text-center")} /><input name="titel" placeholder="Titel" className={cx(veld, "flex-1")} /><input name="punten" type="number" placeholder="100" className={cx(veld, "w-20")} /></div>
                <input name="omschrijving" placeholder="Omschrijving" className={cx(veld, "w-full")} />
              </ActieForm>}
            </div>
          </Blok>
        </div>
      )}

      {tab === "checklists" && (
        <div className="grid gap-6 xl:grid-cols-[1fr_2fr]">
          <Blok titel="Checklists">
            <div className="divide-y divide-line">
              {sjablonen.map((s) => (
                <Link key={s.id} href={`/beheer/instellingen?tab=checklists&s=${s.id}`} className={cx("flex items-center justify-between py-2 text-sm", s.id === sp.s && "font-semibold text-navy-700")}>
                  <span>{s.titel} <span className="text-[12px] text-muted">· {s.soort} · v{s.versie}</span></span>{!s.actief && <span className="text-[11px] text-muted">inactief</span>}
                </Link>
              ))}
              {kanInst && <Link href="/beheer/instellingen?tab=checklists&s=nieuw" className="block py-2 text-sm font-semibold text-navy-600">+ Nieuwe checklist</Link>}
            </div>
          </Blok>
          <Blok titel={actiefSjabloon ? `${actiefSjabloon.titel} bewerken` : sp.s === "nieuw" ? "Nieuwe checklist" : "Kies een checklist"}>
            {actiefSjabloon ? <SjabloonEditor key={actiefSjabloon.id} actie={slaSjabloonOp.bind(null, actiefSjabloon.id)} begin={actiefSjabloon} alleenLezen={!kanInst} />
              : sp.s === "nieuw" ? <SjabloonEditor key="nieuw" actie={slaSjabloonOp.bind(null, null)} />
              : <p className="text-sm text-muted">Kies links een checklist om de vragen, knock-outs en weging aan te passen. Elke wijziging wordt een nieuwe versie; eerdere uitvoeringen houden hun eigen versie.</p>}
          </Blok>
        </div>
      )}

      {tab === "organisatie" && (
        <div className="grid gap-6 xl:grid-cols-2">
          <Blok titel="Franchisenemers">
            <div className="mb-3 divide-y divide-line text-sm">
              {org.franchisenemers.map((f) => <div key={f.id} className="flex justify-between py-1.5"><span className="font-medium">{f.naam}</span><span className="text-muted">{org.regio.find((r) => r.id === f.regioId)?.naam} · {org.vestigingen.filter((v) => v.franchisenemerId === f.id).length} vestigingen</span></div>)}
            </div>
            {kanOrg && <ActieForm actie={maakFranchisenemer} knop="Franchisenemer toevoegen" reset className="rounded-xl bg-slate-50 p-3">
              <div className="flex gap-2"><input name="naam" placeholder="Bedrijfsnaam" className={cx(veld, "flex-1")} /><select name="regio" className={veld}>{org.regio.map((r) => <option key={r.id} value={r.id}>{r.naam}</option>)}</select></div>
              <p className="text-[12px] text-muted">De franchisenemer zelf voeg je daarna toe als persoon met de rol Franchisenemer.</p>
            </ActieForm>}
          </Blok>
          <Blok titel="Vestigingen">
            <div className="space-y-2">
              {org.vestigingen.map((v) => (
                <ActieForm key={v.id} actie={slaVestigingOrgOp.bind(null, v.id)} knop={knop(kanOrg)} variant="licht" className="rounded-xl border border-line p-3">
                  <div className="grid gap-2 md:grid-cols-3"><input name="naam" defaultValue={v.naam} className={veld} /><input name="plaats" defaultValue={v.plaats} className={veld} />
                    <select name="franchisenemer" defaultValue={v.franchisenemerId} className={veld}>{org.franchisenemers.map((f) => <option key={f.id} value={f.id}>{f.naam}</option>)}</select></div>
                  <input name="adres" placeholder="Adres" className={cx(veld, "w-full")} />
                </ActieForm>
              ))}
              {kanOrg && <ActieForm actie={slaVestigingOrgOp.bind(null, null)} knop="Vestiging toevoegen" reset className="rounded-xl bg-slate-50 p-3">
                <div className="grid gap-2 md:grid-cols-3"><input name="naam" placeholder="Naam" className={veld} /><input name="plaats" placeholder="Plaats" className={veld} />
                  <select name="franchisenemer" className={veld}>{org.franchisenemers.map((f) => <option key={f.id} value={f.id}>{f.naam}</option>)}</select></div>
                <input name="adres" placeholder="Adres" className={cx(veld, "w-full")} />
                <p className="text-[12px] text-muted">Een nieuwe vestiging krijgt automatisch een teamchat. Daarna stel je openingstijden en bezetting in bij Vestigingen.</p>
              </ActieForm>}
            </div>
          </Blok>
        </div>
      )}
    </>
  );
}
