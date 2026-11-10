import Link from "next/link";
import { Award, BookOpen, CalendarDays, ClipboardCheck, ExternalLink, Gift, MessageSquareHeart, Settings, UserPlus, Users } from "lucide-react";
import { Lijst, PageTop, Rij, Sectie } from "@/components/ui";
import { isHQ, isLeiding, magBeheer } from "@/lib/access";
import { uitloggen } from "@/lib/acties";
import { punten } from "@/lib/betrokkenheid";
import { vereisGebruiker } from "@/lib/session";

// Snelkoppelingen naar andere systemen. In productie per doelgroep instelbaar door HQ, met SSO waar mogelijk.
const SNELKOPPELINGEN = [
  { titel: "Pensioen (PH&C)", sub: "Je pensioenoverzicht in de horeca", url: "https://www.phenc.nl" },
  { titel: "Allergenenlijst (PDF)", sub: "Actuele versie voor gasten", url: "https://bramladage.nl" },
  { titel: "Vertrouwenspersoon", sub: "Vertrouwelijk je verhaal kwijt", url: "#vertrouwenspersoon" },
];

export default async function Meer() {
  const { u } = await vereisGebruiker();
  const p = await punten(u.id);
  const tegels = [
    { href: "/app/handboek", titel: "Handboek", sub: "Werkinstructies + vraag het", icoon: BookOpen },
    { href: "/app/waardering", titel: "Waardering", sub: `${p.saldo} punten`, icoon: Award, rood: true },
    { href: "/app/beloningen", titel: "Beloningen", sub: "Wissel je punten in", icoon: Gift },
    { href: "/app/enquetes", titel: "Enquêtes", sub: "Polls en ideeënbox", icoon: MessageSquareHeart },
    { href: "/app/evenementen", titel: "Evenementen", sub: "Agenda en aanmelden", icoon: CalendarDays },
    { href: "/app/smoelenboek", titel: "Smoelenboek", sub: "Wie werkt waar", icoon: Users },
    ...(isHQ(u) || isLeiding(u) ? [{ href: "/app/evaluaties", titel: "Evaluaties", sub: "Vestigingsscores en acties", icoon: ClipboardCheck }] : []),
  ];

  return (
    <>
      <PageTop titel="Meer" />
      <div className="grid grid-cols-2 gap-3 px-4 pt-4">
        {tegels.map((t) => (
          <Link key={t.href} href={t.href} className="rounded-2xl border border-line bg-white p-4 active:bg-slate-50">
            <span className={`mb-3 grid h-10 w-10 place-items-center rounded-xl ${t.rood ? "bg-brand-50 text-brand-600" : "bg-navy-50 text-navy-700"}`}><t.icoon size={20} /></span>
            <div className="font-semibold">{t.titel}</div>
            <div className="text-[13px] text-muted">{t.sub}</div>
          </Link>
        ))}
      </div>
      {!isHQ(u) && (
        <Sectie titel="Werken bij">
          <Lijst>
            <Rij href={`/werken-bij?ref=${u.personeelsnummer}`} icoon={<UserPlus size={18} />} titel="Ken jij iemand voor ons team?" sub="Deel een vacature met je eigen link · 50 punten als diegene wordt aangenomen" />
          </Lijst>
        </Sectie>
      )}
      <Sectie titel="Snelkoppelingen">
        <Lijst>
          {SNELKOPPELINGEN.map((s) => <Rij key={s.titel} href={s.url} icoon={<ExternalLink size={18} />} titel={s.titel} sub={s.sub} />)}
        </Lijst>
      </Sectie>
      <Sectie titel="Account">
        <Lijst>
          <Rij href={`/app/smoelenboek/${u.id}`} icoon={<Users size={18} />} titel="Mijn profiel" sub="Wat collega's van je zien" />
          {(magBeheer(u) || isLeiding(u)) && <Rij href={magBeheer(u) ? "/beheer" : "/beheer/planning"} icoon={<Settings size={18} />} titel="Beheeromgeving" sub="Planning, personeel en meer · op de laptop" />}
        </Lijst>
        <form action={uitloggen} className="mt-3"><button className="tap w-full rounded-xl text-[15px] font-semibold text-brand-700 ring-1 ring-line">Uitloggen</button></form>
      </Sectie>
    </>
  );
}
