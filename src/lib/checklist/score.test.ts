import { describe, expect, it } from "vitest";
import type { ChecklistOnderdeel } from "../db/schema";
import { berekenChecklist, KNOCKOUT_MAX, vraagScore } from "./score";

const onderdelen: ChecklistOnderdeel[] = [
  { id: "h", naam: "Hygiëne", weging: 30, vragen: [
    { id: "h1", tekst: "Werkbanken schoon", type: "score" },
    { id: "h2", tekst: "Koelcel ≤ 7 °C", type: "meting", max: 7, eenheid: "°C", knockout: true },
  ] },
  { id: "p", naam: "Product", weging: 70, vragen: [{ id: "p1", tekst: "Patat volgens standaard", type: "ja-nee" }] },
];

describe("vraagScore", () => {
  it("rekent de drie vraagtypes om naar 0..1", () => {
    expect(vraagScore({ id: "a", tekst: "", type: "ja-nee" }, true)).toBe(1);
    expect(vraagScore({ id: "a", tekst: "", type: "score" }, 3)).toBe(0.5);
    expect(vraagScore({ id: "a", tekst: "", type: "meting", max: 7 }, 9)).toBe(0);
    expect(vraagScore({ id: "a", tekst: "", type: "score" }, null)).toBeNull();
  });
});

describe("berekenChecklist", () => {
  it("weegt onderdelen naar hun weging", () => {
    const u = berekenChecklist(onderdelen, { h1: { waarde: 5 }, h2: { waarde: 4 }, p1: { waarde: false } });
    expect(u.compleet).toBe(true);
    expect(u.onderdelen[0].cijfer).toBe(10);
    expect(u.cijfer).toBe(3); // 30% × 10 + 70% × 0
  });
  it("begrenst het cijfer bij een gemiste knock-out", () => {
    const u = berekenChecklist(onderdelen, { h1: { waarde: 5 }, h2: { waarde: 9 }, p1: { waarde: true } });
    expect(u.knockouts).toEqual(["h2"]);
    expect(u.cijfer).toBe(KNOCKOUT_MAX);
  });
  it("geeft geen eindcijfer zolang niet alles is ingevuld", () => {
    const u = berekenChecklist(onderdelen, { h1: { waarde: 5 } });
    expect(u.compleet).toBe(false);
    expect(u.cijfer).toBeNull();
    expect(u.onderdelen[0].ingevuld).toBe(1);
  });
});
