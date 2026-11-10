import { redirect } from "next/navigation";
import { isHQ } from "@/lib/access";
import { herstelDemodata } from "@/lib/acties";
import { auditLog, naamVan } from "@/lib/data";
import { vereisGebruiker } from "@/lib/session";
import { Blok, Kop, Tabel } from "../beheer-ui";

export default async function Logboek() {
  const { u, org } = await vereisGebruiker();
  if (!isHQ(u)) redirect("/beheer");
  const log = await auditLog(200);
  return (
    <>
      <Kop titel="Logboek" sub="Beheeracties en inzage van gevoelige gegevens" rechts={
        <form action={herstelDemodata}><button className="rounded-xl px-4 py-2 text-sm font-semibold text-brand-700 ring-1 ring-brand-100 hover:bg-brand-50">Demodata herstellen</button></form>
      } />
      <Blok>
        {log.length ? (
          <Tabel kop={["Tijd", "Wie", "Actie", "Details"]}>
            {log.map((a, i) => (
              <tr key={i}>
                <td className="whitespace-nowrap px-3 py-2 text-muted">{new Date(a.tijd).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "medium" })}</td>
                <td className="px-3 py-2">{naamVan(org, a.gebruikerId)}</td>
                <td className="px-3 py-2 font-medium">{a.actie}</td>
                <td className="px-3 py-2 text-muted">{a.details}</td>
              </tr>
            ))}
          </Tabel>
        ) : <p className="text-sm text-muted">Nog geen acties gelogd in deze sessie.</p>}
      </Blok>
    </>
  );
}
