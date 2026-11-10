import { headers } from "next/headers";
import { CalendarPlus } from "lucide-react";
import { Kaart, PageTop } from "@/components/ui";
import { medewerker } from "@/lib/personeel/data";
import { vereisGebruiker } from "@/lib/session";

export default async function Agenda() {
  const { u } = await vereisGebruiker();
  const m = await medewerker(u.id);
  const host = (await headers()).get("host") ?? "intradage.nl";
  const pad = `${host}/agenda/${m?.agendaToken ?? "-"}`;
  return (
    <>
      <PageTop terug={{ href: "/app/werk", label: "Mijn werk" }} titel="Rooster in je agenda" />
      <div className="space-y-3 px-4 pt-4">
        <Kaart>
          <p className="text-[15px]">Je diensten verschijnen vanzelf in de agenda van je telefoon, en blijven bijgewerkt als het rooster verandert.</p>
          <a href={`webcal://${pad}`} className="tap mt-3 flex items-center justify-center gap-2 rounded-xl bg-brand-600 text-[15px] font-semibold text-white"><CalendarPlus size={18} /> Toevoegen aan agenda</a>
          <p className="mt-3 break-all rounded-lg bg-slate-50 p-2 font-mono text-[11px] text-muted">https://{pad}</p>
        </Kaart>
        <p className="px-1 text-[13px] text-muted">Werkt de knop niet? Kopieer de link en voeg hem toe als &quot;agenda-abonnement&quot; (iPhone: Instellingen › Agenda › Accounts; Google Agenda: Andere agenda&apos;s › Via URL). Deel de link niet: wie hem heeft, ziet je rooster.</p>
      </div>
    </>
  );
}
