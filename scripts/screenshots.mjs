// Maakt de schermafbeeldingen voor docs/handleiding.md en het voorstel.
// Gebruik: start de app met verse demodata, dan `node scripts/screenshots.mjs`.
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const UIT = "docs/img";
mkdirSync(UIT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome", args: ["--no-sandbox"] });

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

await browser.close();
