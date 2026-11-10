import { Award, CheckCircle2 } from "lucide-react";
import { TYPE_ICOON, TYPE_LABEL } from "@/components/leren";
import { Kaart, Leeg, Lijst, PageTop, Rij, Sectie, Segmenten, Voortgang } from "@/components/ui";
import { functieVan, leerItemsVoor, onboarding, voortgangVan } from "@/lib/data";
import { vereisGebruiker } from "@/lib/session";

export default async function Leren({ searchParams }: PageProps<"/app/leren">) {
  const { tab = "voor-jou" } = await searchParams;
  const { u, org } = await vereisGebruiker();
  const [items, vg] = await Promise.all([leerItemsVoor(u), voortgangVan(u.id)]);
  const ob = await onboarding(u, items, vg);
  const status = (id: string) => vg.get(id)?.status;
  const open = items.filter((i) => status(i.id) !== "afgerond");
  const klaar = items.filter((i) => status(i.id) === "afgerond");
  const deadline = new Date(new Date(u.inDienstSinds).getTime() + 42 * 86400000);

  return (
    <>
      <PageTop titel="Leren" sub={functieVan(org, u)?.naam ?? "Voor jouw rol"} />
      <Segmenten actief={tab === "afgerond" ? "Afgerond" : "Voor jou"} items={[{ label: "Voor jou", href: "/app/leren" }, { label: "Afgerond", href: "/app/leren?tab=afgerond" }]} />

      {tab !== "afgerond" ? (
        <>
          {ob.klaar < ob.totaal && (
            <div className="px-4 pt-4">
              <Kaart>
                <div className="flex items-baseline justify-between"><div className="font-semibold">Onboarding</div><div className="text-[13px] text-muted">{ob.klaar} van {ob.totaal}</div></div>
                <Voortgang pct={ob.pct} />
                {deadline > new Date() && <div className="mt-2 text-[12px] text-muted">Afronden voor {deadline.toLocaleDateString("nl-NL", { day: "numeric", month: "long" })}</div>}
              </Kaart>
            </div>
          )}
          <Sectie titel="Volgende stap">
            {open.length ? (
              <Lijst>
                {open.map((i) => {
                  const I = TYPE_ICOON[i.type];
                  const s = status(i.id);
                  return <Rij key={i.id} href={`/app/leren/${i.id}`} toon={i.type === "challenge" ? "rood" : "navy"} icoon={<I size={18} />} titel={i.titel}
                    sub={s === "ingediend" ? "Ingediend · wacht op beoordeling" : s === "afgekeurd" ? "Nog niet goed · probeer opnieuw" : `${TYPE_LABEL[i.type]} · ${i.duurMin} min${i.onboarding ? " · onboarding" : ""}`} />;
                })}
              </Lijst>
            ) : <Leeg><Award className="mx-auto mb-1 text-navy-600" /> Alles afgerond. Goed bezig!</Leeg>}
          </Sectie>
        </>
      ) : (
        <Sectie>
          {klaar.length ? (
            <Lijst>{klaar.map((i) => <Rij key={i.id} href={`/app/leren/${i.id}`} toon="groen" icoon={<CheckCircle2 size={18} />} titel={i.titel} sub={`${TYPE_LABEL[i.type]} · afgerond`} />)}</Lijst>
          ) : <Leeg>Nog niets afgerond.</Leeg>}
        </Sectie>
      )}
    </>
  );
}
