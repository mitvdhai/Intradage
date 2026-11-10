import { Megaphone, Pin } from "lucide-react";
import { Label, Lijst, PageTop, Rij, Sectie, tijdLabel } from "@/components/ui";
import { afzenderLabel, berichtenVoor, isBevestigd, isGelezen } from "@/lib/data";
import { vereisGebruiker } from "@/lib/session";

export default async function Berichten() {
  const { u, org } = await vereisGebruiker();
  const lijst = await berichtenVoor(org, u);
  return (
    <>
      <PageTop terug={{ href: "/app", label: "Home" }} titel="Nieuws" sub="Alleen berichten die voor jou bedoeld zijn" />
      <Sectie>
        <Lijst>
          {lijst.map((b) => {
            const open = !isBevestigd(b);
            return (
              <Rij key={b.id} href={`/app/berichten/${b.id}`} toon={open ? "rood" : isGelezen(b) ? "grijs" : "navy"}
                icoon={b.vastgezet && open ? <Pin size={18} /> : <Megaphone size={18} />}
                titel={b.titel} sub={`${afzenderLabel(b)} · ${tijdLabel(b.gepubliceerd)}`}
                rechts={open ? <Label toon="rood-vol">Bevestig</Label> : !isGelezen(b) ? <span className="h-2.5 w-2.5 rounded-full bg-brand-600" /> : undefined} />
            );
          })}
        </Lijst>
      </Sectie>
    </>
  );
}
