import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Clock, MapPin } from "lucide-react";
import { SollicitatieForm } from "@/components/sollicitatie-form";
import { PubliekeKop } from "@/components/publiek";
import { getOrg } from "@/lib/org";
import { vacatureOpSlug } from "@/lib/personeel/data";

export default async function Vacature({ params, searchParams }: PageProps<"/werken-bij/[slug]">) {
  await connection();
  const { slug } = await params;
  const { ref } = await searchParams;
  const [org, v] = await Promise.all([getOrg(), vacatureOpSlug(slug)]);
  if (!v) notFound();
  const vest = org.vestigingen.find((x) => x.id === v.vestigingId);
  return (
    <main className="mx-auto min-h-screen max-w-md bg-canvas">
      <PubliekeKop titel={v.titel}>
        <div className="mt-2 flex flex-wrap gap-x-4 text-sm text-navy-100"><span className="inline-flex items-center gap-1"><MapPin size={14} /> {vest?.naam}, {vest?.plaats}</span><span className="inline-flex items-center gap-1"><Clock size={14} /> {v.uren}</span></div>
      </PubliekeKop>
      <div className="space-y-4 px-4 py-5">
        <p className="text-[15px] leading-relaxed">{v.omschrijving}</p>
        <ul className="space-y-1 rounded-2xl bg-white p-4 text-[14px]">
          <li>🍟 Gratis Brammetje en drinken tijdens je dienst</li>
          <li>📱 Rooster, ruilen en verlof in één app</li>
          <li>🎓 Je leert alles in korte video&apos;s en op de vloer</li>
          <li>💶 Loon volgens de horeca-cao, plus 8% vakantiegeld</li>
        </ul>
        {v.status === "open" ? <SollicitatieForm slug={slug} refCode={typeof ref === "string" ? ref : ""} /> : <p className="rounded-xl bg-slate-100 p-4 text-center text-muted">Deze vacature is gesloten.</p>}
      </div>
    </main>
  );
}
