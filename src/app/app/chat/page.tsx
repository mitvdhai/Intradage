import { Megaphone, Store, Users, UsersRound } from "lucide-react";
import { Lijst, PageTop, Rij, Sectie, tijdLabel } from "@/components/ui";
import { chatGroepenVoor, laatsteChats, ledenVan, voornaamVan } from "@/lib/data";
import { vereisGebruiker } from "@/lib/session";

const ICOON = { vestiging: Store, franchisenemer: UsersRound, shiftleiders: Users, "hq-kanaal": Megaphone };

export default async function Chats() {
  const { u, org } = await vereisGebruiker();
  const groepen = await chatGroepenVoor(org, u);
  const laatste = await laatsteChats(groepen.map((g) => g.id));
  return (
    <>
      <PageTop titel="Chat" sub="Groepen worden automatisch bijgewerkt vanuit het personeelsbestand" />
      <Sectie>
        <Lijst>
          {groepen.map((g) => {
            const l = laatste.get(g.id);
            const I = ICOON[g.type];
            return (
              <Rij key={g.id} href={`/app/chat/${g.id}`} icoon={<I size={18} />} toon={g.alleenLezen ? "grijs" : "navy"} titel={g.naam}
                sub={l ? `${voornaamVan(org, l.gebruikerId)}: ${l.tekst}` : `${ledenVan(org, g).length} leden`}
                rechts={l ? <span className="shrink-0 text-[11px] text-muted">{tijdLabel(l.tijd)}</span> : undefined} />
            );
          })}
        </Lijst>
        <p className="mt-3 px-1 text-[12px] text-muted">Je telefoonnummer is nooit zichtbaar voor collega&apos;s. Na je laatste werkdag verdwijn je automatisch uit alle groepen.</p>
      </Sectie>
    </>
  );
}
