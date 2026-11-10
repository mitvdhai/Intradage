import { Search } from "lucide-react";
import { Lijst, PageTop, Rij, Sectie } from "@/components/ui";
import { ROL_LABEL } from "@/lib/access";
import { zichtbareMensen } from "@/lib/betrokkenheid";
import { DISCIPLINE_LABEL, functieVan, vestigingNaam } from "@/lib/data";
import { vereisGebruiker } from "@/lib/session";

export default async function Smoelenboek({ searchParams }: PageProps<"/app/smoelenboek">) {
  const { q } = await searchParams;
  const zoek = typeof q === "string" ? q.toLowerCase() : "";
  const { u, org } = await vereisGebruiker();
  const mensen = zichtbareMensen(org, u).filter((g) => !zoek || `${g.voornaam} ${g.achternaam}`.toLowerCase().includes(zoek));
  const groepen = [
    ...org.vestigingen.filter((v) => mensen.some((m) => m.rol !== "hq" && m.rol !== "franchisenemer" && m.vestigingIds[0] === v.id))
      .map((v) => ({ titel: `${v.naam} · ${v.plaats}`, leden: mensen.filter((m) => m.rol !== "hq" && m.rol !== "franchisenemer" && m.vestigingIds[0] === v.id) })),
    { titel: "Franchisenemers", leden: mensen.filter((m) => m.rol === "franchisenemer") },
    { titel: "HQ", leden: mensen.filter((m) => m.rol === "hq") },
  ].filter((g) => g.leden.length);
  const sub = (g: (typeof mensen)[number]) => g.rol === "hq" ? `HQ ${DISCIPLINE_LABEL[g.discipline ?? "operations"]}` : functieVan(org, g)?.naam ?? ROL_LABEL[g.rol];

  return (
    <>
      <PageTop terug={{ href: "/app/meer", label: "Meer" }} titel="Smoelenboek" />
      <form className="bg-white px-4 pb-3">
        <div className="relative">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input name="q" defaultValue={zoek} placeholder="Zoek op naam" className="tap w-full rounded-xl bg-slate-100 pl-10 pr-3 text-[15px] outline-none" />
        </div>
      </form>
      {groepen.map((gr) => (
        <Sectie key={gr.titel} titel={gr.titel}>
          <Lijst>
            {gr.leden.map((g) => (
              <Rij key={g.id} href={`/app/smoelenboek/${g.id}`}
                icoon={<span className="text-sm font-semibold">{g.voornaam[0]}</span>} toon={g.rol === "hq" ? "rood" : "navy"}
                titel={`${g.voornaam} ${g.achternaam}${g.id === u.id ? " (jij)" : ""}`} sub={sub(g) + (g.rol === "franchisenemer" ? ` · ${g.vestigingIds.map((v) => vestigingNaam(org, v)).join(", ")}` : "")} />
            ))}
          </Lijst>
        </Sectie>
      ))}
      <p className="px-5 pt-3 text-[12px] text-muted">Telefoonnummers zijn nooit zichtbaar. Je ziet collega&apos;s van je eigen vestiging, je franchisenemer en de contactpersonen van HQ.</p>
    </>
  );
}
