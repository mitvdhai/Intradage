import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, Bell, UserPlus } from "lucide-react";
import { cx } from "@/components/ui";
import { ROL_LABEL, mag } from "@/lib/access";
import { contractenVan, geldendContract, medewerkers, signalen, vandaagIso } from "@/lib/personeel/data";
import { leeftijdOp } from "@/lib/planning/atw";
import { vereisGebruiker } from "@/lib/session";
import { Blok, Kop, Kpi, Tabel } from "../beheer-ui";

const TYPE = { oproep: "0-uren", minmax: "min-max", vast: "vast" } as const;
const datum = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "2-digit" });

export default async function Personeel({ searchParams }: PageProps<"/beheer/personeel">) {
  const { filter = "actief" } = await searchParams;
  const { u, org } = await vereisGebruiker();
  if (!mag(org, u, "medewerkers", 1)) redirect("/beheer");
  const [alle, sig] = await Promise.all([medewerkers(org, u, { metUitDienst: true }), signalen(org, u)]);
  const contracten = await contractenVan(alle.map((m) => m.id));
  const vandaag = vandaagIso();
  const groep = (m: (typeof alle)[number]) => m.status === "preboarding" ? "preboarding" : m.uitDienstPer && m.uitDienstPer < vandaag ? "uit-dienst" : m.uitDienstPer ? "offboarding" : "actief";
  const lijst = alle.filter((m) => filter === "actief" ? ["actief", "offboarding"].includes(groep(m)) : groep(m) === filter);
  const tel = (g: string) => alle.filter((m) => (g === "actief" ? ["actief", "offboarding"].includes(groep(m)) : groep(m) === g)).length;
  const jong = alle.filter((m) => groep(m) === "actief" && (leeftijdOp(m.geboortedatum, vandaag) ?? 99) < 18).length;

  return (
    <>
      <Kop titel="Medewerkers" sub="Personeelsdossier, contracten en de hele levenscyclus: van sollicitatie tot uit dienst"
        rechts={mag(org, u, "medewerkers") ? <div className="flex gap-2"><Link href="/beheer/werving" className="inline-flex items-center gap-2 rounded-lg bg-white px-3.5 py-2 text-sm font-semibold ring-1 ring-line">Via werving</Link><Link href="/beheer/personeel/nieuw" className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white"><UserPlus size={16} /> Medewerker toevoegen</Link></div> : undefined} />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi waarde={String(tel("actief"))} label="in dienst" />
        <Kpi waarde={String(tel("preboarding"))} label="starten binnenkort (preboarding)" />
        <Kpi waarde={String(jong)} label="jonger dan 18 (ATW-regels)" />
        <Kpi waarde={String(sig.filter((s) => s.urgent).length)} label="signalen die nu aandacht vragen" toon={sig.some((s) => s.urgent) ? "rood" : "navy"} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <Blok>
          <div className="mb-3 flex gap-1.5">
            {[["actief", "In dienst"], ["preboarding", "Preboarding"], ["uit-dienst", "Uit dienst"]].map(([k, l]) => (
              <Link key={k} href={`/beheer/personeel?filter=${k}`} className={cx("rounded-full px-3 py-1 text-[13px] font-semibold", filter === k ? "bg-navy-700 text-white" : "bg-slate-100 text-muted")}>{l} ({tel(k)})</Link>
            ))}
          </div>
          <Tabel kop={["Naam", "Vestiging(en)", "Rol", "Leeftijd", "Contract", "Loopt tot", ""]}>
            {lijst.map((m) => {
              const c = geldendContract(contracten, m.id);
              const lft = leeftijdOp(m.geboortedatum, vandaag);
              const eigenSig = sig.filter((s) => s.gebruikerId === m.id);
              return (
                <tr key={m.id}>
                  <td className="px-3 py-2"><Link href={`/beheer/personeel/${m.id}`} className="font-medium hover:underline">{m.voornaam} {m.achternaam}</Link>
                    {groep(m) === "offboarding" && <div className="text-[11px] font-semibold text-amber-700">laatste werkdag {datum(m.uitDienstPer!)}</div>}
                    {groep(m) === "preboarding" && <div className="text-[11px] font-semibold text-navy-600">start {datum(m.inDienstSinds)}</div>}</td>
                  <td className="px-3 py-2 text-muted">{m.vestigingIds.map((v) => org.vestigingen.find((x) => x.id === v)?.naam).join(", ")}</td>
                  <td className="px-3 py-2">{ROL_LABEL[m.rol]}</td>
                  <td className={cx("px-3 py-2 tabular-nums", lft !== null && lft < 18 && "font-semibold text-amber-700")}>{lft ?? "–"}</td>
                  <td className="px-3 py-2">{c ? `${TYPE[c.type]} · ${c.urenMin === c.urenMax ? c.urenMax : `${c.urenMin}–${c.urenMax}`} u` : "–"}{c?.status === "ter-ondertekening" && <span className="ml-1 text-[11px] font-semibold text-brand-600">te tekenen</span>}</td>
                  <td className="px-3 py-2 text-muted">{c?.eind ? datum(c.eind) : c ? "onbepaald" : "–"}</td>
                  <td className="px-3 py-2">{eigenSig.length > 0 && <span title={eigenSig.map((s) => s.tekst).join("\n")} className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", eigenSig.some((s) => s.urgent) ? "bg-brand-50 text-brand-700" : "bg-amber-50 text-amber-700")}><AlertTriangle size={11} /> {eigenSig.length}</span>}</td>
                </tr>
              );
            })}
          </Tabel>
        </Blok>
        <Blok titel="Signalen" rechts={<Bell size={16} className="text-muted" />}>
          {sig.length === 0 ? <p className="text-sm text-muted">Niets dat aandacht vraagt.</p> : (
            <div className="divide-y divide-line">
              {sig.slice(0, 18).map((s, i) => (
                <Link key={i} href={s.href} className="flex gap-2 py-2 text-[13px] hover:bg-slate-50">
                  <span className={cx("mt-1.5 h-2 w-2 shrink-0 rounded-full", s.urgent ? "bg-brand-600" : "bg-amber-400")} />
                  <span>{s.tekst}</span>
                </Link>
              ))}
            </div>
          )}
        </Blok>
      </div>
    </>
  );
}
