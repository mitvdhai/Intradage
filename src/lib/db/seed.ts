import { sql } from "drizzle-orm";
import * as s from "../seed";
import { BELONINGSREGELING, FUNCTIES, PROFIEL_ITEMS } from "../functiehuis/seed";
import type { DB } from "./client";
import * as t from "./schema";

const d = (iso: string) => new Date(iso);

/** Laadt de demodata. Verwacht een lege database. */
export async function seed(db: DB) {
  await db.insert(t.regio).values(s.REGIO);
  await db.insert(t.franchisenemer).values(s.FRANCHISENEMERS);
  await db.insert(t.vestiging).values(s.VESTIGINGEN);

  await db.insert(t.profielItem).values(PROFIEL_ITEMS.map((p) => ({ ...p, niveaus: [...p.niveaus] })));
  await db.insert(t.functie).values(FUNCTIES.map((f) => ({ id: f.id, naam: f.naam, familie: f.familie, trede: f.trede, functiegroep: f.functiegroep, doel: f.doel, kerntaken: f.kerntaken, verantwoordelijkheden: f.verantwoordelijkheden, plaatsInOrganisatie: f.plaatsInOrganisatie })));
  await db.insert(t.functieProfiel).values(FUNCTIES.flatMap((f) => f.profiel.map((r) => ({ functieId: f.id, ...r, voorwaarde: !!r.voorwaarde }))));

  await db.insert(t.gebruiker).values(s.GEBRUIKERS.map((g) => { const { vestigingIds, ...rest } = g; void vestigingIds; return { ...rest, toonVerjaardag: !!g.toonVerjaardag }; }));
  await db.insert(t.gebruikerVestiging).values(s.GEBRUIKERS.flatMap((g) => g.vestigingIds.map((v) => ({ gebruikerId: g.id, vestigingId: v }))));
  await db.insert(t.salaris).values(s.SALARIS);

  await db.insert(t.handboekDoc).values(s.HANDBOEK.map((h) => ({ ...h, bijgewerkt: d(h.bijgewerkt), reviewVoor: d(h.reviewVoor) })));
  await db.insert(t.bericht).values(s.BERICHTEN.map((b) => ({
    id: b.id, titel: b.titel, inhoud: b.inhoud, urgentie: b.urgentie, vastgezet: b.vastgezet, doelgroep: b.doelgroep,
    gepubliceerd: d(b.gepubliceerd), vervalt: b.vervalt ? d(b.vervalt) : null, handboekDocId: b.handboekDocId ?? null,
    afzenderType: b.afzender.type,
    afzenderDiscipline: b.afzender.type === "hq" ? b.afzender.discipline : null,
    afzenderFranchisenemerId: b.afzender.type === "fn" ? b.afzender.franchisenemerId : null,
    afzenderNaam: b.afzender.type === "fn" ? b.afzender.naam : null,
  })));
  const statussen = Object.entries(s.LEESSTATUS).flatMap(([berichtId, per]) =>
    Object.entries(per).map(([gebruikerId, st]) => ({ berichtId, gebruikerId, gelezen: st.gelezen ? d(st.gelezen) : null, bevestigd: st.bevestigd ? d(st.bevestigd) : null })));
  if (statussen.length) await db.insert(t.berichtStatus).values(statussen);
  await db.insert(t.reactie).values(s.REACTIES.map((r) => ({ ...r, tijd: d(r.tijd) })));

  await db.insert(t.chatGroep).values(s.CHAT_GROEPEN.map((c) => ({ ...c, alleenLezen: !!c.alleenLezen })));
  await db.insert(t.chatBericht).values(s.CHAT_BERICHTEN.map((c) => ({ ...c, tijd: d(c.tijd) })));
  await db.insert(t.ruilverzoek).values(s.RUILVERZOEKEN);

  await db.insert(t.leerItem).values(s.LEERITEMS.map((l) => ({ ...l, onboarding: !!l.onboarding })));
  await db.insert(t.leerVoortgang).values(s.VOORTGANG.map((v) => ({ ...v, tijd: d(v.tijd) })));
  await db.insert(t.document).values(s.maakDocumenten().map((x) => ({ ...x, datum: d(x.datum) })));

  await db.insert(t.beloningsregeling).values({ ...BELONINGSREGELING, actief: true });
  for (const b of s.BEOORDELINGEN) {
    await db.insert(t.beoordeling).values({
      id: b.id, gebruikerId: b.gebruikerId, functieId: b.functieId, beoordelaarId: b.beoordelaarId, periode: b.periode, status: b.status,
      toelichting: b.toelichting ?? null, bijgewerkt: d(b.bijgewerkt),
      besluitPercentage: b.besluit?.percentage ?? null, besluitUurloon: b.besluit?.nieuwUurloon ?? null, besluitDoor: b.besluit?.door ?? null,
      besluitTijd: b.besluit ? d(b.besluit.tijd) : null, besluitToelichting: b.besluit?.toelichting ?? null,
    });
    const scores = [
      ...Object.entries(b.zelf).map(([itemId, niveau]) => ({ beoordelingId: b.id, itemId, bron: "zelf" as const, niveau })),
      ...Object.entries(b.beoordelaar).map(([itemId, niveau]) => ({ beoordelingId: b.id, itemId, bron: "beoordelaar" as const, niveau })),
    ];
    if (scores.length) await db.insert(t.beoordelingScore).values(scores);
  }
  await db.insert(t.medewerkerNiveau).values(Object.entries(s.HUIDIG_NIVEAU).flatMap(([gebruikerId, per]) =>
    Object.entries(per).map(([itemId, niveau]) => ({ gebruikerId, itemId, niveau }))));
}

/** Alle tabellen leegmaken (voor "demodata herstellen" en tests). */
export async function leegmaken(db: DB) {
  await db.execute(sql`truncate table audit_log, medewerker_niveau, beoordeling_score, beoordeling, beloningsregeling, ontgrendeling, document,
    leer_voortgang, leer_item, ruilverzoek, chat_bericht, chat_groep, reactie, bericht_status, bericht, handboek_doc, salaris,
    gebruiker_vestiging, gebruiker, functie_profiel, profiel_item, functie, vestiging, franchisenemer, regio restart identity cascade`);
}
