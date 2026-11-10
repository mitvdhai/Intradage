import { Label, Lijst, PageTop, Rij, Sectie, tijdLabel } from "@/components/ui";
import { vraagBeloningAan } from "@/lib/acties-betrokkenheid";
import { beloningAanvragen, beloningen, punten } from "@/lib/betrokkenheid";
import { vereisGebruiker } from "@/lib/session";

export default async function Beloningen() {
  const { u } = await vereisGebruiker();
  const [p, lijst, aanvragen] = await Promise.all([punten(u.id), beloningen(), beloningAanvragen({ gebruikerId: u.id })]);
  const titel = new Map(lijst.map((b) => [b.id, `${b.emoji} ${b.titel}`]));
  return (
    <>
      <PageTop terug={{ href: "/app/waardering", label: "Waardering" }} titel="Beloningen" />
      <div className="px-4 pt-4">
        <div className="rounded-2xl bg-navy-700 p-4 text-white">
          <div className="flex items-end justify-between">
            <div><div className="text-[12px] font-semibold uppercase tracking-wider text-navy-200">Te besteden</div><div className="text-3xl font-bold">{p.saldo} punten</div></div>
            <div className="text-right text-[12px] text-navy-100">{p.ontvangen} van waarderingen<br />{p.geleerd} van leren · {p.gegeven} van geven</div>
          </div>
        </div>
      </div>
      <Sectie titel="Kies een beloning">
        <div className="space-y-3">
          {lijst.map((b) => {
            const kan = p.saldo >= b.punten;
            return (
              <div key={b.id} className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4">
                <span className="text-3xl">{b.emoji}</span>
                <div className="min-w-0 flex-1"><div className="font-semibold">{b.titel}</div><div className="text-[13px] text-muted">{b.omschrijving}</div></div>
                <form action={vraagBeloningAan.bind(null, b.id)}>
                  <button disabled={!kan} className="rounded-xl bg-brand-600 px-3 py-2 text-[13px] font-bold text-white disabled:bg-slate-200 disabled:text-slate-500">{b.punten} p</button>
                </form>
              </div>
            );
          })}
        </div>
        <p className="mt-3 px-1 text-[12px] text-muted">Je franchisenemer of HQ reikt de beloning uit. Punten verdien je met waarderingen van collega&apos;s, door zelf te waarderen en door leeritems af te ronden.</p>
      </Sectie>
      {aanvragen.length > 0 && (
        <Sectie titel="Mijn aanvragen">
          <Lijst>
            {aanvragen.map((a) => <Rij key={a.id} titel={titel.get(a.beloningId) ?? a.beloningId} sub={tijdLabel(a.tijd.toISOString())}
              rechts={<Label toon={a.status === "uitgereikt" ? "groen" : a.status === "afgewezen" ? "grijs" : "navy"}>{a.status}</Label>} />)}
          </Lijst>
        </Sectie>
      )}
    </>
  );
}
