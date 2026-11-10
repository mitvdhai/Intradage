const DAGEN = [1, 2, 3, 4, 5, 6, 0];
const NAAM = ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"];

/** Velden voor het vaste beschikbaarheidspatroon (dag-N, van-N, tot-N). Server-renderbaar. */
export function BeschikbaarheidVelden({ huidig }: { huidig: { weekdag: number; van: string; tot: string }[] }) {
  return (
    <div className="divide-y divide-line rounded-2xl border border-line bg-white">
      {DAGEN.map((d) => {
        const b = huidig.find((x) => x.weekdag === d);
        return (
          <div key={d} className="flex items-center gap-2 px-3.5 py-2.5">
            <label className="flex flex-1 items-center gap-2.5 text-[15px] font-medium has-[:checked]:text-ink">
              <input type="checkbox" name={`dag-${d}`} defaultChecked={!!b} className="h-5 w-5 accent-navy-700" /> {NAAM[d]}
            </label>
            <input name={`van-${d}`} type="time" defaultValue={b?.van ?? "11:00"} className="rounded-lg border border-line px-2 py-1.5 text-[14px] tabular-nums" />
            <span className="text-muted">–</span>
            <input name={`tot-${d}`} type="time" defaultValue={b?.tot ?? "22:00"} className="rounded-lg border border-line px-2 py-1.5 text-[14px] tabular-nums" />
          </div>
        );
      })}
    </div>
  );
}
