import { redirect } from "next/navigation";
import { isHQ } from "@/lib/access";
import { naamVan } from "@/lib/data";
import { vereisGebruiker } from "@/lib/session";
import { db } from "@/lib/store";
import { Blok, Kop, Tabel } from "../beheer-ui";

export default async function Logboek() {
  const u = await vereisGebruiker();
  if (!isHQ(u)) redirect("/beheer");
  return (
    <>
      <Kop titel="Logboek" sub="Beheeracties en inzage van gevoelige gegevens" />
      <Blok>
        {db.audit.length ? (
          <Tabel kop={["Tijd", "Wie", "Actie", "Details"]}>
            {db.audit.slice(0, 200).map((a, i) => (
              <tr key={i}>
                <td className="whitespace-nowrap px-3 py-2 text-muted">{new Date(a.tijd).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "medium" })}</td>
                <td className="px-3 py-2">{naamVan(a.gebruikerId)}</td>
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
