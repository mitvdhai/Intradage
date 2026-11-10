import { ChevronRight } from "lucide-react";
import { kiesPersona } from "@/lib/acties";
import { ROL_LABEL } from "@/lib/access";
import { PERSONAS } from "@/lib/seed";
import { db } from "@/lib/store";

export default function Inloggen() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col bg-white">
      <div className="bg-navy-700 px-6 pb-10 pt-14 text-white">
        <div className="mb-6 inline-flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-lg font-bold">I</span>
          <span className="text-xl font-bold tracking-tight">Intradage</span>
        </div>
        <h1 className="text-3xl font-bold leading-tight tracking-tight">Alles voor je werk,<br />op één plek.</h1>
        <p className="mt-2 text-navy-100">Nieuws, je rooster, leren en het handboek.</p>
      </div>

      <div className="flex-1 px-5 py-6">
        <div className="mb-4 rounded-xl bg-navy-50 p-3 text-[13px] text-navy-800">
          <b>Demo-omgeving.</b> Later log je in met je mobiele nummer en een sms-code. Kies hieronder als wie je de app wilt bekijken.
        </div>
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
          {PERSONAS.map((p) => {
            const u = db.gebruikers.find((g) => g.id === p.id)!;
            return (
              <li key={p.id}>
                <form action={kiesPersona}>
                  <input type="hidden" name="id" value={u.id} />
                  <button className="tap flex w-full items-center gap-3 px-4 py-3 text-left active:bg-slate-50">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy-100 font-semibold text-navy-700">{u.voornaam[0]}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{u.voornaam} · {ROL_LABEL[u.rol]}</span>
                      <span className="block text-[13px] text-muted">{p.uitleg}</span>
                    </span>
                    <ChevronRight size={18} className="text-slate-300" />
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
