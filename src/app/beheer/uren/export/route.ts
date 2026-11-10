import { scopeVestigingen, mag } from "@/lib/access";
import { audit } from "@/lib/audit";
import { contractenVan, klokVan, medewerkers, nettoUren } from "@/lib/personeel/data";
import { huidigeGebruiker } from "@/lib/session";

const csv = (rijen: (string | number | null | undefined)[][]) =>
  "﻿" + rijen.map((r) => r.map((c) => { const s = String(c ?? ""); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(";")).join("\r\n");
const hhmm = (d: Date | null) => d ? d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" }) : "";
const geldig = (s: string | null) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Export voor de loonadministratie: goedgekeurde uren, of personeelsmutaties (in/uit dienst, contractwijzigingen). */
export async function GET(req: Request) {
  const s = await huidigeGebruiker();
  if (!s || !mag(s.org, s.u, "uren", 1)) return new Response("Geen toegang", { status: 403 });
  const url = new URL(req.url);
  const van = url.searchParams.get("van"), tot = url.searchParams.get("tot");
  if (!geldig(van) || !geldig(tot)) return new Response("Geef van en tot op (JJJJ-MM-DD)", { status: 400 });
  const mensen = await medewerkers(s.org, s.u, { metUitDienst: true });
  const pnr = (id: string) => mensen.find((m) => m.id === id)?.personeelsnummer ?? id;
  const naam = (id: string) => { const m = mensen.find((x) => x.id === id); return m ? `${m.voornaam} ${m.achternaam}` : id; };
  const vest = (id: string) => s.org.vestigingen.find((v) => v.id === id)?.naam ?? id;
  let body: string, bestand: string;

  if (url.searchParams.get("soort") === "mutaties") {
    const contracten = await contractenVan(mensen.map((m) => m.id));
    const rijen: (string | number | null)[][] = [["Personeelsnummer", "Naam", "Mutatie", "Ingangsdatum", "Einddatum", "Contractsoort", "Uren min", "Uren max", "Uurloon", "Vestiging(en)"]];
    for (const m of mensen) {
      if (m.inDienstSinds >= van! && m.inDienstSinds <= tot!) rijen.push([m.personeelsnummer, `${m.voornaam} ${m.achternaam}`, "In dienst", m.inDienstSinds, "", "", "", "", "", m.vestigingIds.map(vest).join(" / ")]);
      if (m.uitDienstPer && m.uitDienstPer >= van! && m.uitDienstPer <= tot!) rijen.push([m.personeelsnummer, `${m.voornaam} ${m.achternaam}`, "Uit dienst", m.uitDienstPer, "", "", "", "", "", ""]);
    }
    for (const c of contracten.filter((c) => c.status === "getekend" && c.ondertekendWerkgever && c.ondertekendWerkgever.toLocaleDateString("sv-SE") >= van! && c.ondertekendWerkgever.toLocaleDateString("sv-SE") <= tot!)) {
      rijen.push([pnr(c.gebruikerId), naam(c.gebruikerId), c.volgnummer === 1 ? "Nieuw contract" : "Contractwijziging", c.start, c.eind ?? "", c.type, c.urenMin, c.urenMax, c.uurloon.toFixed(2).replace(".", ","), ""]);
    }
    body = csv(rijen);
    bestand = `mutaties-${van}-${tot}.csv`;
  } else {
    const klok = (await klokVan({ vestigingIds: scopeVestigingen(s.org, s.u), van: new Date(`${van}T00:00:00`), tot: new Date(new Date(`${tot}T00:00:00`).getTime() + 86400000) }))
      .filter((k) => k.status === "goedgekeurd").sort((a, b) => pnr(a.gebruikerId).localeCompare(pnr(b.gebruikerId)) || a.in.getTime() - b.in.getTime());
    body = csv([
      ["Personeelsnummer", "Naam", "Datum", "Begin", "Eind", "Pauze (min)", "Netto uren", "Vestiging", "Weekdag"],
      ...klok.map((k) => [pnr(k.gebruikerId), naam(k.gebruikerId), k.in.toLocaleDateString("sv-SE"), hhmm(k.in), hhmm(k.uit), k.pauzeMin, nettoUren(k).toFixed(2).replace(".", ","), vest(k.vestigingId), k.in.toLocaleDateString("nl-NL", { weekday: "long" })]),
    ]);
    bestand = `uren-${van}-${tot}.csv`;
  }
  await audit(s.u.id, "Export voor loonadministratie", bestand);
  return new Response(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${bestand}"` } });
}
