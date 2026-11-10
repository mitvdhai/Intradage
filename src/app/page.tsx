import { connection } from "next/server";
import { PersonaKiezer } from "@/components/persona-kiezer";
import { ROL_LABEL } from "@/lib/access";
import { getOrg } from "@/lib/org";
import { PERSONAS } from "@/lib/seed";

export default async function Inloggen() {
  await connection(); // altijd per request renderen (leest de database)
  const org = await getOrg();
  const personas = PERSONAS.flatMap((p) => {
    const u = org.gebruikers.find((g) => g.id === p.id);
    return u ? [{ id: u.id, naam: u.voornaam, rol: ROL_LABEL[u.rol], uitleg: p.uitleg }] : [];
  });
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col bg-white">
      <div className="relative overflow-hidden bg-navy-700 px-6 pb-10 pt-14 text-white">
        <div className="absolute -right-20 -top-24 h-52 w-52 rounded-full bg-brand-600" />
        <div className="absolute right-6 top-24 h-12 w-12 rounded-full bg-navy-500" />
        <div className="relative">
          <div className="mb-6 inline-flex items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-lg font-bold text-brand-600">I</span>
            <span className="text-xl font-bold tracking-tight">Intradage</span>
          </div>
          <h1 className="text-3xl font-bold leading-tight tracking-tight">Alles voor je werk,<br />op één plek.</h1>
          <p className="mt-2 text-navy-100">Nieuws, je rooster, leren en het handboek.</p>
        </div>
      </div>
      <div className="flex-1 px-5 py-6">
        <div className="mb-4 rounded-xl bg-navy-50 p-3 text-[13px] text-navy-800">
          <b>Demo-omgeving.</b> Later log je in met je mobiele nummer en een sms-code. Kies hieronder als wie je de app wilt bekijken.
        </div>
        <PersonaKiezer personas={personas} wachtwoordNodig={!!process.env.DEMO_WACHTWOORD} />
      </div>
    </main>
  );
}
