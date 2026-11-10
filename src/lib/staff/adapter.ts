import type { Dienst, Gebruiker } from "../types";

/**
 * Alles wat we uit HorecaManager (Staff Support) nodig hebben, achter één interface.
 * De MockStaffAdapter levert demodata; zodra Staff API-documentatie en een
 * testomgeving levert, komt er een HttpStaffAdapter naast met dezelfde methodes.
 */
export interface StaffAdapter {
  naam: string;
  /** Diensten van één medewerker in een periode */
  rooster(gebruiker: Gebruiker, van: Date, tot: Date): Promise<Dienst[]>;
  /** Wie werkt er in dezelfde dienst (alleen voornamen tonen in de UI) */
  collegas(dienst: Dienst, gebruikers: Gebruiker[]): Promise<string[]>;
  /** Kan een goedgekeurde ruil direct worden teruggeschreven? */
  ondersteuntSchrijven: boolean;
  laatsteSync(): Date;
}

const DAG = ["Openen", "Kassa", "Bakken & uitgifte"];
const AVOND = ["Bakken & uitgifte", "Kassa", "Sluiten"];

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

function opDag(basis: Date, dag: number, uur: number, minuut = 0) {
  const d = new Date(basis);
  d.setDate(d.getDate() + dag);
  d.setHours(uur, minuut, 0, 0);
  return d;
}

/** Volgende zaterdag (of vandaag als het zaterdag is). */
export function volgendeZaterdag(basis = new Date()) {
  const d = new Date(basis);
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7));
  d.setHours(11, 0, 0, 0);
  return d;
}

export class MockStaffAdapter implements StaffAdapter {
  naam = "HorecaManager (demo)";
  ondersteuntSchrijven = false;
  private sync = new Date();

  laatsteSync() {
    return this.sync;
  }

  async rooster(gebruiker: Gebruiker, van: Date, tot: Date): Promise<Dienst[]> {
    if (gebruiker.rol === "hq" || gebruiker.rol === "franchisenemer") return [];
    const vestigingId = gebruiker.vestigingIds[0];
    const basis = new Date();
    basis.setHours(0, 0, 0, 0);
    const h = hash(gebruiker.id);
    const diensten: Dienst[] = [];
    for (let dag = -1; dag < 14; dag++) {
      if ((h + dag * 7) % 5 >= 3) continue; // ongeveer 3 van de 5 dagen
      const avond = (h + dag) % 2 === 0;
      const start = opDag(basis, dag, avond ? 16 : 11);
      const eind = opDag(basis, dag, avond ? 21 : 18, avond ? 30 : 0);
      diensten.push({
        id: `d-${gebruiker.id}-${dag}`,
        gebruikerId: gebruiker.id,
        vestigingId,
        start: start.toISOString(),
        eind: eind.toISOString(),
        taak: gebruiker.rol === "shiftleider" ? "Shiftleider" : (avond ? AVOND : DAG)[(h + dag) % 3],
      });
    }
    // Vaste demo-dienst die Mo aanbiedt in de chat
    if (gebruiker.id === "u-mo") {
      const za = volgendeZaterdag(basis);
      const zaEind = new Date(za);
      zaEind.setHours(18);
      diensten.push({ id: "d-mo-za", gebruikerId: "u-mo", vestigingId, start: za.toISOString(), eind: zaEind.toISOString(), taak: "Bakken & uitgifte" });
    }
    return diensten
      .filter((d) => new Date(d.eind) >= van && new Date(d.start) <= tot)
      .sort((a, b) => a.start.localeCompare(b.start));
  }

  async collegas(dienst: Dienst, gebruikers: Gebruiker[]): Promise<string[]> {
    const dag = dienst.start.slice(0, 10);
    const uit: string[] = [];
    for (const g of gebruikers) {
      if (g.id === dienst.gebruikerId || !g.vestigingIds.includes(dienst.vestigingId)) continue;
      if (g.rol === "franchisenemer" || g.rol === "hq") continue;
      const r = await this.rooster(g, new Date(dag), new Date(new Date(dag).getTime() + 86400000));
      if (r.some((d) => d.start.slice(0, 10) === dag)) uit.push(g.voornaam);
    }
    return uit;
  }
}

const g = globalThis as unknown as { __staff?: StaffAdapter };
/** De actieve koppeling. Later: HttpStaffAdapter als STAFF_API_URL is gezet. */
export const staff: StaffAdapter = (g.__staff ??= new MockStaffAdapter());
