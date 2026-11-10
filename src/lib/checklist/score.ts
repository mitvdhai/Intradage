import type { ChecklistAntwoorden, ChecklistOnderdeel, ChecklistVraag } from "../db/schema";

// Scoring van checklists en vestigingsevaluaties (schaal 0–10, zoals een rapportcijfer).
// - ja/nee: ja = 100%, nee = 0%
// - score 1..5: (s − 1) / 4
// - meting: binnen de grens (≤ max) = 100%, daarbuiten 0%
// Een gemiste knock-outvraag begrenst het eindcijfer op 5,4 (onvoldoende), ongeacht de rest.

export const KNOCKOUT_MAX = 5.4;

export function vraagScore(v: ChecklistVraag, waarde: number | boolean | null | undefined): number | null {
  if (waarde === null || waarde === undefined) return null;
  if (v.type === "ja-nee") return waarde === true || waarde === 1 ? 1 : 0;
  if (v.type === "score") {
    const s = Number(waarde);
    return s >= 1 && s <= 5 ? (s - 1) / 4 : null;
  }
  const n = Number(waarde);
  if (!Number.isFinite(n)) return null;
  return v.max === undefined || n <= v.max ? 1 : 0;
}

export function vraagGefaald(v: ChecklistVraag, waarde: number | boolean | null | undefined) {
  return !!v.knockout && vraagScore(v, waarde) === 0;
}

export interface OnderdeelUitslag { id: string; naam: string; weging: number; cijfer: number | null; ingevuld: number; totaal: number }
export interface ChecklistUitslag { onderdelen: OnderdeelUitslag[]; cijfer: number | null; compleet: boolean; knockouts: string[] }

const rond1 = (n: number) => Math.round(n * 10) / 10;

export function berekenChecklist(onderdelen: ChecklistOnderdeel[], antwoorden: ChecklistAntwoorden): ChecklistUitslag {
  const knockouts: string[] = [];
  const delen = onderdelen.map((o) => {
    const scores = o.vragen.map((v) => {
      const w = antwoorden[v.id]?.waarde;
      if (vraagGefaald(v, w)) knockouts.push(v.id);
      return vraagScore(v, w);
    });
    const gevuld = scores.filter((s): s is number => s !== null);
    return {
      id: o.id, naam: o.naam, weging: o.weging,
      cijfer: gevuld.length ? rond1((gevuld.reduce((a, b) => a + b, 0) / gevuld.length) * 10) : null,
      ingevuld: gevuld.length, totaal: o.vragen.length,
    };
  });
  const compleet = delen.every((d) => d.ingevuld === d.totaal);
  const totW = delen.reduce((s, d) => s + d.weging, 0);
  let cijfer: number | null = null;
  if (compleet && totW > 0) {
    cijfer = rond1(delen.reduce((s, d) => s + d.weging * (d.cijfer ?? 0), 0) / totW);
    if (knockouts.length) cijfer = Math.min(cijfer, KNOCKOUT_MAX);
  }
  return { onderdelen: delen, cijfer, compleet, knockouts };
}
