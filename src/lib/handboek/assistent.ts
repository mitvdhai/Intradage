import "server-only";
import type { HandboekDoc } from "../types";
import { DREMPEL, zoek, type Treffer } from "./zoeken";

export interface Antwoord {
  tekst: string;
  bronnen: Treffer[];
  weetNiet: boolean;
  modus: "ai" | "extractief";
}

/**
 * Beantwoordt een vraag uitsluitend op basis van handboekpassages die de
 * gebruiker mag zien. Zonder API-sleutel: extractief antwoord (de beste passage).
 * Met ANTHROPIC_API_KEY: een taalmodel formuleert, maar alleen uit de passages.
 */
export async function beantwoord(vraag: string, docs: HandboekDoc[]): Promise<Antwoord> {
  const bronnen = zoek(vraag, docs, 3);
  if (!bronnen.length || bronnen[0].score < DREMPEL) {
    return {
      tekst: "Dat staat niet in jouw handboek. Vraag het je shiftleider; je vraag is doorgegeven aan HQ zodat het handboek kan worden aangevuld.",
      bronnen: [],
      weetNiet: true,
      modus: "extractief",
    };
  }
  const relevant = bronnen.filter((b) => b.score >= bronnen[0].score * 0.5);

  const key = process.env.ANTHROPIC_API_KEY;
  if (key) {
    try {
      const tekst = await vraagModel(vraag, relevant, key);
      if (tekst && !/^GEEN_ANTWOORD/.test(tekst)) return { tekst, bronnen: relevant, weetNiet: false, modus: "ai" };
      if (tekst) return { tekst: "Dat staat niet duidelijk in jouw handboek. Vraag het je shiftleider.", bronnen: [], weetNiet: true, modus: "ai" };
    } catch {
      // val terug op extractief antwoord
    }
  }
  return { tekst: relevant[0].tekst, bronnen: relevant, weetNiet: false, modus: "extractief" };
}

async function vraagModel(vraag: string, bronnen: Treffer[], key: string): Promise<string> {
  const context = bronnen.map((b, i) => `[${i + 1}] ${b.titel} v${b.versie} – ${b.kop}\n${b.tekst}`).join("\n\n");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5",
      max_tokens: 300,
      system:
        "Je bent de handboekassistent van een fastfoodketen. Antwoord kort (max. 3 zinnen), op B1-niveau, in de taal van de vraag. " +
        "Gebruik UITSLUITEND de genummerde passages. Staat het antwoord er niet in, antwoord dan exact: GEEN_ANTWOORD. Verzin nooit iets.",
      messages: [{ role: "user", content: `Passages:\n${context}\n\nVraag: ${vraag}` }],
    }),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`AI ${res.status}`);
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  return (data.content ?? []).filter((c) => c.type === "text").map((c) => c.text).join("").trim();
}
