import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as t from "@/lib/db/schema";
import { magDossier, magKandidaatZien, medewerker } from "@/lib/personeel/data";
import { huidigeGebruiker } from "@/lib/session";

/** Een document uit het personeelsdossier downloaden: alleen de medewerker zelf of de leiding/HQ met rechten. */
export async function GET(_: Request, ctx: RouteContext<"/dossier/[id]">) {
  const { id } = await ctx.params;
  const s = await huidigeGebruiker();
  if (!s) return new Response("Niet ingelogd", { status: 401 });
  const db = await getDb();
  const [d] = await db.select().from(t.dossierDocument).where(eq(t.dossierDocument.id, id));
  if (!d?.inhoud) return new Response("Niet gevonden", { status: 404 });
  const m = await medewerker(d.gebruikerId);
  if (!m) return new Response("Niet gevonden", { status: 404 });
  const toegang = m.status === "kandidaat" ? await magKandidaatZien(s.org, s.u, m.id) : s.u.id === d.gebruikerId || magDossier(s.org, s.u, m);
  if (!toegang) return new Response("Geen toegang", { status: 403 });
  const { audit } = await import("@/lib/audit");
  await audit(s.u.id, "Dossierdocument bekeken", `${d.gebruikerId} · ${d.titel}`);
  return new Response(Buffer.from(d.inhoud, "base64"), {
    headers: { "Content-Type": d.mime ?? "application/octet-stream", "Content-Disposition": `inline; filename="${(d.bestandsnaam ?? "document").replace(/"/g, "")}"`, "Cache-Control": "private, no-store" },
  });
}
