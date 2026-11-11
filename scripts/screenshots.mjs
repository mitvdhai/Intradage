// Maakt de schermafbeeldingen voor docs/handleiding.md en het voorstel.
// Gebruik: start de app met verse demodata, dan `node scripts/screenshots.mjs`.
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const UIT = "docs/img";
mkdirSync(UIT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome", args: ["--no-sandbox", "--lang=nl-NL"], env: { ...process.env, LANG: "nl_NL.UTF-8" } });

async function pagina(persona, desktop = false) {
  const ctx = await browser.createBrowserContext();
  const p = await ctx.newPage();
  await p.setViewport(desktop ? { width: 1440, height: 900, deviceScaleFactor: 1.5 } : { width: 390, height: 844, deviceScaleFactor: 2 });
  if (persona) await p.setCookie({ name: "intradage_persona", value: persona, url: BASE });
  return p;
}
async function foto(p, pad, naam, voor) {
  await p.goto(BASE + pad, { waitUntil: "networkidle0" });
  if (voor) await voor(p);
  await p.screenshot({ path: `${UIT}/${naam}.png` });
  console.log("✓", naam);
}

let p = await pagina(null);
await foto(p, "/", "01-inloggen");

p = await pagina("u-sanne");
await foto(p, "/app", "02-home");
await foto(p, "/app/berichten/b-allergenen", "03-bericht-verplicht");
await foto(p, "/app/leren", "04-leren");
await foto(p, "/app/handboek", "05-handboek-vraag", async (q) => {
  await q.type('input[name="vraag"]', "Hoe lang mag patat in de warmhoudbak?");
  await q.keyboard.press("Enter");
  await q.waitForFunction(() => document.body.innerText.toLowerCase().includes("handboek-assistent"));
});
await foto(p, "/app/werk", "06-rooster");
await foto(p, "/app/werk/functie", "07-functie");
await foto(p, "/app/werk/functie/vaardigheid", "08-profiel-vaardigheden");
await foto(p, "/app/werk/documenten", "09-documenten");
await foto(p, "/app/chat/g-centrum", "10-chat", async (q) => q.evaluate(() => window.scrollTo(0, document.body.scrollHeight)));

p = await pagina("u-erik");
await foto(p, "/app/team", "11-team");
await foto(p, "/app/team/u-sanne", "12-beoordeling-boven");
await foto(p, "/app/team/u-sanne", "13-beoordeling-advies", async (q) => {
  await q.evaluate(() => {
    const namen = [...new Set([...document.querySelectorAll("input[type=radio][name^=n-]")].map((e) => e.name))];
    for (const n of namen) {
      if (document.querySelector(`input[name="${n}"]:checked`)) continue;
      const ls = [...document.querySelectorAll(`input[name="${n}"]`)].map((i) => i.closest("label"));
      (ls.find((x) => x.innerText.includes("vereist")) ?? ls[1]).click();
    }
  });
  await new Promise((r) => setTimeout(r, 300));
  await q.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await new Promise((r) => setTimeout(r, 300));
});

p = await pagina("u-lisa", true);
await foto(p, "/beheer", "20-beheer-overzicht");
await foto(p, "/beheer/berichten", "21-beheer-berichten");
p = await pagina("u-joost", true);
await foto(p, "/beheer/functiehuis", "22-beheer-functiehuis");
await foto(p, "/beheer/beoordelingen", "23-beheer-beoordelingen");
await foto(p, "/beheer/regeling", "24-beheer-regeling");

// Overige schermen van het basisplatform
p = await pagina("u-sanne");
await foto(p, "/app/leren/l-frituur", "14-quiz");
await foto(p, "/app/leren/l-puntzak", "15-challenge");
await foto(p, "/app/meldingen", "16-meldingen");
await foto(p, "/app/berichten", "17-nieuws");
await foto(p, "/app/chat", "18-chats");
p = await pagina("u-daan");
await foto(p, "/app/werk/functie/zelfbeoordeling", "19-zelfbeoordeling");
p = await pagina("u-erik");
await foto(p, "/app/team/inzendingen", "25-inzendingen");

// Betrokkenheid en operatie
const naar = (y) => async (q) => { await q.evaluate((yy) => window.scrollTo(0, yy), y); await new Promise((r) => setTimeout(r, 200)); };
p = await pagina("u-sanne");
await foto(p, "/app", "26-tijdlijn", naar(560));
await foto(p, "/app/meer", "27-meer");
await foto(p, "/app/waardering", "28-waardering");
await foto(p, "/app/waardering/geven?aan=u-daan", "29-waardering-geven", async (q) => {
  await q.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.innerText.includes("Samen"))?.click());
  await q.type('textarea[name="tekst"]', "Dank je dat je zaterdag mijn dienst overnam!");
});
await foto(p, "/app/beloningen", "30-beloningen");
await foto(p, "/app/enquetes", "31-enquetes");
await foto(p, "/app/enquetes/e-pulse", "32-pulse");
await foto(p, "/app/evenementen", "33-evenementen");
await foto(p, "/app/smoelenboek", "34-smoelenboek");
await foto(p, "/app/smoelenboek/u-yara", "35-profiel-collega");
await foto(p, "/app/werk/taken", "36-taken");
p = await pagina("u-yara");
await foto(p, "/app/checklist/cl-openen", "37-checklist", async (q) => {
  await q.evaluate(() => {
    [...document.querySelectorAll("button")].filter((b) => b.innerText.trim() === "Ja").slice(0, 2).forEach((b) => b.click());
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    const i = document.querySelector('input[type="number"]'); set.call(i, "4"); i.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 200));
});
p = await pagina("u-lisa");
await foto(p, "/app/evaluaties", "38-evaluaties");
await foto(p, "/app/evaluaties/ui-s1", "39-evaluatie-detail");
await foto(p, "/app/checklist/cl-evaluatie?v=v-markt", "40-evaluatie-invullen", async (q) => {
  await q.evaluate(() => {
    [...document.querySelectorAll("button")].filter((b) => b.innerText.trim() === "Ja").forEach((b) => b.click());
    [...document.querySelectorAll("button")].filter((b) => b.innerText.trim() === "4").forEach((b) => b.click());
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    [...document.querySelectorAll('input[type="number"]')].forEach((i, n) => { set.call(i, n === 0 ? "9" : "5"); i.dispatchEvent(new Event("input", { bubbles: true })); });
  });
  await new Promise((r) => setTimeout(r, 300));
});
p = await pagina("u-joost", true);
await foto(p, "/beheer/betrokkenheid", "41-beheer-betrokkenheid");
await foto(p, "/beheer/evaluaties", "42-beheer-evaluaties");

// Personeelsbeheer
const maandagNu = (() => { const d = new Date(); d.setHours(12); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toLocaleDateString("sv-SE"); })();
const volgendeMa = (() => { const d = new Date(`${maandagNu}T12:00:00`); d.setDate(d.getDate() + 7); return d.toLocaleDateString("sv-SE"); })();
p = await pagina("u-erik", true);
await foto(p, `/beheer/planning?v=v-centrum&week=${maandagNu}`, "43-beheer-planning");
await foto(p, `/beheer/planning?v=v-centrum&week=${volgendeMa}`, "44-beheer-planning-concept");
await foto(p, "/beheer/vestigingen?v=v-centrum", "45-beheer-vestigingen");
await foto(p, "/beheer/personeel", "46-beheer-personeel");
await foto(p, "/beheer/personeel/u-sanne", "47-beheer-dossier");
await foto(p, "/beheer/personeel/u-sanne/contract/ct-sanne-1", "48-beheer-contract");
await foto(p, "/beheer/werving", "49-beheer-werving");
await foto(p, "/beheer/werving/k-4", "50-beheer-kandidaat");
await foto(p, `/beheer/uren?week=${maandagNu}`, "51-beheer-uren");
await foto(p, "/beheer/verlof", "52-beheer-verlof");
p = await pagina("u-sanne");
await foto(p, "/app/werk", "53-app-rooster");
await foto(p, "/app/werk/beschikbaarheid", "54-app-beschikbaarheid");
await foto(p, "/app/werk/verlof", "55-app-verlof");
await foto(p, "/app/werk/contract/ct-sanne-2", "56-app-contract", async (q) => {
  await q.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const box = await (await q.$("svg.touch-none")).boundingBox();
  await q.mouse.move(box.x + 30, box.y + 70); await q.mouse.down();
  for (const [x, y] of [[60, 30], [90, 75], [130, 25], [170, 70], [220, 40]]) await q.mouse.move(box.x + x, box.y + y, { steps: 5 });
  await q.mouse.up();
  await q.click('input[name="akkoord"]');
});
await foto(p, "/app/werk/documenten", "57-app-documenten");
p = await pagina(null);
await foto(p, "/werken-bij/medewerker-centrum-rotterdam", "58-werken-bij");
await foto(p, "/start/welkom-lotte", "59-preboarding");
p = await pagina("u-noor");
await foto(p, "/app/team", "60-app-team");

// Uren, rechten en instellingen
const eerste = (sel) => async (pg) => { const h = await pg.$eval(sel, (a) => a.href); await pg.goto(h, { waitUntil: "networkidle0" }); };
p = await pagina("u-sanne");
await foto(p, "/app/werk/uren", "61-app-uren-invullen");
p = await pagina("u-yara");
await foto(p, "/app/werk/uren/bevestigen", "62-app-uren-bevestigen");
p = await pagina("u-erik", true);
const iso = (d) => d.toLocaleDateString("sv-SE");
const nu = new Date(); const vanaf = new Date(nu.getTime() - 21 * 864e5), totmet = nu;
await foto(p, `/beheer/uren/uitdraai?van=${iso(vanaf)}&tot=${iso(totmet)}`, "63-uren-uitdraai");
await foto(p, "/beheer/rechten?p=u-yara", "65-rechten-wie-mag-wat");
await foto(p, "/beheer/personeel/nieuw", "70-medewerker-toevoegen");
p = await pagina("u-joost", true);
await foto(p, "/beheer/rechten", "64-rechten-rolmatrix");
await foto(p, "/beheer/instellingen?tab=posities", "66-instellingen-posities");
await foto(p, "/beheer/instellingen?tab=checklists", "67-instellingen-checklist", eerste('a[href*="tab=checklists&s="]'));
await foto(p, "/beheer/instellingen?tab=waardering", "68-instellingen-waardering");
await foto(p, "/beheer/instellingen?tab=organisatie", "69-instellingen-organisatie");
await foto(p, "/beheer/handboek", "71-beheer-handboek", eerste('a[href*="/beheer/handboek?d=d"]'));
await foto(p, "/beheer/leren", "72-beheer-leren", eerste('a[href*="/beheer/leren?i=l"]'));

await browser.close();
