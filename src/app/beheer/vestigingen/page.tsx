import Link from "next/link";
import { redirect } from "next/navigation";
import { cx } from "@/components/ui";
import { VestigingEditor } from "@/components/vestiging-editor";
import { scopeVestigingen } from "@/lib/access";
import { magPersoneel, medewerkers, normen, posities, vestigingen } from "@/lib/personeel/data";
import { vereisGebruiker } from "@/lib/session";
import { Blok, Kop } from "../beheer-ui";

export default async function Vestigingen({ searchParams }: PageProps<"/beheer/vestigingen">) {
  const { v: kies } = await searchParams;
  const { u, org } = await vereisGebruiker();
  if (!magPersoneel(u)) redirect("/beheer");
  const vest = await vestigingen(scopeVestigingen(org, u));
  const v = vest.find((x) => x.id === kies) ?? vest[0];
  if (!v) return <Kop titel="Vestigingen" sub="Geen vestigingen in je scope." />;
  const [pos, norm, mensen] = await Promise.all([posities(), normen(v.id), medewerkers(org, u)]);
  const team = mensen.filter((m) => m.vestigingIds.includes(v.id));

  return (
    <>
      <Kop titel="Vestigingen" sub="Openingstijden en standaardbezetting: de basis voor het roostervoorstel" />
      <div className="mb-4 flex flex-wrap gap-2">
        {vest.map((x) => <Link key={x.id} href={`/beheer/vestigingen?v=${x.id}`} className={cx("rounded-full px-3.5 py-1.5 text-sm font-semibold", x.id === v.id ? "bg-navy-700 text-white" : "bg-white ring-1 ring-line")}>{x.naam} · {x.plaats}</Link>)}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Blok titel={`${v.naam} · ${v.adres ?? v.plaats}`}>
          <VestigingEditor key={v.id} vestigingId={v.id} opening={v.openingstijden} normen={norm.map((n) => ({ weekdag: n.weekdag, positieId: n.positieId, aantal: n.aantal, van: n.van, tot: n.tot }))} posities={pos} />
        </Blok>
        <div className="space-y-6">
          <Blok titel={`Team (${team.length})`}>
            <div className="divide-y divide-line text-sm">
              {team.map((m) => (
                <Link key={m.id} href={`/beheer/personeel/${m.id}`} className="flex items-center justify-between py-1.5 hover:underline">
                  <span>{m.voornaam} {m.achternaam}{m.status === "preboarding" && <span className="ml-1.5 text-[11px] font-semibold text-amber-700">start {new Date(`${m.inDienstSinds}T12:00:00`).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}</span>}</span>
                  <span className="text-[12px] text-muted">{m.vestigingIds.length > 1 ? `ook ${m.vestigingIds.filter((x) => x !== v.id).map((x) => org.vestigingen.find((y) => y.id === x)?.naam).join(", ")}` : ""}</span>
                </Link>
              ))}
            </div>
          </Blok>
          <Blok titel="Zo werkt het">
            <ul className="list-disc space-y-1.5 pl-4 text-[13px] text-muted">
              <li>Per dag stel je in welke posities je nodig hebt, hoeveel mensen en van hoe laat tot hoe laat.</li>
              <li>Bij <b className="text-ink">Planning › Rooster voorstellen</b> vult Intradage deze bezetting met beschikbare medewerkers, rekening houdend met verlof, contracturen en de Arbeidstijdenwet.</li>
              <li>Medewerkers kun je aan meerdere vestigingen koppelen (bij <b className="text-ink">Medewerkers</b>). Ze worden dan nergens dubbel ingepland.</li>
            </ul>
          </Blok>
        </div>
      </div>
    </>
  );
}
