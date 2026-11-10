import type { Rol } from "./types";

// Rollen en rechten: per rol × module een niveau, met uitzonderingen per persoon.
// Het niveau bepaalt WAT je mag; de organisatie bepaalt OVER WIE (HQ: alles,
// franchisenemer: eigen vestigingen, manager en shiftleider: hun vestiging(en)).

export type Niveau = 0 | 1 | 2;
export const NIVEAU_LABEL: Record<Niveau, string> = { 0: "Geen toegang", 1: "Bekijken", 2: "Beheren" };

export const MODULES = [
  { id: "berichten", groep: "Communicatie", naam: "Berichten", uitleg: "Berichten met doelgroep versturen en bereik zien" },
  { id: "betrokkenheid", groep: "Communicatie", naam: "Betrokkenheid", uitleg: "Peilingen en evenementen maken, beloningen uitreiken" },
  { id: "handboek", groep: "Kennis", naam: "Handboek", uitleg: "Handboekdocumenten schrijven, wijzigen en reviewen" },
  { id: "leren", groep: "Kennis", naam: "Leren", uitleg: "Leeritems en onboarding samenstellen" },
  { id: "evaluaties", groep: "Kwaliteit", naam: "Evaluaties", uitleg: "Vestigingsevaluaties uitvoeren, actiepunten" },
  { id: "beoordelingen", groep: "Ontwikkeling", naam: "Beoordelingen", uitleg: "Medewerkers beoordelen, salarisbesluit vastleggen" },
  { id: "functiehuis", groep: "Ontwikkeling", naam: "Functiehuis", uitleg: "Functieprofielen en wegingen" },
  { id: "regeling", groep: "Ontwikkeling", naam: "Beloningsregeling", uitleg: "Uitkomstgrenzen en verhogingspercentages" },
  { id: "planning", groep: "Personeel", naam: "Planning", uitleg: "Rooster voorstellen, schuiven en publiceren" },
  { id: "uren", groep: "Personeel", naam: "Uren", uitleg: "Uren bevestigen, uitdraai en export" },
  { id: "verlof", groep: "Personeel", naam: "Verlof en ziekte", uitleg: "Verlofaanvragen beoordelen" },
  { id: "medewerkers", groep: "Personeel", naam: "Medewerkers", uitleg: "Personeelsdossier, inzet, documenten, in en uit dienst" },
  { id: "contracten", groep: "Personeel", naam: "Contracten", uitleg: "Contracten opstellen en tekenen als werkgever" },
  { id: "werving", groep: "Personeel", naam: "Werving", uitleg: "Vacatures, kandidaten, aannemen" },
  { id: "vestigingen", groep: "Personeel", naam: "Vestigingen", uitleg: "Openingstijden en standaardbezetting" },
  { id: "instellingen", groep: "Beheer", naam: "Instellingen", uitleg: "Posities, kernwaarden, beloningen, checklists" },
  { id: "organisatie", groep: "Beheer", naam: "Organisatie", uitleg: "Franchisenemers en vestigingen aanmaken" },
  { id: "rechten", groep: "Beheer", naam: "Rollen en rechten", uitleg: "Beheren: de rolmatrix. Bekijken: uitzonderingen voor eigen mensen" },
  { id: "logboek", groep: "Beheer", naam: "Logboek", uitleg: "Alle beheeracties en inzages" },
] as const;
export type Module = (typeof MODULES)[number]["id"];

const alles = (n: Niveau) => Object.fromEntries(MODULES.map((m) => [m.id, n])) as Record<Module, Niveau>;

/** Standaardverdeling. HQ kan dit per rol aanpassen; uitzonderingen zet je per persoon. */
export const STANDAARD: Record<Rol, Record<Module, Niveau>> = {
  hq: alles(2),
  franchisenemer: { ...alles(2), functiehuis: 1, regeling: 0, handboek: 1, leren: 1, instellingen: 0, organisatie: 0, rechten: 1, logboek: 0 },
  manager: { ...alles(0), berichten: 1, betrokkenheid: 1, handboek: 1, leren: 1, evaluaties: 2, beoordelingen: 2, functiehuis: 1, planning: 2, uren: 2, verlof: 2, medewerkers: 2, contracten: 1, werving: 2, vestigingen: 2 },
  shiftleider: { ...alles(0), evaluaties: 1, planning: 1, uren: 2, verlof: 1 },
  medewerker: alles(0),
};

export const ROLLEN: Rol[] = ["hq", "franchisenemer", "manager", "shiftleider", "medewerker"];

/** Modules die alleen HQ kan toekennen; een franchisenemer kan hier geen uitzonderingen voor maken. */
export const ALLEEN_HQ: Module[] = ["regeling", "instellingen", "organisatie", "rechten", "logboek", "functiehuis"];

export interface Rechten {
  rol: Map<Rol, Partial<Record<Module, Niveau>>>;
  persoon: Map<string, Partial<Record<Module, Niveau>>>;
}

export function niveauVan(rechten: Rechten | undefined, u: { id: string; rol: Rol }, module: Module): Niveau {
  const p = rechten?.persoon.get(u.id)?.[module];
  if (p !== undefined) return p;
  const r = rechten?.rol.get(u.rol)?.[module];
  return r ?? STANDAARD[u.rol][module];
}
