// End-to-end controle van de belangrijkste flows.
// Gebruik: start de app (npm run build && PORT=3100 npm start) en draai `npm run e2e`.
// Let op: de flows passen de demodata aan; herstart de server voor een schone stand.
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const CHROME = process.env.CHROME_PATH ?? "/usr/bin/google-chrome";
const browser = await puppeteer.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
const fouten = [];
const ok = (cond, msg) => { console.log(cond ? "✓" : "✗", msg); if (!cond) fouten.push(msg); };

async function als(persona) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.setCookie({ name: "intradage_persona", value: persona, url: BASE });
  page.on("pageerror", (e) => fouten.push(`pageerror ${persona}: ${e.message}`));
  return page;
}
const tekst = (p) => p.evaluate(() => document.body.innerText);
const klikTekst = async (p, t) => {
  const els = await p.$$("button");
  for (const e of els) if ((await e.evaluate((n) => n.innerText)).includes(t)) { await e.evaluate((n) => n.click()); return true; }
  return false;
};

// 1. Sanne bevestigt een verplicht bericht
let p = await als("u-sanne");
await p.goto(`${BASE}/app/berichten/b-allergenen`, { waitUntil: "networkidle0" });
await klikTekst(p, "Gelezen en begrepen");
await p.waitForFunction(() => document.body.innerText.includes("Bevestigd op"), { timeout: 8000 });
await p.goto(`${BASE}/app`, { waitUntil: "networkidle0" });
ok(!(await tekst(p)).includes("Verplicht · lezen en bevestigen"), "verplicht bericht verdwijnt uit Te doen na bevestigen");

// 2. Handboekvraag
await p.goto(`${BASE}/app/handboek`, { waitUntil: "networkidle0" });
await p.type('input[name="vraag"]', "Hoe lang mag patat in de warmhoudbak?");
await klikTekst(p, "Vraag");
await p.waitForFunction(() => document.body.innerText.toLowerCase().includes("handboek-assistent"), { timeout: 8000 });
const t2 = await tekst(p);
ok(t2.includes("7 minuten") && t2.includes("Bakinstructie patat"), "handboek-assistent antwoordt met bron");
await p.$eval('input[name="vraag"]', (e) => (e.value = ""));
await p.type('input[name="vraag"]', "wat is het wifi wachtwoord");
await klikTekst(p, "Vraag");
await p.waitForFunction(() => document.body.innerText.includes("staat niet in jouw handboek"), { timeout: 8000 });
ok(true, "handboek-assistent zegt eerlijk 'weet ik niet'");

// 3. Sanne mag een andere medewerker niet beoordelen/zien
const r = await p.goto(`${BASE}/app/team/u-daan`, { waitUntil: "networkidle0" });
ok(r.status() === 404, "medewerker kan beoordeling van collega niet openen (404)");

// 4. Documenten ontgrendelen
await p.goto(`${BASE}/app/werk/documenten`, { waitUntil: "networkidle0" });
await p.type('input[name="code"]', "123456");
await klikTekst(p, "Ontgrendel");
await p.waitForFunction(() => document.body.innerText.includes("ontgrendeld"), { timeout: 8000 });
ok(true, "documenten ontgrendelen met code");

// 5. Erik rondt beoordeling Sanne af
p = await als("u-erik");
await p.goto(`${BASE}/app/team/u-sanne`, { waitUntil: "networkidle0" });
const namen = await p.$$eval('input[type=radio][name^="n-"]', (els) => [...new Set(els.map((e) => e.name))]);
for (const n of namen) {
  const gekozen = await p.$eval(`input[name="${n}"]:checked`, () => true).catch(() => false);
  if (!gekozen) {
    // kies het vereiste niveau (label met rode rand bevat "vereist")
    await p.evaluate((naam) => {
      const labels = [...document.querySelectorAll(`input[name="${naam}"]`)].map((i) => i.closest("label"));
      const l = labels.find((x) => x.innerText.includes("vereist")) ?? labels[1];
      l.click();
    }, n);
  }
}
await new Promise((r) => setTimeout(r, 300));
const tot = await tekst(p);
ok(/11 van 11 ingevuld/.test(tot), "alle 11 onderdelen ingevuld");
ok(/salarisadvies/i.test(tot), "salarisadvies verschijnt bij complete beoordeling");
await klikTekst(p, "Klaar voor gesprek");
await p.waitForFunction(() => document.body.innerText.includes("Besluit vastleggen"), { timeout: 8000 });
await klikTekst(p, "Besluit vastleggen");
await p.waitForFunction(() => document.body.innerText.includes("Besloten:"), { timeout: 8000 });
ok(true, "FN legt salarisbesluit vast");

// 6. Sanne ziet haar uitkomst
p = await als("u-sanne");
await p.goto(`${BASE}/app/werk/functie`, { waitUntil: "networkidle0" });
ok((await tekst(p)).includes("nieuw uurloon"), "medewerker ziet eigen besluit bij Functie");

// 7. HQ: wegingen moeten 100% zijn
p = await als("u-joost");
await p.setViewport({ width: 1300, height: 900 });
await p.goto(`${BASE}/beheer/functiehuis`, { waitUntil: "networkidle0" });
const inp = await p.$('input[name="w-v-bakken"]');
await inp.focus();
await p.keyboard.down("Control"); await p.keyboard.press("A"); await p.keyboard.up("Control");
await p.keyboard.type("20");
await new Promise((r) => setTimeout(r, 300));
const disabled = await p.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.innerText === "Opslaan").disabled);
ok(disabled && (await tekst(p)).includes("105%"), "opslaan geblokkeerd als weging ≠ 100%");

// 8. Logboek bevat het besluit
await p.goto(`${BASE}/beheer/logboek`, { waitUntil: "networkidle0" });
ok((await tekst(p)).includes("Salarisbesluit vastgelegd"), "salarisbesluit staat in het logboek");

// 9. Tijdlijn: Sanne plaatst een post en liket een waardering
p = await als("u-sanne");
await p.goto(`${BASE}/app`, { waitUntil: "networkidle0" });
await p.focus('textarea[name="inhoud"]');
await p.type('textarea[name="inhoud"]', "E2E-post: nieuwe saus is top!");
await klikTekst(p, "Plaats");
await p.waitForFunction(() => document.body.innerText.includes("E2E-post"), { timeout: 8000 });
ok(true, "medewerker plaatst een post op de tijdlijn");
const likeVoor = await p.$$eval('button[aria-pressed="true"]', (e) => e.length);
await p.evaluate(() => [...document.querySelectorAll('button[aria-pressed="false"]')][0]?.click());
await p.waitForFunction((n) => document.querySelectorAll('button[aria-pressed="true"]').length > n, { timeout: 8000 }, likeVoor).catch(() => {});
ok((await p.$$eval('button[aria-pressed="true"]', (e) => e.length)) > likeVoor, "like wordt opgeslagen");

// 10. Waardering geven → punten voor ontvanger
await p.goto(`${BASE}/app/waardering/geven?aan=u-daan`, { waitUntil: "networkidle0" });
await p.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.innerText.includes("Samen"))?.click());
await p.waitForSelector('textarea[name="tekst"]', { timeout: 8000 });
await p.type('textarea[name="tekst"]', "E2E: dank voor het overnemen van mijn dienst!");
await klikTekst(p, "Verstuur waardering");
await p.waitForFunction(() => location.search.includes("gegeven=1"), { timeout: 8000 });
ok((await tekst(p)).includes("E2E: dank"), "waardering staat in de feed na versturen");

// 11. Pulse invullen → verdwijnt uit Te doen
await p.goto(`${BASE}/app/enquetes/e-pulse`, { waitUntil: "networkidle0" });
await p.evaluate(() => document.querySelector('input[name="q1"][value="4"]')?.closest("label")?.click());
await klikTekst(p, "Versturen");
await p.waitForFunction(() => /bedankt|dank je wel/i.test(document.body.innerText), { timeout: 8000 });
await p.goto(`${BASE}/app`, { waitUntil: "networkidle0" });
ok(!(await tekst(p)).includes("Hoe was je week?"), "ingevulde pulse verdwijnt uit Te doen");

// 12. Aanmelden voor een evenement
await p.goto(`${BASE}/app/evenementen`, { waitUntil: "networkidle0" });
await klikTekst(p, "Ik ga");
await p.waitForFunction(() => /Gaan: .*Sanne/.test(document.body.innerText), { timeout: 8000 }).catch(() => {});
ok(/Gaan: .*Sanne/.test(await tekst(p)), "aanmelding voor evenement opgeslagen");

// 13. Shiftleider vult openingschecklist in
p = await als("u-yara");
await p.goto(`${BASE}/app/checklist/cl-openen`, { waitUntil: "networkidle0" });
await p.evaluate(() => [...document.querySelectorAll("button")].filter((b) => b.innerText.trim() === "Ja").forEach((b) => b.click()));
await p.evaluate(() => [...document.querySelectorAll('input[type="number"]')].forEach((i) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(i, "3"); i.dispatchEvent(new Event("input", { bubbles: true })); }));
await new Promise((r) => setTimeout(r, 300));
await klikTekst(p, "Afronden");
await p.waitForFunction(() => location.pathname.endsWith("/app/werk/taken"), { timeout: 8000 });
ok((await tekst(p)).includes("Gedaan door Yara"), "dagchecklist afgerond en zichtbaar bij Taken");

// 14. HQ voert een evaluatie uit met knock-out
p = await als("u-lisa");
await p.goto(`${BASE}/app/checklist/cl-evaluatie?v=v-markt`, { waitUntil: "networkidle0" });
await p.evaluate(() => {
  [...document.querySelectorAll("button")].filter((b) => b.innerText.trim() === "Ja").forEach((b) => b.click());
  [...document.querySelectorAll("button")].filter((b) => b.innerText.trim() === "4").forEach((b) => b.click());
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  [...document.querySelectorAll('input[type="number"]')].forEach((i) => { set.call(i, "2"); i.dispatchEvent(new Event("input", { bubbles: true })); });
});
await new Promise((r) => setTimeout(r, 200));
// koelcel te warm = knock-out
await p.evaluate(() => {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  const i = document.querySelector('input[type="number"]'); set.call(i, "9"); i.dispatchEvent(new Event("input", { bubbles: true }));
});
await new Promise((r) => setTimeout(r, 300));
ok(/Knock-out: direct actie nodig/.test(await tekst(p)), "knock-out zichtbaar tijdens invullen");
await klikTekst(p, "Afronden");
await p.waitForFunction(() => /\/app\/evaluaties\//.test(location.pathname), { timeout: 8000 });
await p.type('input[name="tekst"]', "E2E: koelcel laten nakijken");
await klikTekst(p, "Actiepunt toevoegen");
await p.waitForFunction(() => document.body.innerText.includes("E2E: koelcel"), { timeout: 8000 });
ok(true, "evaluatie met knock-out afgerond en actiepunt toegevoegd");

// 15. Beheer: betrokkenheid en evaluaties
await p.setViewport({ width: 1300, height: 900 });
await p.goto(`${BASE}/beheer/evaluaties`, { waitUntil: "networkidle0" });
ok((await tekst(p)).includes("E2E: koelcel"), "actiepunt zichtbaar in beheer › evaluaties");
await p.goto(`${BASE}/beheer/betrokkenheid`, { waitUntil: "networkidle0" });
ok(/eNPS/.test(await tekst(p)), "beheer › betrokkenheid toont eNPS");
await p.type('input[name="titel"]', "E2E poll");
await p.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.innerText === "Poll")?.click());
await p.type('input[name="vraag"]', "Welke saus?");
await p.type('textarea[name="opties"]', "Knoflook\nSambal");
await klikTekst(p, "Versturen");
await p.waitForFunction(() => document.body.innerText.includes("Staat bij iedereen"), { timeout: 8000 });
p = await als("u-tim");
await p.goto(`${BASE}/app/enquetes`, { waitUntil: "networkidle0" });
ok((await tekst(p)).includes("E2E poll"), "nieuwe poll van HQ zichtbaar bij medewerker");

// ---------- Personeelsbeheer ----------
const maandag = (() => { const d = new Date(); d.setHours(12); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toLocaleDateString("sv-SE"); })();
const volgende = (() => { const d = new Date(`${maandag}T12:00:00`); d.setDate(d.getDate() + 7); return d.toLocaleDateString("sv-SE"); })();
const teken = async (pg) => {
  const box = await (await pg.$("svg.touch-none")).boundingBox();
  await pg.mouse.move(box.x + 30, box.y + 70); await pg.mouse.down();
  for (const [x, y] of [[60, 30], [90, 75], [130, 25], [170, 70], [220, 40]]) await pg.mouse.move(box.x + x, box.y + y, { steps: 4 });
  await pg.mouse.up();
};

// 16. FN maakt een roostervoorstel voor volgende week en publiceert het
p = await als("u-erik");
await p.setViewport({ width: 1400, height: 900 });
await p.goto(`${BASE}/beheer/planning?v=v-centrum&week=${volgende}`, { waitUntil: "networkidle0" });
await klikTekst(p, "voorstellen");
await p.waitForFunction(() => /diensten ingevuld/.test(document.body.innerText), { timeout: 15000 });
ok(/\d+ van de \d+ diensten ingevuld/.test(await tekst(p)), "roostervoorstel vult de standaardbezetting");
await klikTekst(p, "Publiceren");
await p.waitForFunction(() => !/Publiceren \(/.test(document.body.innerText), { timeout: 10000 });
ok(/\b0\s*\n?\s*concept/.test(await tekst(p)), "rooster gepubliceerd (geen concepten meer)");

// 17. Verlof: Sanne vraagt aan, Erik keurt Daans aanvraag goed
p = await als("u-sanne");
await p.goto(`${BASE}/app/werk/verlof`, { waitUntil: "networkidle0" });
await p.type('input[name="opmerking"]:not([placeholder^="Optioneel"])', "E2E vakantie");
await klikTekst(p, "Aanvragen");
await p.waitForFunction(() => document.body.innerText.includes("Aangevraagd."), { timeout: 8000 });
ok((await tekst(p)).includes("Wacht"), "medewerker vraagt verlof aan");
p = await als("u-erik");
await p.setViewport({ width: 1400, height: 900 });
await p.goto(`${BASE}/beheer/verlof`, { waitUntil: "networkidle0" });
const voor = (await tekst(p)).match(/(\d+)\s*\n\s*aanvragen te beoordelen/)?.[1];
await klikTekst(p, "Goedkeuren");
await p.waitForFunction((n) => (document.body.innerText.match(/(\d+)\s*\n\s*aanvragen te beoordelen/)?.[1]) !== n, { timeout: 8000 }, voor);
ok(true, "leiding keurt verlof goed");

// 18. Contract digitaal tekenen: eerst Sanne, dan Erik als werkgever
p = await als("u-sanne");
await p.goto(`${BASE}/app/werk/contract/ct-sanne-2`, { waitUntil: "networkidle0" });
await p.click('input[name="akkoord"]');
await teken(p);
await klikTekst(p, "Contract tekenen");
await p.waitForFunction(() => document.body.innerText.includes("Getekend"), { timeout: 8000 });
ok(true, "medewerker tekent contract met handtekening");
p = await als("u-erik");
await p.setViewport({ width: 1400, height: 1000 });
await p.goto(`${BASE}/beheer/personeel/u-sanne/contract/ct-sanne-2`, { waitUntil: "networkidle0" });
await teken(p);
await klikTekst(p, "Contract tekenen");
await p.waitForFunction(() => document.body.innerText.includes("Getekend door beide partijen"), { timeout: 8000 });
ok(true, "werkgever tekent; contract is rond");

// 19. Solliciteren via de openbare vacaturepagina
p = await als("");
await p.goto(`${BASE}/werken-bij/medewerker-centrum-rotterdam`, { waitUntil: "networkidle0" });
await p.type('input[name="voornaam"]', "Eetje"); await p.type('input[name="achternaam"]', "E2E");
await p.type('input[name="email"]', "e2e@voorbeeld.nl"); await p.type('input[name="mobiel"]', "0612345678");
await p.click('input[name="privacy"]');
await klikTekst(p, "Verstuur sollicitatie");
await p.waitForFunction(() => document.body.innerText.includes("Bedankt voor je sollicitatie"), { timeout: 8000 });
p = await als("u-erik");
await p.setViewport({ width: 1400, height: 900 });
await p.goto(`${BASE}/beheer/werving`, { waitUntil: "networkidle0" });
ok((await tekst(p)).includes("Eetje E2E"), "sollicitatie verschijnt in de werving");

// 20. Aannemen → preboarding via startlink
await p.goto(`${BASE}/beheer/werving/k-3`, { waitUntil: "networkidle0" });
await klikTekst(p, "Aannemen en preboarding starten");
await p.waitForFunction(() => location.search.includes("nieuw=1"), { timeout: 10000 });
const startLink = await p.$eval('a[href^="/start/"]', (a) => a.getAttribute("href"));
ok(!!startLink && (await tekst(p)).includes("preboarding"), "kandidaat aangenomen, dossier en startlink aangemaakt");
p = await als("");
await p.goto(`${BASE}${startLink}`, { waitUntil: "networkidle0" });
await p.type('input[name="adres"]', "Coolsingel 40"); await p.type('input[name="postcode"]', "3011AD"); await p.type('input[name="woonplaats"]', "Rotterdam");
await p.type('input[name="iban"]', "NL91ABNA0417164300"); await p.type('input[name="bsn"]', "111222333");
await klikTekst(p, "Opslaan");
await p.waitForFunction(() => /1 van 4 stappen klaar/.test(document.body.innerText), { timeout: 8000 });
ok(true, "nieuwe medewerker vult gegevens in via de startlink (IBAN- en BSN-controle)");

// 21. Uren goedkeuren en exporteren
p = await als("u-erik");
await p.setViewport({ width: 1400, height: 900 });
await p.goto(`${BASE}/beheer/uren?week=${maandag}`, { waitUntil: "networkidle0" });
if (await klikTekst(p, "Alles goedkeuren")) await p.waitForFunction(() => document.body.innerText.includes("Alles goedgekeurd"), { timeout: 8000 });
ok((await tekst(p)).includes("Alles goedgekeurd"), "leiding keurt de uren van de week goed");
const csv = await p.evaluate(async (u) => (await fetch(u)).text(), `${BASE}/beheer/uren/export?van=${maandag}&tot=${volgende}`);
ok(csv.replace(/^\uFEFF/, "").startsWith("Personeelsnummer;Naam;Datum") && csv.split("\n").length > 5, "export voor de loonadministratie (CSV)");

// 22. Rechten: medewerker kan geen dossier openen
p = await als("u-sanne");
const r2 = await p.goto(`${BASE}/beheer/personeel/u-daan`, { waitUntil: "networkidle0" });
ok(r2.url().endsWith("/app") || r2.status() === 404, "medewerker heeft geen toegang tot personeelsdossiers");

await browser.close();
console.log(fouten.length ? `\nFOUTEN:\n${fouten.join("\n")}` : "\nAlle flows OK");
process.exit(fouten.length ? 1 : 0);
