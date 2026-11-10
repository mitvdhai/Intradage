import type { HandboekDoc } from "../types";

// Eenvoudige, uitlegbare retrieval over handboekpassages (kop + alinea).
// In productie vervangen/aangevuld door pgvector (betekenis) + full-text (trefwoord).

export interface Passage { docId: string; titel: string; versie: string; kop: string; tekst: string }
export interface Treffer extends Passage { score: number }

const STOP = new Set("de het een en of in op aan van voor met bij als dan dat die dit is zijn wordt worden je jij jouw we wij ik mag moet kan hoe wat wie waar wanneer welke er niet nog ook al te om tot naar uit over".split(" "));

export function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t))
    .map(stam);
}

/** Heel lichte Nederlandse stemming: meervoud en verkleinwoord. */
function stam(t: string) {
  return t.replace(/(tjes|tje|jes|je|en|s)$/u, "") || t;
}

export function passages(docs: HandboekDoc[]): Passage[] {
  const uit: Passage[] = [];
  for (const d of docs) {
    const blokken = d.inhoud.split(/^## /m).filter(Boolean);
    for (const b of blokken) {
      const [kop, ...rest] = b.split("\n");
      uit.push({ docId: d.id, titel: d.titel, versie: d.versie, kop: kop.trim(), tekst: rest.join(" ").trim() });
    }
  }
  return uit;
}

export function zoek(vraag: string, docs: HandboekDoc[], max = 3): Treffer[] {
  const q = tokens(vraag);
  if (!q.length) return [];
  const ps = passages(docs);
  const df = new Map<string, number>();
  const ptoks = ps.map((p) => {
    const t = tokens(`${p.titel} ${p.kop} ${p.kop} ${p.tekst}`);
    new Set(t).forEach((x) => df.set(x, (df.get(x) ?? 0) + 1));
    return t;
  });
  const N = ps.length;
  return ps
    .map((p, i) => {
      const t = ptoks[i];
      let score = 0;
      for (const w of new Set(q)) {
        const tf = t.filter((x) => x === w || (w.length > 4 && x.startsWith(w))).length;
        if (tf) score += (1 + Math.log(tf)) * Math.log(1 + N / (df.get(w) ?? 1));
      }
      return { ...p, score: score / Math.sqrt(new Set(q).size) };
    })
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, max);
}

/** Onder deze relevantie zeggen we liever "weet ik niet" dan te gokken. */
export const DREMPEL = 0.9;
