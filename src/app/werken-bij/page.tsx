import Link from "next/link";
import { connection } from "next/server";
import { ChevronRight, Clock, MapPin } from "lucide-react";
import { PubliekeKop } from "@/components/publiek";
import { getOrg } from "@/lib/org";
import { vacatures } from "@/lib/personeel/data";

export const metadata = { title: "Werken bij Bram Ladage" };

export default async function WerkenBij({ searchParams }: PageProps<"/werken-bij">) {
  await connection();
  const { ref } = await searchParams;
  const [org, lijst] = await Promise.all([getOrg(), vacatures()]);
  const open = lijst.filter((v) => v.status === "open");
  return (
    <main className="mx-auto min-h-screen max-w-md bg-canvas">
      <PubliekeKop titel="Kom jij ons team versterken?" sub="De lekkerste patat maak je samen. Vanaf 15 jaar, ook zonder ervaring." />
      <div className="space-y-3 px-4 py-5">
        {open.map((v) => {
          const vest = org.vestigingen.find((x) => x.id === v.vestigingId);
          return (
            <Link key={v.id} href={`/werken-bij/${v.slug}${typeof ref === "string" ? `?ref=${ref}` : ""}`} className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4">
              <div className="flex-1">
                <div className="text-[16px] font-bold">{v.titel}</div>
                <div className="mt-1 flex flex-wrap gap-x-3 text-[13px] text-muted"><span className="inline-flex items-center gap-1"><MapPin size={13} /> {vest?.naam}, {vest?.plaats}</span><span className="inline-flex items-center gap-1"><Clock size={13} /> {v.uren}</span></div>
              </div>
              <ChevronRight className="text-slate-300" />
            </Link>
          );
        })}
        {!open.length && <p className="text-center text-muted">Op dit moment geen vacatures. Kom snel terug!</p>}
      </div>
    </main>
  );
}
