// Arbeidstijdenwet (ATW), vereenvoudigd tot de regels die er in een fastfoodrooster toe doen.
// Bron: Arbeidstijdenwet en Arbeidstijdenbesluit (jeugdigen), zoals samengevat door de Rijksoverheid.
// Geen juridisch advies: de regels staan op één plek, zodat ze te controleren en aan te passen zijn.

export interface AtwRegels {
  label: string;
  maxDienstMin: number;
  maxWeekMin: number;
  /** Niet werken na dit tijdstip (minuten na middernacht) */
  nietNa?: number;
  /** Niet werken vóór dit tijdstip */
  nietVoor?: number;
  minRustMin: number;
  /** Bij een dienst langer dan dit: minstens `pauzeMin` pauze */
  pauzeNaMin: number;
  pauzeMin: number;
}

const u = (h: number) => h * 60;

export function leeftijdOp(geboortedatum: string | undefined | null, datum: string): number | null {
  if (!geboortedatum) return null;
  const [gj, gm, gd] = geboortedatum.split("-").map(Number);
  const [j, m, d] = datum.split("-").map(Number);
  return j - gj - (m < gm || (m === gm && d < gd) ? 1 : 0);
}

export function regelsVoor(leeftijd: number | null): AtwRegels {
  if (leeftijd !== null && leeftijd < 16) {
    // 13–15 jaar: alleen licht werk; in vakanties max. 8 uur per dag, niet na 19:00
    return { label: "jonger dan 16", maxDienstMin: u(8), maxWeekMin: u(40), nietNa: u(19), nietVoor: u(7), minRustMin: u(14), pauzeNaMin: u(4.5), pauzeMin: 30 };
  }
  if (leeftijd !== null && leeftijd < 18) {
    return { label: "16–17 jaar", maxDienstMin: u(9), maxWeekMin: u(45), nietNa: u(23), nietVoor: u(6), minRustMin: u(12), pauzeNaMin: u(4.5), pauzeMin: 30 };
  }
  return { label: "18+", maxDienstMin: u(12), maxWeekMin: u(60), minRustMin: u(11), pauzeNaMin: u(5.5), pauzeMin: 30 };
}

export function standaardPauze(duurMin: number, leeftijd: number | null) {
  const r = regelsVoor(leeftijd);
  return duurMin > r.pauzeNaMin ? r.pauzeMin : 0;
}

export interface Periode { start: Date; eind: Date }

const minutenVanDag = (d: Date) => d.getHours() * 60 + d.getMinutes();
const duur = (p: Periode) => (p.eind.getTime() - p.start.getTime()) / 60000;

/** Maandag 00:00 van de week waarin `d` valt. */
export function weekStart(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

/**
 * Controleer een dienst tegen de ATW, gegeven de andere diensten van dezelfde persoon (alle vestigingen).
 * Geeft een lijst met overtredingen in gewone taal; leeg = in orde.
 */
export function controleerDienst(dienst: Periode, leeftijd: number | null, andere: Periode[]): string[] {
  const r = regelsVoor(leeftijd);
  const fouten: string[] = [];
  const min = duur(dienst);
  if (min > r.maxDienstMin) fouten.push(`Dienst langer dan ${r.maxDienstMin / 60} uur (${r.label})`);
  if (r.nietNa !== undefined) {
    const eindMin = minutenVanDag(dienst.eind) || 24 * 60;
    if (eindMin > r.nietNa || dienst.eind.getDate() !== dienst.start.getDate()) fouten.push(`Na ${String(r.nietNa / 60).padStart(2, "0")}:00 werken mag niet (${r.label})`);
  }
  if (r.nietVoor !== undefined && minutenVanDag(dienst.start) < r.nietVoor) fouten.push(`Vóór ${String(r.nietVoor / 60).padStart(2, "0")}:00 werken mag niet (${r.label})`);
  for (const a of andere) {
    if (a.start < dienst.eind && a.eind > dienst.start) { fouten.push("Overlapt met een andere dienst"); continue; }
    // Rust tussen diensten op verschillende dagen
    if (a.start.toDateString() !== dienst.start.toDateString()) {
      const tussen = a.eind <= dienst.start ? (dienst.start.getTime() - a.eind.getTime()) / 60000 : (a.start.getTime() - dienst.eind.getTime()) / 60000;
      if (tussen < r.minRustMin) fouten.push(`Minder dan ${r.minRustMin / 60} uur rust tussen twee diensten (${r.label})`);
    }
  }
  const ws = weekStart(dienst.start).getTime();
  const weekMin = andere.filter((a) => weekStart(a.start).getTime() === ws).reduce((s, a) => s + duur(a), 0) + min;
  if (weekMin > r.maxWeekMin) fouten.push(`Meer dan ${r.maxWeekMin / 60} uur in deze week (${r.label})`);
  return [...new Set(fouten)];
}
