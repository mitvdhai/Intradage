import { notFound } from "next/navigation";
import { Camera, CheckCircle2, FileText, PlayCircle, Target } from "lucide-react";
import { TYPE_LABEL } from "@/components/leren";
import { Quiz } from "@/components/quiz";
import { Kaart, Knop, Lijst, PageTop, Rij, Sectie } from "@/components/ui";
import { dienChallengeIn, rondLeerItemAf } from "@/lib/acties";
import { leerItemsVoor, voornaamVan, voortgangVan } from "@/lib/data";
import { vereisGebruiker } from "@/lib/session";
import { db } from "@/lib/store";

export default async function LeerItemPagina({ params }: PageProps<"/app/leren/[id]">) {
  const { id } = await params;
  const u = await vereisGebruiker();
  const item = leerItemsVoor(u).find((i) => i.id === id);
  if (!item) notFound();
  const v = voortgangVan(u.id, item.id);
  const doc = item.handboekDocId ? db.handboek.find((d) => d.id === item.handboekDocId) : undefined;
  const profielItem = item.profielItemId ? db.profielItems.find((p) => p.id === item.profielItemId) : undefined;
  const inFunctie = profielItem && db.functies.find((f) => f.id === u.functieId)?.profiel.find((r) => r.itemId === profielItem.id);

  return (
    <>
      <PageTop terug={{ href: "/app/leren", label: "Leren" }} titel={item.titel} sub={`${TYPE_LABEL[item.type]} · ${item.duurMin} min`} />

      {item.type === "video" && (
        <div className="mx-4 mt-4 grid aspect-video place-items-center rounded-2xl bg-gradient-to-br from-navy-700 to-navy-900 text-white">
          <PlayCircle size={52} strokeWidth={1.5} />
        </div>
      )}

      <Sectie>
        <Kaart><p className="text-[15px] leading-relaxed">{item.inhoud}</p></Kaart>
      </Sectie>

      {inFunctie && (
        <Sectie titel="Waarom dit telt">
          <Lijst><Rij href="/app/werk/functie" icoon={<Target size={18} />} titel={profielItem!.naam} sub={`Onderdeel van jouw functieprofiel · weging ${inFunctie.weging}%`} /></Lijst>
        </Sectie>
      )}

      <Sectie>
        {v?.status === "afgerond" ? (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            <CheckCircle2 size={18} /> Afgerond{v.beoordeeldDoor ? ` · goedgekeurd door ${voornaamVan(v.beoordeeldDoor)}` : ""}{v.feedback ? ` · "${v.feedback}"` : ""}
          </div>
        ) : item.type === "quiz" && item.quiz ? (
          <Quiz itemId={item.id} vragen={item.quiz.map(({ vraag, opties }) => ({ vraag, opties }))} />
        ) : item.type === "challenge" ? (
          v?.status === "ingediend" ? (
            <div className="rounded-xl bg-navy-50 px-4 py-3 text-sm font-medium text-navy-800">Ingediend. Je franchisenemer beoordeelt je inzending.</div>
          ) : (
            <form action={dienChallengeIn.bind(null, item.id)} className="space-y-3">
              {v?.status === "afgekeurd" && <div className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-700">Feedback: {v.feedback || "Probeer het nog eens."}</div>}
              <label className="tap flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-navy-200 bg-white py-6 text-sm font-semibold text-navy-700">
                <Camera size={20} /> Foto maken of kiezen
                <input type="file" accept="image/*" capture="environment" className="sr-only" />
              </label>
              <input name="inzending" placeholder="Toelichting (optioneel)" className="tap w-full rounded-xl border border-line bg-white px-3 text-[15px]" />
              <Knop>Indienen</Knop>
            </form>
          )
        ) : (
          <form action={rondLeerItemAf.bind(null, item.id)}><Knop variant="navy"><CheckCircle2 size={18} /> Markeer als afgerond</Knop></form>
        )}
      </Sectie>

      {doc && (
        <Sectie titel="Meer weten">
          <Lijst><Rij href={`/app/handboek/${doc.id}`} icoon={<FileText size={18} />} titel={doc.titel} sub="Handboek" /></Lijst>
        </Sectie>
      )}
    </>
  );
}
