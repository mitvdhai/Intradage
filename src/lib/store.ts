import "server-only";
import * as seed from "./seed";
import { BELONINGSREGELING, FUNCTIES, PROFIEL_ITEMS } from "./functiehuis/seed";
import { MockStaffAdapter } from "./staff/adapter";
import type { AuditRegel } from "./types";

// In-memory opslag voor de prototypefase. Blijft bewaard zolang de server draait.
// Alle schrijfacties lopen via src/lib/acties/*, zodat we dit later 1-op-1
// vervangen door PostgreSQL zonder de schermen aan te passen.

function maakStore() {
  const kopie = <T,>(x: T): T => structuredClone(x);
  const s = {
    regio: kopie(seed.REGIO),
    franchisenemers: kopie(seed.FRANCHISENEMERS),
    vestigingen: kopie(seed.VESTIGINGEN),
    gebruikers: kopie(seed.GEBRUIKERS),
    berichten: kopie(seed.BERICHTEN),
    leesstatus: kopie(seed.LEESSTATUS),
    reacties: kopie(seed.REACTIES),
    chatGroepen: kopie(seed.CHAT_GROEPEN),
    chatBerichten: kopie(seed.CHAT_BERICHTEN),
    ruilverzoeken: kopie(seed.RUILVERZOEKEN),
    leeritems: kopie(seed.LEERITEMS),
    voortgang: kopie(seed.VOORTGANG),
    handboek: kopie(seed.HANDBOEK),
    documenten: seed.maakDocumenten(),
    salaris: kopie(seed.SALARIS),
    profielItems: kopie(PROFIEL_ITEMS),
    functies: kopie(FUNCTIES),
    regeling: kopie(BELONINGSREGELING),
    beoordelingen: kopie(seed.BEOORDELINGEN),
    huidigNiveau: kopie(seed.HUIDIG_NIVEAU),
    audit: [] as AuditRegel[],
    /** Tijdelijk ontgrendelde gevoelige documenten: gebruikerId → verloopt (ms) */
    ontgrendeld: {} as Record<string, number>,
  };
  return s;
}

type Store = ReturnType<typeof maakStore>;
const g = globalThis as unknown as { __intradage?: Store; __staff?: MockStaffAdapter };

export const db: Store = (g.__intradage ??= maakStore());
export const staff: MockStaffAdapter = (g.__staff ??= new MockStaffAdapter(() => db.gebruikers));

export function audit(gebruikerId: string, actie: string, details?: string) {
  db.audit.unshift({ tijd: new Date().toISOString(), gebruikerId, actie, details });
}

export const profielItemMap = () => new Map(db.profielItems.map((i) => [i.id, i]));
