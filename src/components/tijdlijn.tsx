import Link from "next/link";
import { Award, Cake, Heart, MessageCircle, PartyPopper, Sparkles, Trash2 } from "lucide-react";
import { toggleLike, verwijderPost } from "@/lib/acties-betrokkenheid";
import type { TijdlijnItem } from "@/lib/betrokkenheid";
import { afzenderLabel, DISCIPLINE_LABEL, vestigingNaam } from "@/lib/data";
import type { Org } from "@/lib/org";
import type { Gebruiker } from "@/lib/types";
import { cx, tijdLabel } from "./ui";

function Avatar({ naam, toon = "navy", groot }: { naam: string; toon?: "navy" | "rood" | "hq"; groot?: boolean }) {
  const cls = toon === "rood" ? "bg-brand-600 text-white" : toon === "hq" ? "bg-navy-700 text-white" : "bg-navy-100 text-navy-700";
  return <span className={cx("grid shrink-0 place-items-center rounded-full font-semibold", groot ? "h-11 w-11 text-base" : "h-9 w-9 text-sm", cls)}>{naam.slice(0, 1)}</span>;
}

function LikeKnop({ type, id, aantal, geliked }: { type: "bericht" | "waardering"; id: string; aantal: number; geliked: boolean }) {
  return (
    <form action={toggleLike.bind(null, type, id)}>
      <button className={cx("tap inline-flex items-center gap-1.5 rounded-lg px-2 text-[13px] font-semibold", geliked ? "text-brand-600" : "text-muted")} aria-pressed={geliked}>
        <Heart size={17} fill={geliked ? "currentColor" : "none"} /> {aantal > 0 ? aantal : ""} <span className="sr-only">Vind ik leuk</span>
      </button>
    </form>
  );
}

const voor = (org: Org, id: string) => org.gebruikers.find((g) => g.id === id);

export function TijdlijnKaart({ item, org, u }: { item: TijdlijnItem; org: Org; u: Gebruiker }) {
  if (item.soort === "bericht") {
    const b = item.b;
    const isPost = b.afzender.type === "medewerker";
    const auteur = isPost ? voor(org, (b.afzender as { gebruikerId: string }).gebruikerId) : undefined;
    const magVerwijderen = isPost && (auteur?.id === u.id || u.rol === "hq" || u.rol === "franchisenemer" || u.rol === "manager");
    return (
      <article className="rounded-2xl border border-line bg-white">
        <div className="flex items-center gap-3 px-4 pt-3.5">
          <Avatar naam={isPost ? (auteur?.voornaam ?? "?") : b.afzender.type === "hq" ? "B" : afzenderLabel(b)} toon={b.afzender.type === "hq" ? "hq" : "navy"} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-semibold">{isPost ? `${auteur?.voornaam ?? "Collega"} ${auteur?.achternaam ?? ""}` : b.afzender.type === "hq" ? `Bram Ladage · ${DISCIPLINE_LABEL[b.afzender.discipline]}` : afzenderLabel(b)}</div>
            <div className="text-[12px] text-muted">{isPost && auteur ? `${vestigingNaam(org, auteur.vestigingIds[0] ?? "")} · ` : ""}{tijdLabel(b.gepubliceerd)}{b.urgentie === "belangrijk" && <span className="ml-1 font-semibold text-brand-600">· belangrijk</span>}</div>
          </div>
        </div>
        <Link href={`/app/berichten/${b.id}`} className="block px-4 pb-1 pt-2.5">
          {!isPost && <h3 className="mb-0.5 text-[16px] font-bold leading-snug text-ink">{b.titel}</h3>}
          <p className="line-clamp-4 whitespace-pre-line text-[15px] leading-relaxed text-ink">{b.inhoud.replace(/^- /gm, "• ")}</p>
        </Link>
        <div className="flex items-center gap-1 border-t border-line px-2 py-0.5">
          <LikeKnop type="bericht" id={b.id} aantal={item.likes} geliked={item.geliked} />
          <Link href={`/app/berichten/${b.id}`} className="tap inline-flex items-center gap-1.5 rounded-lg px-2 text-[13px] font-semibold text-muted"><MessageCircle size={17} /> {item.reacties > 0 ? item.reacties : ""}</Link>
          {magVerwijderen && <form action={verwijderPost.bind(null, b.id)} className="ml-auto"><button className="tap rounded-lg px-2 text-muted" aria-label="Verwijderen"><Trash2 size={16} /></button></form>}
        </div>
      </article>
    );
  }
  if (item.soort === "waardering") {
    const w = item.w;
    const van = voor(org, w.vanId), aan = voor(org, w.aanId);
    return (
      <article className="overflow-hidden rounded-2xl border border-brand-100 bg-white">
        <div className="flex items-center gap-2 bg-brand-50 px-4 py-2 text-[12px] font-semibold uppercase tracking-wide text-brand-700"><Award size={15} /> Waardering · {w.waarde.emoji} {w.waarde.naam}</div>
        <Link href={`/app/smoelenboek/${w.aanId}`} className="flex items-center gap-3 px-4 pt-3">
          <Avatar naam={aan?.voornaam ?? "?"} toon="rood" groot />
          <div className="min-w-0"><div className="text-[15px] font-bold">{aan?.voornaam} {aan?.achternaam}</div><div className="text-[12px] text-muted">van {van?.voornaam} · {tijdLabel(w.tijd)}</div></div>
        </Link>
        <p className="px-4 pb-2 pt-2 text-[15px] leading-relaxed">“{w.tekst}”</p>
        <div className="flex items-center border-t border-line px-2 py-0.5">
          <LikeKnop type="waardering" id={w.id} aantal={item.likes} geliked={item.geliked} />
          <Link href={`/app/waardering/geven?aan=${w.aanId}`} className="ml-auto mr-2 text-[13px] font-semibold text-navy-600">Ook waarderen</Link>
        </div>
      </article>
    );
  }
  const m = item.m;
  const I = m.soort === "verjaardag" ? Cake : m.soort === "jubileum" ? PartyPopper : Sparkles;
  const tekst = m.soort === "verjaardag" ? `${m.gebruiker.voornaam} is ${m.datum.toDateString() === new Date().toDateString() ? "vandaag" : m.datum > new Date() ? "binnenkort" : ""} jarig! 🎂`
    : m.soort === "jubileum" ? `${m.gebruiker.voornaam} werkt ${m.jaren} jaar bij Bram Ladage! 🎉`
      : `Welkom ${m.gebruiker.voornaam}! Nieuw bij ${vestigingNaam(org, m.gebruiker.vestigingIds[0] ?? "")} 👋`;
  return (
    <article className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-navy-50 text-navy-700"><I size={20} /></span>
      <div className="min-w-0 flex-1 text-[14px] font-semibold">{tekst.replace("  ", " ")}</div>
      {m.gebruiker.id !== u.id && <Link href={`/app/waardering/geven?aan=${m.gebruiker.id}`} className="shrink-0 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-navy-700 ring-1 ring-line">Feliciteer</Link>}
    </article>
  );
}
