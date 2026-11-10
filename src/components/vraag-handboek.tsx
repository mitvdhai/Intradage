"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { FileText, Search, Sparkles } from "lucide-react";
import { meldFoutAntwoord, vraagHandboek } from "@/lib/acties";

export function VraagHandboek() {
  const [res, actie, bezig] = useActionState(vraagHandboek, null);
  const [gemeld, setGemeld] = useState(false);
  return (
    <div>
      <form action={actie} className="relative">
        <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input name="vraag" required autoComplete="off" placeholder="Zoek of stel een vraag…"
          className="tap w-full rounded-xl border border-line bg-white pl-10 pr-20 text-[15px] outline-none focus:border-navy-500" />
        <button disabled={bezig} className="absolute right-1.5 top-1/2 h-8 -translate-y-1/2 rounded-lg bg-navy-700 px-3 text-[13px] font-semibold text-white disabled:opacity-60">
          {bezig ? "…" : "Vraag"}
        </button>
      </form>

      {res && (
        <div className="mt-4 space-y-2" aria-live="polite">
          <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-navy-700 px-3.5 py-2 text-[15px] text-white">{res.vraag}</div>
          <div className="max-w-[92%] rounded-2xl rounded-bl-md bg-white px-3.5 py-3 text-[15px] ring-1 ring-line">
            <div className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-navy-600"><Sparkles size={12} /> Handboek-assistent</div>
            <p className="leading-relaxed">{res.antwoord.tekst}</p>
            {res.antwoord.bronnen.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {res.antwoord.bronnen.map((b, i) => (
                  <Link key={i} href={`/app/handboek/${b.docId}#${encodeURIComponent(b.kop)}`} className="inline-flex items-center gap-1 rounded-md border border-line bg-navy-50 px-2 py-0.5 text-[12px] font-medium text-navy-700">
                    <FileText size={12} /> {b.titel} v{b.versie} · {b.kop}
                  </Link>
                ))}
              </div>
            )}
          </div>
          {!res.antwoord.weetNiet && (
            <div className="px-1 text-[12px] text-muted">
              {gemeld ? "Bedankt, de eigenaar van het document kijkt ernaar." : (
                <>Klopt dit niet? <button className="font-medium text-brand-600 underline" onClick={async () => { await meldFoutAntwoord(res.vraag); setGemeld(true); }}>Meld het</button></>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
