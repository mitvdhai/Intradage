"use client";

import { useActionState, useRef, useState } from "react";
import { CheckCircle2, Users } from "lucide-react";
import { verstuurBericht } from "@/lib/acties";
import { cx } from "./ui";

interface Persoon { rol: string; functieId?: string; vestigingIds: string[] }
type Optie = { id: string; label: string };

export function NieuwBericht({ mensen, rollen, functies, vestigingen }: { mensen: Persoon[]; rollen: Optie[]; functies: Optie[]; vestigingen: Optie[] }) {
  const [res, actie, bezig] = useActionState(verstuurBericht, null);
  const [sel, setSel] = useState<{ rollen: string[]; functieIds: string[]; vestigingIds: string[] }>({ rollen: [], functieIds: [], vestigingIds: [] });
  const [urgentie, setUrgentie] = useState("info");
  const form = useRef<HTMLFormElement>(null);

  const aantal = mensen.filter((m) =>
    (!sel.rollen.length || sel.rollen.includes(m.rol)) &&
    (!sel.functieIds.length || (m.functieId && sel.functieIds.includes(m.functieId))) &&
    (!sel.vestigingIds.length || m.vestigingIds.some((v) => sel.vestigingIds.includes(v)))).length;

  const wissel = (k: keyof typeof sel, id: string) => setSel((s) => ({ ...s, [k]: s[k].includes(id) ? s[k].filter((x) => x !== id) : [...s[k], id] }));

  const chips = (k: keyof typeof sel, opties: Optie[], titel: string) => (
    <div>
      <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wider text-muted">{titel}</div>
      <div className="flex flex-wrap gap-1.5">
        {opties.map((o) => {
          const on = sel[k].includes(o.id);
          return (
            <label key={o.id} className={cx("cursor-pointer rounded-full border px-3 py-1 text-[13px] font-medium", on ? "border-navy-700 bg-navy-700 text-white" : "border-line bg-white text-ink hover:border-navy-300")}>
              <input type="checkbox" name={k} value={o.id} checked={on} onChange={() => wissel(k, o.id)} className="sr-only" />{o.label}
            </label>
          );
        })}
      </div>
    </div>
  );

  return (
    <form ref={form} action={actie} className="space-y-4">
      <input name="titel" required placeholder="Titel" className="w-full rounded-xl border border-line px-3 py-2.5 text-[15px] font-semibold outline-none focus:border-navy-500" />
      <textarea name="inhoud" required rows={5} placeholder={"Tekst van het bericht.\n- Regels die beginnen met een streepje worden een lijst"} className="w-full rounded-xl border border-line p-3 text-[15px] outline-none focus:border-navy-500" />

      <div className="space-y-3 rounded-xl bg-slate-50 p-4">
        <div className="flex items-center justify-between">
          <div className="font-semibold">Doelgroep</div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[13px] font-semibold text-navy-700 ring-1 ring-line"><Users size={14} /> {aantal} ontvangers</div>
        </div>
        {chips("rollen", rollen, "Rol")}
        {chips("functieIds", functies, "Functie")}
        {chips("vestigingIds", vestigingen, "Vestiging")}
        <p className="text-[12px] text-muted">Niets gekozen = iedereen binnen jouw bereik.</p>
      </div>

      <div>
        <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wider text-muted">Urgentie</div>
        <div className="grid grid-cols-3 gap-2">
          {[["info", "Info", "Gewone melding"], ["belangrijk", "Belangrijk", "Met pushmelding"], ["verplicht", "Verplicht", "Lezen én bevestigen, vastgezet"]].map(([v, l, s]) => (
            <label key={v} className={cx("cursor-pointer rounded-xl border p-3", urgentie === v ? (v === "verplicht" ? "border-brand-600 bg-brand-50" : "border-navy-700 bg-navy-50") : "border-line")}>
              <input type="radio" name="urgentie" value={v} checked={urgentie === v} onChange={() => setUrgentie(v)} className="sr-only" />
              <div className="font-semibold">{l}</div><div className="text-[12px] text-muted">{s}</div>
            </label>
          ))}
        </div>
      </div>

      {res?.fout && <p className="text-sm text-brand-700">{res.fout}</p>}
      {res?.ok && <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><CheckCircle2 size={16} /> Verstuurd naar {aantal} mensen.</p>}
      <button disabled={bezig || aantal === 0} className={cx("rounded-xl px-5 py-2.5 font-semibold text-white disabled:opacity-50", urgentie === "verplicht" ? "bg-brand-600" : "bg-navy-700")}>
        {bezig ? "Versturen…" : `Verstuur naar ${aantal}`}
      </button>
    </form>
  );
}
