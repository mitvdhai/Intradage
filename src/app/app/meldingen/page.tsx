import { Cake, Repeat, Star } from "lucide-react";
import { TE_DOEN_ICOON as ICOON } from "@/components/te-doen";
import { Leeg, Lijst, PageTop, Rij, Sectie, Segmenten, tijdLabel } from "@/components/ui";
import { feedbackVoor, leerItemsVoor, ruilverzoeken, teDoen, verjaardagenBinnenkort, voornaamVan } from "@/lib/data";
import { vereisGebruiker } from "@/lib/session";


export default async function Meldingen({ searchParams }: PageProps<"/app/meldingen">) {
  const { filter } = await searchParams;
  const alleenVerplicht = filter === "verplicht";
  const { u, org } = await vereisGebruiker();
  const [alleTaken, feedback, ruilen, items] = await Promise.all([teDoen(org, u), feedbackVoor(u.id), ruilverzoeken(), leerItemsVoor(u)]);
  const taken = alleTaken.filter((t) => !alleenVerplicht || t.urgent);
  const ruil = ruilen.filter((r) => (r.aangebodenDoor === u.id || r.overgenomenDoor === u.id) && r.status !== "open");
  const jarig = verjaardagenBinnenkort(org, u).filter((j) => j.g.id !== u.id);

  return (
    <>
      <PageTop terug={{ href: "/app", label: "Home" }} titel="Meldingen" />
      <Segmenten actief={alleenVerplicht ? "Verplicht" : "Alles"} items={[{ label: "Alles", href: "/app/meldingen" }, { label: "Verplicht", href: "/app/meldingen?filter=verplicht" }]} />
      <Sectie titel="Actie nodig">
        {taken.length ? (
          <Lijst>
            {taken.map((t) => { const I = ICOON[t.soort]; return <Rij key={t.id} href={t.href} toon={t.urgent ? "rood" : "navy"} icoon={<I size={18} />} titel={t.titel} sub={t.sub} />; })}
          </Lijst>
        ) : <Leeg>Niets meer te doen.</Leeg>}
      </Sectie>
      {!alleenVerplicht && (feedback.length > 0 || ruil.length > 0 || jarig.length > 0) && (
        <Sectie titel="Ter info">
          <Lijst>
            {feedback.map((v) => {
              const item = items.find((i) => i.id === v.itemId);
              return <Rij key={v.itemId} href={`/app/leren/${v.itemId}`} icoon={<Star size={18} />} titel={`${item?.titel}: ${v.status === "afgerond" ? "goedgekeurd" : "nog niet goed"}`} sub={`${voornaamVan(org, v.beoordeeldDoor!)} · ${tijdLabel(v.tijd)}${v.feedback ? ` · "${v.feedback}"` : ""}`} />;
            })}
            {ruil.map((r) => <Rij key={r.id} icoon={<Repeat size={18} />} titel={`Ruil ${r.status === "goedgekeurd" ? "goedgekeurd" : r.status === "afgewezen" ? "afgewezen" : "wacht op akkoord"}`} sub="Wordt verwerkt in je rooster" />)}
            {jarig.map(({ g, dt }) => <Rij key={g.id} icoon={<Cake size={18} />} titel={`${g.voornaam} is jarig`} sub={dt.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" })} />)}
          </Lijst>
        </Sectie>
      )}
    </>
  );
}
