import { controleerDienst, leeftijdOp, standaardPauze, weekStart, type Periode } from "./atw";

// Roostersuggestie: vul de standaardbezetting van een week met beschikbare, inzetbare medewerkers.
// Pure functie: alle gegevens gaan erin, een voorstel komt eruit. Zo is hij te testen en uit te leggen.

export interface NormSlot {
  datum: string; // YYYY-MM-DD
  positieId: string;
  van: string; // HH:MM
  tot: string;
  /** Volgnummer binnen dezelfde norm (1e, 2e … persoon) */
  nr: number;
}

export interface PlanKandidaat {
  id: string;
  naam: string;
  geboortedatum?: string | null;
  positieIds: string[];
  /** Weekdag (0 = zondag) → beschikbaar blok */
  beschikbaar: Record<number, { van: string; tot: string } | undefined>;
  /** Data waarop iemand afwezig is (verlof, ziek) */
  afwezig: Set<string>;
  urenMin: number;
  urenMax: number;
}

export interface Toewijzing {
  slot: NormSlot;
  gebruikerId: string | null;
  pauzeMin: number;
  /** Waarom niemand (bij een open dienst), of waarom deze persoon */
  uitleg: string;
}

export interface Suggestie {
  toewijzingen: Toewijzing[];
  /** Geplande netto uren per medewerker in deze week (inclusief bestaande diensten) */
  uren: Record<string, number>;
  dekking: { gevuld: number; totaal: number };
}

export const naarMin = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
export const opTijd = (datum: string, hhmm: string) => new Date(`${datum}T${hhmm.length === 5 ? hhmm : hhmm.padStart(5, "0")}:00`);
export const weekdagVan = (datum: string) => new Date(`${datum}T12:00:00`).getDay();

/** Is iemand beschikbaar voor het hele slot? */
export function beschikbaarVoor(k: PlanKandidaat, slot: Pick<NormSlot, "datum" | "van" | "tot">) {
  if (k.afwezig.has(slot.datum)) return false;
  const b = k.beschikbaar[weekdagVan(slot.datum)];
  return !!b && naarMin(b.van) <= naarMin(slot.van) && naarMin(b.tot) >= naarMin(slot.tot);
}

/** Simpele, stabiele "toeval" om gelijke kandidaten eerlijk te verdelen. */
function hash(s: string) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h; }

export function maakSuggestie(input: {
  slots: NormSlot[];
  kandidaten: PlanKandidaat[];
  /** Al vastgelegde diensten per medewerker (alle vestigingen), telt mee voor uren, rust en overlap */
  bestaand: Record<string, Periode[]>;
}): Suggestie {
  const planning: Record<string, Periode[]> = {};
  const uren: Record<string, number> = {};
  // Contracturen gelden per week: alleen bestaande diensten in de week van de slots tellen mee
  const eerste = input.slots.map((s) => s.datum).sort()[0];
  const weekVan = eerste ? weekStart(opTijd(eerste, "12:00")).getTime() : 0;
  const inWeek = (p: Periode) => p.start.getTime() >= weekVan && p.start.getTime() < weekVan + 7 * 86400000;
  for (const k of input.kandidaten) {
    planning[k.id] = [...(input.bestaand[k.id] ?? [])];
    uren[k.id] = planning[k.id].filter(inWeek).reduce((s, p) => s + (p.eind.getTime() - p.start.getTime()) / 3600000, 0);
  }

  const geschikt = (k: PlanKandidaat, slot: NormSlot) => {
    if (!k.positieIds.includes(slot.positieId) || !beschikbaarVoor(k, slot)) return false;
    const p = { start: opTijd(slot.datum, slot.van), eind: opTijd(slot.datum, slot.tot) };
    // Eén dienst per dag per persoon
    if (planning[k.id].some((x) => x.start.toDateString() === p.start.toDateString())) return false;
    const duurUur = (naarMin(slot.tot) - naarMin(slot.van)) / 60;
    if (uren[k.id] + duurUur > k.urenMax + 0.01) return false;
    return controleerDienst(p, leeftijdOp(k.geboortedatum, slot.datum), planning[k.id]).length === 0;
  };

  // Moeilijkste slots eerst: de slots waarvoor de minste mensen in aanmerking komen
  const volgorde = [...input.slots].sort((a, b) => {
    const na = input.kandidaten.filter((k) => geschikt(k, a)).length;
    const nb = input.kandidaten.filter((k) => geschikt(k, b)).length;
    return na - nb || a.datum.localeCompare(b.datum) || a.van.localeCompare(b.van);
  });

  const toewijzingen: Toewijzing[] = [];
  for (const slot of volgorde) {
    const opties = input.kandidaten.filter((k) => geschikt(k, slot));
    const duurMin = naarMin(slot.tot) - naarMin(slot.van);
    if (!opties.length) {
      const metPositie = input.kandidaten.filter((k) => k.positieIds.includes(slot.positieId));
      const uitleg = !metPositie.length ? "Niemand is inzetbaar op deze positie"
        : !metPositie.some((k) => beschikbaarVoor(k, slot)) ? "Niemand met deze positie is dan beschikbaar"
        : "Beschikbare mensen zitten aan hun uren, rusttijd of ATW-grens";
      toewijzingen.push({ slot, gebruikerId: null, pauzeMin: standaardPauze(duurMin, null), uitleg });
      continue;
    }
    // Eerst wie nog onder zijn minimum contracturen zit, dan wie relatief het minst is ingepland
    const score = (k: PlanKandidaat) => {
      const tekort = Math.max(0, k.urenMin - uren[k.id]);
      const vulling = k.urenMax ? uren[k.id] / k.urenMax : 1;
      return -tekort * 10 + vulling * 5 + (hash(k.id + slot.datum + slot.positieId) % 100) / 1000;
    };
    const beste = opties.sort((a, b) => score(a) - score(b))[0];
    const p = { start: opTijd(slot.datum, slot.van), eind: opTijd(slot.datum, slot.tot) };
    planning[beste.id].push(p);
    uren[beste.id] += duurMin / 60;
    const tekort = beste.urenMin - (uren[beste.id] - duurMin / 60);
    toewijzingen.push({
      slot, gebruikerId: beste.id, pauzeMin: standaardPauze(duurMin, leeftijdOp(beste.geboortedatum, slot.datum)),
      uitleg: tekort > 0 ? `Beschikbaar, nog ${Math.round(tekort)} uur onder minimum contract` : `Beschikbaar en inzetbaar (${opties.length} optie${opties.length > 1 ? "s" : ""})`,
    });
  }

  toewijzingen.sort((a, b) => a.slot.datum.localeCompare(b.slot.datum) || a.slot.van.localeCompare(b.slot.van) || a.slot.positieId.localeCompare(b.slot.positieId));
  return { toewijzingen, uren, dekking: { gevuld: toewijzingen.filter((t) => t.gebruikerId).length, totaal: toewijzingen.length } };
}

/** Zet bezettingsnormen om naar slots voor een week die begint op `maandag` (YYYY-MM-DD). */
export function slotsVoorWeek(maandag: string, normen: { weekdag: number; positieId: string; aantal: number; van: string; tot: string }[], gesloten: (datum: string) => boolean = () => false): NormSlot[] {
  const slots: NormSlot[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(`${maandag}T12:00:00`);
    d.setDate(d.getDate() + i);
    const datum = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (gesloten(datum)) continue;
    for (const n of normen.filter((x) => x.weekdag === d.getDay())) {
      for (let nr = 1; nr <= n.aantal; nr++) slots.push({ datum, positieId: n.positieId, van: n.van, tot: n.tot, nr });
    }
  }
  return slots;
}
