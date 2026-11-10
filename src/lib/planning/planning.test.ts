import { describe, expect, it } from "vitest";
import { controleerDienst, leeftijdOp, regelsVoor, standaardPauze } from "./atw";
import { maakSuggestie, opTijd, slotsVoorWeek, type PlanKandidaat } from "./suggestie";

const p = (datum: string, van: string, tot: string) => ({ start: opTijd(datum, van), eind: opTijd(datum, tot) });
const elkeDag = (van: string, tot: string) => Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, { van, tot }]));
const k = (id: string, extra: Partial<PlanKandidaat> = {}): PlanKandidaat => ({
  id, naam: id, geboortedatum: "1995-01-01", positieIds: ["kassa", "bakken"], beschikbaar: elkeDag("10:00", "23:00"),
  afwezig: new Set(), urenMin: 0, urenMax: 40, ...extra,
});

describe("Arbeidstijdenwet", () => {
  it("berekent leeftijd op een datum", () => {
    expect(leeftijdOp("2009-11-20", "2026-11-19")).toBe(16);
    expect(leeftijdOp("2009-11-20", "2026-11-20")).toBe(17);
  });
  it("16–17 jaar: niet na 23:00 en max. 9 uur", () => {
    expect(controleerDienst(p("2026-11-14", "16:00", "23:30"), 17, [])).toContain("Na 23:00 werken mag niet (16–17 jaar)");
    expect(controleerDienst(p("2026-11-14", "10:00", "20:00"), 17, [])[0]).toMatch(/langer dan 9 uur/);
    expect(controleerDienst(p("2026-11-14", "17:00", "23:00"), 17, [])).toEqual([]);
  });
  it("jonger dan 16: niet na 19:00", () => {
    expect(controleerDienst(p("2026-11-14", "15:00", "20:00"), 15, []).join()).toMatch(/19:00/);
  });
  it("rusttijd en overlap", () => {
    const avond = p("2026-11-13", "17:00", "23:00");
    expect(controleerDienst(p("2026-11-14", "08:00", "12:00"), 25, [avond]).join()).toMatch(/11 uur rust/);
    expect(controleerDienst(p("2026-11-14", "11:00", "15:00"), 25, [avond])).toEqual([]);
    expect(controleerDienst(p("2026-11-14", "11:00", "15:00"), 25, [p("2026-11-14", "14:00", "18:00")])).toContain("Overlapt met een andere dienst");
  });
  it("pauze volgens leeftijd", () => {
    expect(standaardPauze(5 * 60, 17)).toBe(30);
    expect(standaardPauze(5 * 60, 30)).toBe(0);
    expect(regelsVoor(null).label).toBe("18+");
  });
});

describe("Roostersuggestie", () => {
  const normen = [
    { weekdag: 6, positieId: "kassa", aantal: 2, van: "11:00", tot: "17:00" },
    { weekdag: 6, positieId: "bakken", aantal: 1, van: "17:00", tot: "23:00" },
  ];
  const slots = slotsVoorWeek("2026-11-09", normen); // zaterdag 14 november

  it("maakt slots per norm en aantal", () => {
    expect(slots).toHaveLength(3);
    expect(slots.every((s) => s.datum === "2026-11-14")).toBe(true);
  });

  it("vult op beschikbaarheid en positie, en laat een slot open als niemand kan", () => {
    const res = maakSuggestie({ slots, kandidaten: [k("a"), k("b", { positieIds: ["kassa"] })], bestaand: {} });
    expect(res.dekking).toEqual({ gevuld: 2, totaal: 3 });
    // Het schaarse slot (bakken: alleen a kan het) gaat eerst; daarna blijft één kassaslot open
    expect(res.toewijzingen.find((t) => t.slot.positieId === "bakken")!.gebruikerId).toBe("a");
    expect(res.toewijzingen.filter((t) => t.slot.positieId === "kassa").map((t) => t.gebruikerId).sort()).toEqual(["b", null].sort());
  });

  it("plant een 15-jarige niet 's avonds in, een 17-jarige wel tot 23:00", () => {
    const avond = slots.filter((s) => s.positieId === "bakken");
    expect(maakSuggestie({ slots: avond, kandidaten: [k("zeventien", { geboortedatum: "2009-06-01" })], bestaand: {} }).toewijzingen[0].gebruikerId).toBe("zeventien");
    const res = maakSuggestie({ slots: avond, kandidaten: [k("jong", { geboortedatum: "2011-06-01" })], bestaand: {} });
    expect(res.toewijzingen[0].gebruikerId).toBeNull();
    expect(res.toewijzingen[0].uitleg).toMatch(/ATW/);
  });

  it("respecteert verlof en maximale contracturen", () => {
    const res = maakSuggestie({
      slots: slots.filter((s) => s.positieId === "kassa"),
      kandidaten: [k("verlof", { afwezig: new Set(["2026-11-14"]) }), k("vol", { urenMax: 4 }), k("ok")],
      bestaand: {},
    });
    expect(res.toewijzingen.map((t) => t.gebruikerId)).toEqual(expect.arrayContaining(["ok", null]));
  });

  it("telt diensten uit een andere week niet mee voor de contracturen", () => {
    const vorigeWeek = [p("2026-11-06", "10:00", "22:00"), p("2026-11-07", "10:00", "22:00")];
    const res = maakSuggestie({ slots: [slots[0]], kandidaten: [k("a", { urenMax: 8 })], bestaand: { a: vorigeWeek } });
    expect(res.toewijzingen[0].gebruikerId).toBe("a");
  });

  it("plant nooit iemand onder de minimumleeftijd van een positie in (kassa vanaf 16)", () => {
    const kassa = slots.filter((s) => s.positieId === "kassa");
    const res = maakSuggestie({ slots: kassa, kandidaten: [k("vijftien", { geboortedatum: "2011-06-01" }), k("zestien", { geboortedatum: "2010-01-01" })], bestaand: {}, minLeeftijd: { kassa: 16 } });
    expect(res.toewijzingen.map((t) => t.gebruikerId)).not.toContain("vijftien");
    const alleenJong = maakSuggestie({ slots: [kassa[0]], kandidaten: [k("vijftien", { geboortedatum: "2011-06-01" })], bestaand: {}, minLeeftijd: { kassa: 16 } });
    expect(alleenJong.toewijzingen[0].gebruikerId).toBeNull();
    expect(alleenJong.toewijzingen[0].uitleg).toMatch(/oud genoeg/);
  });

  it("geeft voorrang aan wie onder zijn minimum zit", () => {
    const res = maakSuggestie({ slots: [slots[0]], kandidaten: [k("x"), k("y", { urenMin: 12 })], bestaand: {} });
    expect(res.toewijzingen[0].gebruikerId).toBe("y");
  });
});
