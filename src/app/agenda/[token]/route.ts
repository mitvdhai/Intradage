import { and, eq, gte } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as t from "@/lib/db/schema";

const ical = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/[\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");

/** Agenda-abonnement (iCal) met de gepubliceerde diensten van één medewerker. Toegang via een geheim token. */
export async function GET(_: Request, ctx: RouteContext<"/agenda/[token]">) {
  const token = (await ctx.params).token.replace(/\.ics$/, "");
  const db = await getDb();
  const [g] = await db.select().from(t.gebruiker).where(eq(t.gebruiker.agendaToken, token));
  if (!g) return new Response("Niet gevonden", { status: 404 });
  const rijen = await db.select({ d: t.dienst, positie: t.positie.naam, vestiging: t.vestiging.naam, adres: t.vestiging.adres }).from(t.dienst)
    .innerJoin(t.positie, eq(t.positie.id, t.dienst.positieId)).innerJoin(t.vestiging, eq(t.vestiging.id, t.dienst.vestigingId))
    .where(and(eq(t.dienst.gebruikerId, g.id), eq(t.dienst.status, "gepubliceerd"), gte(t.dienst.eind, new Date(Date.now() - 30 * 86400000))));
  const regels = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Intradage//Rooster//NL", "CALSCALE:GREGORIAN", `X-WR-CALNAME:Rooster ${esc(g.voornaam)} · Bram Ladage`, "X-PUBLISHED-TTL:PT1H",
    ...rijen.flatMap(({ d, positie, vestiging, adres }) => [
      "BEGIN:VEVENT", `UID:${d.id}@intradage`, `DTSTAMP:${ical(new Date())}`, `DTSTART:${ical(d.start)}`, `DTEND:${ical(d.eind)}`,
      `SUMMARY:${esc(`Werken · ${positie} · ${vestiging}`)}`, `LOCATION:${esc(adres ?? vestiging)}`, `DESCRIPTION:${esc(`Pauze ${d.pauzeMin} min. Wijzigingen zie je in Intradage.`)}`, "END:VEVENT",
    ]),
    "END:VCALENDAR",
  ];
  return new Response(regels.join("\r\n"), { headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, max-age=900" } });
}
