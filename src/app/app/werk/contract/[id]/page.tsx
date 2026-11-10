import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { ActieForm, Handtekening, HandtekeningWeergave } from "@/components/actie-form";
import { Kaart, PageTop } from "@/components/ui";
import { tekenContract } from "@/lib/personeel/acties";
import { contract } from "@/lib/personeel/data";
import { vereisGebruiker } from "@/lib/session";

export default async function MijnContract({ params }: PageProps<"/app/werk/contract/[id]">) {
  const { id } = await params;
  const { u } = await vereisGebruiker();
  const c = await contract(id);
  if (!c || c.gebruikerId !== u.id) notFound();
  return (
    <>
      <PageTop terug={{ href: "/app/werk/documenten", label: "Documenten" }} titel={`Contract ${c.volgnummer}`} sub={c.status === "getekend" ? "Getekend door jou en je werkgever" : c.ondertekendWerknemer ? "Jij hebt getekend · wacht op je werkgever" : "Lees het rustig door en teken onderaan"} />
      <div className="space-y-4 px-4 pt-4">
        <Kaart><pre className="whitespace-pre-wrap font-sans text-[14px] leading-relaxed">{c.tekst}</pre></Kaart>
        {c.ondertekendWerknemer ? (
          <Kaart className="border-emerald-200 bg-emerald-50">
            <div className="flex items-center gap-2 font-semibold text-emerald-800"><CheckCircle2 size={18} /> Getekend op {c.ondertekendWerknemer.toLocaleString("nl-NL", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</div>
            {c.handtekeningWerknemer && <HandtekeningWeergave pad={c.handtekeningWerknemer} />}
          </Kaart>
        ) : c.status === "ter-ondertekening" && (
          <Kaart>
            <ActieForm actie={tekenContract.bind(null, c.id)} knop="Contract tekenen" variant="rood" succes="Getekend! Je werkgever tekent nu ook.">
              <label className="flex items-start gap-2.5 text-[14px]"><input type="checkbox" name="akkoord" className="mt-0.5 h-5 w-5 accent-navy-700" /> Ik heb het contract gelezen en ga akkoord.</label>
              <Handtekening />
              <p className="text-[12px] text-muted">Je handtekening wordt met tijdstip en een vingerafdruk van de tekst vastgelegd. Je vindt het getekende contract daarna bij Documenten.</p>
            </ActieForm>
          </Kaart>
        )}
      </div>
    </>
  );
}
