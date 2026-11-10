import { notFound } from "next/navigation";
import { PageTop } from "@/components/ui";
import { DISCIPLINE_LABEL, handboekVoor } from "@/lib/data";
import { vereisGebruiker } from "@/lib/session";

export default async function Document({ params }: PageProps<"/app/handboek/[id]">) {
  const { id } = await params;
  const { u, org } = await vereisGebruiker();
  const d = (await handboekVoor(org, u)).find((x) => x.id === id);
  if (!d) notFound();
  const blokken = d.inhoud.split(/^## /m).filter(Boolean).map((b) => { const [kop, ...r] = b.split("\n"); return { kop: kop.trim(), tekst: r.join("\n").trim() }; });
  return (
    <>
      <PageTop terug={{ href: "/app/handboek", label: "Handboek" }} titel={d.titel}
        sub={`Versie ${d.versie} · eigenaar HQ ${DISCIPLINE_LABEL[d.eigenaar]} · ${new Date(d.bijgewerkt).toLocaleDateString("nl-NL")}`} />
      <article className="space-y-5 bg-white px-5 pb-8 pt-1">
        {blokken.map((b) => (
          <section key={b.kop} id={b.kop} className="scroll-mt-4">
            <h2 className="mb-1 text-lg font-bold text-navy-800">{b.kop}</h2>
            <p className="text-[15px] leading-relaxed text-ink">{b.tekst}</p>
          </section>
        ))}
      </article>
    </>
  );
}
