import type {
  Beloningsregeling,
  Functie,
  ProfielCategorie,
  ProfielItem,
  Salarisgegevens,
  Uitkomst,
} from "../types";

/**
 * Een beoordeling legt per profielonderdeel het BEHAALDE niveau (1..4) vast.
 * Dat wordt vergeleken met het VEREISTE niveau van de functie:
 *   twee of meer onder vereist → 1, één onder → 2, op niveau → 3,
 *   één boven → 4, twee of meer boven → 5.
 * Zo is "op niveau" altijd een 3, ongeacht de functie.
 */
export function itemScore(behaald: number, vereist: number): number {
  const verschil = behaald - vereist;
  return Math.max(1, Math.min(5, 3 + verschil));
}

export interface RegelUitslag {
  itemId: string;
  categorie: ProfielCategorie;
  weging: number;
  vereist: number;
  behaald: number | null;
  score: number | null;
  voorwaarde: boolean;
  voorwaardeGehaald: boolean;
}

export interface CategorieUitslag {
  categorie: ProfielCategorie;
  weging: number; // som van de itemwegingen
  score: number | null; // gewogen gemiddelde 1..5
}

export interface Uitslag {
  regels: RegelUitslag[];
  categorieen: CategorieUitslag[];
  totaal: number | null; // gewogen 1..5, afgerond op 2 decimalen
  compleet: boolean;
  ontbrekendeVoorwaarden: string[];
  uitkomst: Uitkomst | null;
  begrensd: boolean; // uitkomst verlaagd door ontbrekende voorwaarde
}

export const CATEGORIEEN: ProfielCategorie[] = ["competentie", "vaardigheid", "kennis"];
export const CATEGORIE_LABEL: Record<ProfielCategorie, string> = {
  competentie: "Competenties",
  vaardigheid: "Vaardigheden",
  kennis: "Kennis & skills",
};

const UITKOMST_VOLGORDE: Uitkomst[] = ["onvoldoende", "matig", "goed", "zeer goed", "uitstekend"];

export function wegingTotaal(functie: Functie): number {
  return functie.profiel.reduce((s, r) => s + r.weging, 0);
}

export function categorieWeging(functie: Functie, items: Map<string, ProfielItem>, cat: ProfielCategorie) {
  return functie.profiel
    .filter((r) => items.get(r.itemId)?.categorie === cat)
    .reduce((s, r) => s + r.weging, 0);
}

export function bepaalUitkomst(totaal: number, regeling: Beloningsregeling): Uitkomst {
  const banden = [...regeling.banden].sort((a, b) => a.vanaf - b.vanaf);
  let uitkomst: Uitkomst = banden[0].uitkomst;
  for (const b of banden) if (totaal >= b.vanaf) uitkomst = b.uitkomst;
  return uitkomst;
}

function begrens(u: Uitkomst, max: Uitkomst): Uitkomst {
  return UITKOMST_VOLGORDE.indexOf(u) > UITKOMST_VOLGORDE.indexOf(max) ? max : u;
}

const rond = (n: number) => Math.round(n * 100) / 100;

export function berekenUitslag(
  functie: Functie,
  items: Map<string, ProfielItem>,
  behaald: Record<string, number>,
  regeling: Beloningsregeling,
): Uitslag {
  const regels: RegelUitslag[] = functie.profiel.map((r) => {
    const b = behaald[r.itemId];
    const heeft = typeof b === "number" && b >= 1;
    return {
      itemId: r.itemId,
      categorie: items.get(r.itemId)?.categorie ?? "competentie",
      weging: r.weging,
      vereist: r.vereistNiveau,
      behaald: heeft ? b : null,
      score: heeft ? itemScore(b, r.vereistNiveau) : null,
      voorwaarde: !!r.voorwaarde,
      voorwaardeGehaald: !r.voorwaarde || (heeft && b >= r.vereistNiveau),
    };
  });

  const categorieen: CategorieUitslag[] = CATEGORIEEN.map((cat) => {
    const rs = regels.filter((r) => r.categorie === cat);
    const weging = rs.reduce((s, r) => s + r.weging, 0);
    const gescoord = rs.filter((r) => r.score !== null);
    const w = gescoord.reduce((s, r) => s + r.weging, 0);
    const score = w > 0 ? rond(gescoord.reduce((s, r) => s + r.weging * (r.score as number), 0) / w) : null;
    return { categorie: cat, weging, score };
  }).filter((c) => c.weging > 0);

  const compleet = regels.every((r) => r.score !== null);
  const totW = regels.reduce((s, r) => s + r.weging, 0);
  const totaal = compleet && totW > 0
    ? rond(regels.reduce((s, r) => s + r.weging * (r.score as number), 0) / totW)
    : null;

  const ontbrekendeVoorwaarden = regels.filter((r) => r.voorwaarde && r.behaald !== null && !r.voorwaardeGehaald).map((r) => r.itemId);

  let uitkomst: Uitkomst | null = null;
  let begrensd = false;
  if (totaal !== null) {
    const ruw = bepaalUitkomst(totaal, regeling);
    uitkomst = ontbrekendeVoorwaarden.length ? begrens(ruw, regeling.maxUitkomstBijOntbrekendeVoorwaarde) : ruw;
    begrensd = uitkomst !== ruw;
  }
  return { regels, categorieen, totaal, compleet, ontbrekendeVoorwaarden, uitkomst, begrensd };
}

export interface SalarisAdvies {
  percentage: number; // advies volgens regeling
  effectiefPercentage: number; // na begrenzing op eindloon
  huidig: number;
  nieuw: number;
  begrensdOpEindloon: boolean;
}

/**
 * Advies, geen besluit: de franchisenemer (werkgever) beslist altijd zelf.
 * Nooit onder het basisloon van de functiegroep, nooit boven het eindloon.
 */
export function salarisAdvies(uitkomst: Uitkomst, sal: Salarisgegevens, regeling: Beloningsregeling): SalarisAdvies {
  const percentage = regeling.verhoging[uitkomst] ?? 0;
  const basis = Math.max(sal.uurloon, sal.schaalMin);
  const doel = basis * (1 + percentage / 100);
  const nieuw = Math.round(Math.min(doel, Math.max(sal.schaalMax, basis)) * 100) / 100;
  const effectiefPercentage = Math.round(((nieuw / sal.uurloon) - 1) * 1000) / 10;
  return {
    percentage,
    effectiefPercentage,
    huidig: sal.uurloon,
    nieuw,
    begrensdOpEindloon: doel > sal.schaalMax && percentage > 0,
  };
}

export function valideerFunctie(functie: Functie): string[] {
  const fouten: string[] = [];
  const tot = wegingTotaal(functie);
  if (tot !== 100) fouten.push(`De wegingen tellen op tot ${tot}%, dat moet 100% zijn.`);
  const dubbel = functie.profiel.map((r) => r.itemId).filter((id, i, a) => a.indexOf(id) !== i);
  if (dubbel.length) fouten.push(`Dubbele onderdelen: ${[...new Set(dubbel)].join(", ")}.`);
  if (functie.profiel.some((r) => r.weging <= 0)) fouten.push("Elke weging moet groter dan 0 zijn.");
  return fouten;
}
