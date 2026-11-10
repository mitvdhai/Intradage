import Link from "next/link";
import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { ActieForm, Handtekening, HandtekeningWeergave } from "@/components/actie-form";
import { isHQ } from "@/lib/access";
import { tekenAlsWerkgever, trekContractIn } from "@/lib/personeel/acties";
import { contract, magDossier, medewerker } from "@/lib/personeel/data";
import { vereisGebruiker } from "@/lib/session";
import { Blok, Kop } from "../../../../beheer-ui";

const tijd = (d: Date | null) => d ? d.toLocaleString("nl-NL", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) : null;

export default async function ContractPagina({ params }: PageProps<"/beheer/personeel/[id]/contract/[cid]">) {
  const { id, cid } = await params;
  const { u, org } = await vereisGebruiker();
  const [m, c] = await Promise.all([medewerker(id), contract(cid)]);
  if (!m || !c || c.gebruikerId !== id || !magDossier(org, u, m)) notFound();
  const ondertekenaar = org.gebruikers.find((g) => g.id === c.werkgeverOndertekenaarId);
  const magTekenen = (u.rol === "franchisenemer" || isHQ(u)) && c.status === "ter-ondertekening" && !c.ondertekendWerkgever;

  return (
    <>
      <Kop titel={`Contract ${c.volgnummer} · ${m.voornaam} ${m.achternaam}`} sub={c.status === "getekend" ? "Getekend door beide partijen" : c.status === "ter-ondertekening" ? "Wacht op handtekening" : c.status}
        rechts={<Link href={`/beheer/personeel/${id}`} className="text-sm font-semibold text-navy-600">← Dossier</Link>} />
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Blok titel="Arbeidsovereenkomst">
          <pre className="whitespace-pre-wrap font-sans text-[13.5px] leading-relaxed">{c.tekst}</pre>
          <div className="mt-6 grid gap-6 border-t border-line pt-4 md:grid-cols-2">
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-wider text-muted">Werknemer</div>
              {c.handtekeningWerknemer ? <HandtekeningWeergave pad={c.handtekeningWerknemer} /> : <div className="my-4 text-sm text-muted">Nog niet getekend</div>}
              <div className="text-sm">{m.voornaam} {m.achternaam}</div>
              <div className="text-[12px] text-muted">{tijd(c.ondertekendWerknemer) ?? ""}</div>
            </div>
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-wider text-muted">Werkgever</div>
              {c.handtekeningWerkgever ? <HandtekeningWeergave pad={c.handtekeningWerkgever} /> : <div className="my-4 text-sm text-muted">Nog niet getekend</div>}
              <div className="text-sm">{ondertekenaar ? `${ondertekenaar.voornaam} ${ondertekenaar.achternaam}` : ""}</div>
              <div className="text-[12px] text-muted">{tijd(c.ondertekendWerkgever) ?? ""}</div>
            </div>
          </div>
        </Blok>
        <div className="space-y-6">
          {magTekenen && (
            <Blok titel="Tekenen als werkgever">
              {!c.ondertekendWerknemer && <p className="mb-3 rounded-lg bg-amber-50 p-2.5 text-[13px] text-amber-800">{m.voornaam} heeft nog niet getekend. Je kunt alvast tekenen; het contract is rond zodra beide handtekeningen staan.</p>}
              <ActieForm actie={tekenAlsWerkgever.bind(null, c.id)} knop="Contract tekenen" variant="rood" succes="Getekend.">
                <Handtekening label={`Teken als ${u.voornaam} ${u.achternaam}, namens de werkgever`} />
              </ActieForm>
            </Blok>
          )}
          <Blok titel="Vastlegging">
            <dl className="space-y-2 text-[13px]">
              <div><dt className="text-muted">Vingerafdruk (SHA-256) van de tekst</dt><dd className="break-all font-mono text-[11px]">{c.documentHash}</dd></div>
              <div><dt className="text-muted">Opgesteld</dt><dd>{tijd(c.aangemaakt)}</dd></div>
            </dl>
            <p className="mt-3 flex gap-2 text-[12px] text-muted"><ShieldCheck size={16} className="shrink-0 text-navy-600" /> Een elektronische handtekening is rechtsgeldig voor een arbeidsovereenkomst. We leggen per handtekening tijdstip, ondertekenaar en de vingerafdruk van de tekst vast in het logboek; als de tekst daarna wijzigt, past de vingerafdruk niet meer.</p>
          </Blok>
          {c.status === "ter-ondertekening" && (
            <form action={trekContractIn.bind(null, c.id)}><button className="text-sm font-semibold text-muted underline">Contractvoorstel intrekken</button></form>
          )}
        </div>
      </div>
    </>
  );
}
