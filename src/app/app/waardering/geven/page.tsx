import { PageTop } from "@/components/ui";
import { WaarderingForm } from "@/components/waardering-form";
import { ROL_LABEL } from "@/lib/access";
import { waarden, zichtbareMensen } from "@/lib/betrokkenheid";
import { functieVan, vestigingNaam } from "@/lib/data";
import { vereisGebruiker } from "@/lib/session";

export default async function WaarderingGeven({ searchParams }: PageProps<"/app/waardering/geven">) {
  const { aan } = await searchParams;
  const { u, org } = await vereisGebruiker();
  const mensen = zichtbareMensen(org, u).filter((g) => g.id !== u.id).map((g) => ({
    id: g.id,
    naam: `${g.voornaam} ${g.achternaam}`,
    sub: g.rol === "hq" ? "HQ" : `${functieVan(org, g)?.naam ?? ROL_LABEL[g.rol]} · ${vestigingNaam(org, g.vestigingIds[0] ?? "")}`,
  }));
  const ws = (await waarden()).map(({ id, naam, emoji, omschrijving }) => ({ id, naam, emoji, omschrijving }));
  return (
    <>
      <PageTop terug={{ href: "/app/waardering", label: "Waardering" }} titel="Waardeer een collega" />
      <WaarderingForm mensen={mensen} waarden={ws} standaardAan={typeof aan === "string" && mensen.some((m) => m.id === aan) ? aan : undefined} />
    </>
  );
}
