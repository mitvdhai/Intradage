import { notFound } from "next/navigation";
import { CheckCircle2, FileText, Pin } from "lucide-react";
import { Knop, Label, Lijst, PageTop, Rij, Sectie, tijdLabel } from "@/components/ui";
import { inDoelgroep } from "@/lib/access";
import { bevestigBericht, reageer } from "@/lib/acties";
import { afzenderLabel, isBevestigd, reactiesVan, status, voornaamVan } from "@/lib/data";
import { vereisGebruiker } from "@/lib/session";
import { db } from "@/lib/store";

export default async function BerichtPagina({ params }: PageProps<"/app/berichten/[id]">) {
  const { id } = await params;
  const u = await vereisGebruiker();
  const b = db.berichten.find((x) => x.id === id);
  if (!b || !inDoelgroep(u, b.doelgroep)) notFound();

  // Openen = gelezen (bevestigen is een aparte, bewuste actie)
  db.leesstatus[b.id] ??= {};
  (db.leesstatus[b.id][u.id] ??= {}).gelezen ??= new Date().toISOString();

  const doc = b.handboekDocId ? db.handboek.find((d) => d.id === b.handboekDocId) : undefined;
  const reacties = reactiesVan(b.id);
  const bevestigd = isBevestigd(b, u);
  const regels = b.inhoud.split("\n");

  return (
    <>
      <PageTop terug={{ href: "/app", label: "Home" }} titel={b.titel}
        sub={<span className="flex flex-wrap items-center gap-2">
          {b.urgentie === "verplicht" && <Label toon="rood-vol">Verplicht</Label>}
          {b.urgentie === "belangrijk" && <Label toon="rood">Belangrijk</Label>}
          {b.vastgezet && !bevestigd && <span className="inline-flex items-center gap-1"><Pin size={12} /> vastgezet</span>}
          <span>{afzenderLabel(b)} · {tijdLabel(b.gepubliceerd)}</span>
        </span>} />

      <article className="bg-white px-5 pb-5 text-[15px] leading-relaxed text-ink">
        {regels.filter((r) => !r.startsWith("- ")).map((r, i) => <p key={i} className="mb-3">{r}</p>)}
        {regels.some((r) => r.startsWith("- ")) && (
          <ul className="mb-2 list-disc space-y-1 pl-5">{regels.filter((r) => r.startsWith("- ")).map((r, i) => <li key={i}>{r.slice(2)}</li>)}</ul>
        )}
      </article>

      {doc && (
        <Sectie titel="In het handboek">
          <Lijst><Rij href={`/app/handboek/${doc.id}`} icoon={<FileText size={18} />} titel={doc.titel} sub={`Versie ${doc.versie}`} /></Lijst>
        </Sectie>
      )}

      {b.urgentie === "verplicht" && (
        <div className="px-4 pt-5">
          {bevestigd ? (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
              <CheckCircle2 size={18} /> Bevestigd op {new Date(status(b, u).bevestigd!).toLocaleString("nl-NL", { dateStyle: "medium", timeStyle: "short" })}
            </div>
          ) : (
            <form action={bevestigBericht.bind(null, b.id)}><Knop><CheckCircle2 size={18} /> Gelezen en begrepen</Knop></form>
          )}
        </div>
      )}

      <Sectie titel={`Reacties (${reacties.length})`}>
        <div className="space-y-2">
          {reacties.map((r) => (
            <div key={r.id} className="rounded-2xl bg-white px-4 py-2.5 text-[14px] ring-1 ring-line">
              <div className="text-[12px] font-semibold text-navy-700">{voornaamVan(r.gebruikerId)} <span className="font-normal text-muted">· {tijdLabel(r.tijd)}</span></div>
              {r.tekst}
            </div>
          ))}
        </div>
        <form action={reageer.bind(null, b.id)} className="mt-3 flex gap-2">
          <input name="tekst" required placeholder="Stel een vraag of reageer…" className="tap min-w-0 flex-1 rounded-xl border border-line bg-white px-3 text-[15px] outline-none focus:border-navy-500" />
          <button className="tap rounded-xl bg-navy-700 px-4 text-sm font-semibold text-white">Plaats</button>
        </form>
      </Sectie>
    </>
  );
}
