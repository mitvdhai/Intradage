import { BarChart3, CheckCircle2, Lightbulb, MessageSquareHeart, Vote } from "lucide-react";
import { Label, Leeg, Lijst, PageTop, Rij, Sectie } from "@/components/ui";
import { enquetesVoor } from "@/lib/betrokkenheid";
import { vereisGebruiker } from "@/lib/session";

const ICOON = { poll: Vote, pulse: MessageSquareHeart, enps: BarChart3, survey: MessageSquareHeart, idee: Lightbulb };
const TYPE = { poll: "Poll", pulse: "Korte vraag", enps: "Kwartaalvraag", survey: "Enquête", idee: "Ideeënbox" };

export default async function Enquetes() {
  const { u, org } = await vereisGebruiker();
  const lijst = await enquetesVoor(org, u);
  const open = lijst.filter((e) => e.open && (!e.gedaan || e.type === "idee"));
  const klaar = lijst.filter((e) => !open.includes(e));
  return (
    <>
      <PageTop terug={{ href: "/app/meer", label: "Meer" }} titel="Enquêtes" sub="Jouw mening telt. Anonieme vragen blijven echt anoniem." />
      <Sectie titel="Open">
        {open.length ? (
          <Lijst>
            {open.map((e) => { const I = ICOON[e.type]; return <Rij key={e.id} href={`/app/enquetes/${e.id}`} toon={e.type === "idee" ? "navy" : "rood"} icoon={<I size={18} />} titel={e.titel} sub={`${TYPE[e.type]}${e.anoniem ? " · anoniem" : ""}${e.sluit ? ` · tot ${e.sluit.toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}` : ""}`} />; })}
          </Lijst>
        ) : <Leeg>Je hebt alles ingevuld. Dank je wel!</Leeg>}
      </Sectie>
      {klaar.length > 0 && (
        <Sectie titel="Ingevuld of gesloten">
          <Lijst>
            {klaar.map((e) => { const I = ICOON[e.type]; return <Rij key={e.id} href={`/app/enquetes/${e.id}`} toon="grijs" icoon={<I size={18} />} titel={e.titel} sub={TYPE[e.type]} rechts={e.gedaan ? <Label toon="groen"><CheckCircle2 size={12} className="mr-1" /> Ingevuld</Label> : <Label toon="grijs">Gesloten</Label>} />; })}
          </Lijst>
        </Sectie>
      )}
    </>
  );
}
