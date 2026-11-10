import "server-only";
import { getDb } from "./db/client";
import { auditLog } from "./db/schema";

/** Schrijft een regel in het logboek (beheeracties en inzage van gevoelige gegevens). */
export async function audit(gebruikerId: string, actie: string, details?: string) {
  const db = await getDb();
  await db.insert(auditLog).values({ gebruikerId, actie, details });
}
