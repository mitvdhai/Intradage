"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { isHQ, mag, scopeVestigingen } from "./access";
import { audit } from "./audit";
import { getDb } from "./db/client";
import * as t from "./db/schema";
import { ALLEEN_HQ, MODULES, niveauVan, ROLLEN, type Module, type Niveau } from "./rechten";
import { vereisGebruiker } from "./session";

type Res = { fout?: string; ok?: boolean; info?: string };
const isModule = (m: string): m is Module => MODULES.some((x) => x.id === m);

/** Rolmatrix opslaan (alleen met 'rechten: beheren', standaard HQ). HQ houdt altijd beheer over rechten, zodat niemand zich buitensluit. */
export async function slaRolRechtenOp(_: unknown, fd: FormData): Promise<Res> {
  const { u, org } = await vereisGebruiker();
  if (!mag(org, u, "rechten")) return { fout: "Alleen wie rechten mag beheren, past de rolmatrix aan." };
  const rijen: { rol: (typeof ROLLEN)[number]; module: string; niveau: number }[] = [];
  for (const rol of ROLLEN) for (const m of MODULES) {
    const v = Number(fd.get(`r-${rol}-${m.id}`));
    if (![0, 1, 2].includes(v)) continue;
    rijen.push({ rol, module: m.id, niveau: rol === "hq" && (m.id === "rechten" || m.id === "logboek") ? 2 : v });
  }
  const db = await getDb();
  const oud = await db.select().from(t.rolRecht);
  const gewijzigd = rijen.filter((r) => oud.find((o) => o.rol === r.rol && o.module === r.module)?.niveau !== r.niveau);
  for (const r of gewijzigd) await db.insert(t.rolRecht).values(r).onConflictDoUpdate({ target: [t.rolRecht.rol, t.rolRecht.module], set: { niveau: r.niveau } });
  if (gewijzigd.length) await audit(u.id, "Rolrechten gewijzigd", gewijzigd.map((r) => `${r.rol}.${r.module}=${r.niveau}`).join(", "));
  revalidatePath("/", "layout");
  return { ok: true, info: gewijzigd.length ? `${gewijzigd.length} wijziging${gewijzigd.length > 1 ? "en" : ""} opgeslagen.` : "Geen wijzigingen." };
}

async function magPersoonInstellen(gebruikerId: string, module: Module, niveau: Niveau) {
  const { u, org } = await vereisGebruiker();
  if (!mag(org, u, "rechten", 1)) return { fout: "Geen rechten." } as const;
  if (gebruikerId === u.id) return { fout: "Je kunt je eigen rechten niet wijzigen." } as const;
  const doel = org.gebruikers.find((g) => g.id === gebruikerId);
  if (!doel) return { fout: "Persoon niet gevonden." } as const;
  if (!isHQ(u)) {
    const scope = new Set(scopeVestigingen(org, u));
    if (doel.rol === "hq" || !doel.vestigingIds.some((v) => scope.has(v))) return { fout: "Je kunt alleen rechten geven aan mensen in je eigen vestigingen." } as const;
  }
  if (!mag(org, u, "rechten") && ALLEEN_HQ.includes(module)) return { fout: "Dit onderdeel kan alleen HQ toekennen." } as const;
  if (niveau > niveauVan(org.rechten, u, module)) return { fout: "Je kunt niet meer rechten geven dan je zelf hebt." } as const;
  return { u, org, doel } as const;
}

/** Uitzondering voor één persoon: meer (bijv. shiftleider mag plannen) of juist minder dan de rol. */
export async function zetPersoonRecht(_: unknown, fd: FormData): Promise<Res> {
  const gebruikerId = String(fd.get("persoon") ?? ""), mod = String(fd.get("module") ?? ""), niveau = Number(fd.get("niveau"));
  if (!isModule(mod) || ![0, 1, 2].includes(niveau)) return { fout: "Kies een persoon, onderdeel en niveau." };
  const c = await magPersoonInstellen(gebruikerId, mod, niveau as Niveau);
  if ("fout" in c) return { fout: c.fout };
  const reden = String(fd.get("reden") ?? "").trim().slice(0, 200) || null;
  const db = await getDb();
  await db.insert(t.persoonRecht).values({ gebruikerId, module: mod, niveau, door: c.u.id, reden })
    .onConflictDoUpdate({ target: [t.persoonRecht.gebruikerId, t.persoonRecht.module], set: { niveau, door: c.u.id, reden, tijd: new Date() } });
  await audit(c.u.id, "Recht per persoon ingesteld", `${gebruikerId} · ${mod}=${niveau}${reden ? ` · ${reden}` : ""}`);
  revalidatePath("/", "layout");
  return { ok: true, info: `${c.doel.voornaam}: ${MODULES.find((m) => m.id === mod)!.naam} ingesteld.` };
}

export async function verwijderPersoonRecht(gebruikerId: string, module: string) {
  if (!isModule(module)) return;
  const c = await magPersoonInstellen(gebruikerId, module, 0);
  if ("fout" in c) return;
  const db = await getDb();
  await db.delete(t.persoonRecht).where(and(eq(t.persoonRecht.gebruikerId, gebruikerId), eq(t.persoonRecht.module, module)));
  await audit(c.u.id, "Recht per persoon verwijderd", `${gebruikerId} · ${module}`);
  revalidatePath("/", "layout");
}
