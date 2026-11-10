import { describe, expect, it } from "vitest";
import { berekenUitslag, bepaalUitkomst, itemScore, salarisAdvies, valideerFunctie } from "./score";
import { BELONINGSREGELING, FUNCTIES, PROFIEL_ITEMS } from "./seed";

const items = new Map(PROFIEL_ITEMS.map((i) => [i.id, i]));
const medewerker = FUNCTIES.find((f) => f.id === "f-medewerker")!;

const opNiveau = Object.fromEntries(medewerker.profiel.map((r) => [r.itemId, r.vereistNiveau]));

describe("itemScore", () => {
  it("geeft 3 op vereist niveau en schuift per niveau", () => {
    expect(itemScore(2, 2)).toBe(3);
    expect(itemScore(3, 2)).toBe(4);
    expect(itemScore(1, 2)).toBe(2);
  });
  it("blijft binnen 1..5", () => {
    expect(itemScore(1, 4)).toBe(1);
    expect(itemScore(4, 1)).toBe(5);
  });
});

describe("functiehuis-seed", () => {
  it("elke functie telt op tot 100%", () => {
    for (const f of FUNCTIES) expect(valideerFunctie(f)).toEqual([]);
  });
  it("alle profielregels verwijzen naar bestaande onderdelen", () => {
    for (const f of FUNCTIES) for (const r of f.profiel) expect(items.has(r.itemId)).toBe(true);
  });
});

describe("berekenUitslag", () => {
  it("iedereen precies op niveau = 3,0 = goed", () => {
    const u = berekenUitslag(medewerker, items, opNiveau, BELONINGSREGELING);
    expect(u.compleet).toBe(true);
    expect(u.totaal).toBe(3);
    expect(u.uitkomst).toBe("goed");
    expect(u.categorieen.map((c) => c.weging)).toEqual([40, 40, 20]);
  });

  it("is onvolledig zolang niet alles is ingevuld", () => {
    const deels: Record<string, number> = { ...opNiveau };
    delete deels["v-kassa"];
    const u = berekenUitslag(medewerker, items, deels, BELONINGSREGELING);
    expect(u.compleet).toBe(false);
    expect(u.totaal).toBeNull();
    expect(u.uitkomst).toBeNull();
  });

  it("weegt zwaardere onderdelen zwaarder", () => {
    const hoogBakken = berekenUitslag(medewerker, items, { ...opNiveau, "v-bakken": 4 }, BELONINGSREGELING);
    const hoogAllergenen = berekenUitslag(medewerker, items, { ...opNiveau, "v-allergenen": 3 }, BELONINGSREGELING);
    expect(hoogBakken.totaal).toBe(3.15); // 15% weging × +1
    expect(hoogAllergenen.totaal).toBe(3.03); // 3% weging × +1
  });

  it("begrenst de uitkomst als een voorwaarde (certificaat) ontbreekt", () => {
    const top = Object.fromEntries(medewerker.profiel.map((r) => [r.itemId, 4]));
    const zonderHaccp = { ...top, "k-haccp": 1 };
    const u = berekenUitslag(medewerker, items, zonderHaccp, BELONINGSREGELING);
    expect(u.ontbrekendeVoorwaarden).toEqual(["k-haccp"]);
    expect(u.begrensd).toBe(true);
    expect(u.uitkomst).toBe("matig");
  });
});

describe("bepaalUitkomst", () => {
  it("gebruikt de ondergrenzen van de banden", () => {
    expect(bepaalUitkomst(2.49, BELONINGSREGELING)).toBe("onvoldoende");
    expect(bepaalUitkomst(2.5, BELONINGSREGELING)).toBe("matig");
    expect(bepaalUitkomst(3.5, BELONINGSREGELING)).toBe("zeer goed");
    expect(bepaalUitkomst(4.2, BELONINGSREGELING)).toBe("uitstekend");
  });
});

describe("salarisAdvies", () => {
  const sal = { gebruikerId: "x", uurloon: 15, schaalMin: 14.99, schaalMax: 17 };
  it("past het percentage van de regeling toe", () => {
    const a = salarisAdvies("zeer goed", sal, BELONINGSREGELING);
    expect(a.percentage).toBe(3);
    expect(a.nieuw).toBe(15.45);
  });
  it("gaat nooit boven het eindloon", () => {
    const a = salarisAdvies("uitstekend", { ...sal, uurloon: 16.9 }, BELONINGSREGELING);
    expect(a.nieuw).toBe(17);
    expect(a.begrensdOpEindloon).toBe(true);
  });
  it("geeft bovenschaligen geen verhoging", () => {
    const a = salarisAdvies("goed", { ...sal, uurloon: 18 }, BELONINGSREGELING);
    expect(a.nieuw).toBe(18);
    expect(a.effectiefPercentage).toBe(0);
  });
  it("tilt een loon onder het basisloon op naar minimaal het basisloon", () => {
    const a = salarisAdvies("matig", { ...sal, uurloon: 14.5 }, BELONINGSREGELING);
    expect(a.nieuw).toBe(14.99);
  });
});
