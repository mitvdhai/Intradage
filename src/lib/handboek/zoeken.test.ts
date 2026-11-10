import { describe, expect, it } from "vitest";
import { HANDBOEK } from "../seed";
import { DREMPEL, zoek } from "./zoeken";

describe("handboek zoeken", () => {
  it("vindt de warmhoudbak-passage", () => {
    const [top] = zoek("Hoe lang mag patat in de warmhoudbak?", HANDBOEK);
    expect(top.docId).toBe("d-bakken");
    expect(top.kop).toBe("Warmhoudbak");
    expect(top.score).toBeGreaterThan(DREMPEL);
  });
  it("vindt de koeltemperatuur", () => {
    const [top] = zoek("hoe koud moet de koelcel zijn", HANDBOEK);
    expect(top.kop).toBe("Koeling");
  });
  it("geeft geen zekere treffer voor iets dat er niet in staat", () => {
    const r = zoek("wat is het wachtwoord van de wifi", HANDBOEK);
    expect(r.length === 0 || r[0].score < DREMPEL).toBe(true);
  });
  it("respecteert de documenten die je meegeeft (rechten)", () => {
    const zonderOpenen = HANDBOEK.filter((d) => d.id !== "d-openen");
    const r = zoek("kassa aftellen bij sluiten", zonderOpenen);
    expect(r.every((t) => t.docId !== "d-openen")).toBe(true);
  });
});
