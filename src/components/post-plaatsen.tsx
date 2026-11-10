"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { Award, Send } from "lucide-react";
import { plaatsPost } from "@/lib/acties-betrokkenheid";
import { cx } from "./ui";

export function PostPlaatsen({ voornaam, groep }: { voornaam: string; groep: string }) {
  const [open, setOpen] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const [res, actie, bezig] = useActionState(async (vorig: Awaited<ReturnType<typeof plaatsPost>> | null, fd: FormData) => {
    const r = await plaatsPost(vorig, fd);
    if (r?.ok) { form.current?.reset(); setOpen(false); }
    return r;
  }, null);
  return (
    <form ref={form} action={actie} className="rounded-2xl border border-line bg-white p-3">
      <textarea name="inhoud" rows={open ? 3 : 1} onFocus={() => setOpen(true)} maxLength={1000}
        placeholder={`Deel iets met ${groep}, ${voornaam}…`}
        className="w-full resize-none rounded-xl bg-slate-50 px-3 py-2.5 text-[15px] outline-none focus:bg-white focus:ring-2 focus:ring-navy-200" />
      <div className={cx("mt-2 flex items-center gap-2", !open && "hidden")}>
        <Link href="/app/waardering/geven" className="tap inline-flex items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold text-brand-700 ring-1 ring-brand-100"><Award size={16} /> Waardeer iemand</Link>
        <button disabled={bezig} className="tap ml-auto inline-flex items-center gap-1.5 rounded-xl bg-navy-700 px-4 text-[14px] font-semibold text-white disabled:opacity-50"><Send size={15} /> Plaatsen</button>
      </div>
      {res?.fout && <p className="mt-2 text-[13px] text-brand-700">{res.fout}</p>}
    </form>
  );
}
