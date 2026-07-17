import { chromium } from "playwright";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:5173/";
const browser = await chromium.launch({ headless: true });

const openLibrary = async (page) => {
  await page.getByRole("button", { name: "Browse library" }).click();
  await page.getByRole("heading", { name: "Score Library" }).waitFor();
  await page.getByText("87 of 87 scores").waitFor();
};

const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const pageErrors = [];
desktop.on("pageerror", (error) => pageErrors.push(error.message));
await desktop.goto(`${baseUrl}#/musicxml`, { waitUntil: "domcontentloaded" });
await desktop.getByRole("button", { name: "Browse library" }).waitFor({ timeout: 30000 });
await openLibrary(desktop);
console.log("Desktop catalog opened.");
if ((await desktop.locator("li[data-score-id]").count()) !== 87) throw new Error("Desktop catalog did not render 87 cards");
await desktop.getByLabel("Filter by format").selectOption("musicxml");
await desktop.getByText("75 of 87 scores").waitFor();
await desktop.getByLabel("Filter by format").selectOption("guitar-pro");
await desktop.getByText("12 of 87 scores").waitFor();
await desktop.getByLabel("Filter by format").selectOption("all");
await desktop.getByPlaceholder("Search title, composer, arranger, or tag...").fill("Fanny Hensel");
await desktop.getByText("1 of 87 scores").waitFor();
await desktop.getByPlaceholder("Search title, composer, arranger, or tag...").fill("");
await desktop.getByRole("button", { name: "Close score library" }).click();

const loadIds = [
  "happy-birthday",
  "greensleeves",
  "canon-in-d",
  "openscore-an-die-musik",
  "openscore-wiegenlied",
  "openscore-fairy-lullaby",
  "pdmx-amazing-grace",
  "pdmx-scarborough-fair",
  "pdmx-mary-lamb",
  "pdmx-hot-cross-buns",
  "pdmx-hickory-dickory-dock",
  "pdmx-three-blind-mice",
  "pdmx-itsy-bitsy-spider",
  "pdmx-rock-a-bye-baby",
  "pdmx-muffin-man",
  "pdmx-sur-le-pont-avignon",
  "pdmx-michael-row-boat",
  "pdmx-swing-low-chariot",
  "pdmx-down-by-riverside",
  "pdmx-sakura",
  "pdmx-o-christmas-tree",
  "pdmx-good-king-wenceslas",
  "pdmx-god-rest-merry",
  "pdmx-go-tell-mountain",
  "pdmx-take-me-out-ball-game",
  "gp-scarborough-fair",
  "gp-mary-lamb",
  "gp-row-your-boat",
  "gp-frere-jacques",
  "gp-hot-cross-buns",
  "gp-auld-lang-syne",
  "gp-exercise-c-major-scale",
  "gp-exercise-arpeggios",
  "gp-exercise-intervals",
  "gp-exercise-rhythm",
  "gp-exercise-chords",
  "gp-exercise-key-changes",
];
const firstLoadIndex = process.env.QA_FROM_ID ? loadIds.indexOf(process.env.QA_FROM_ID) : 0;
for (const id of loadIds.slice(Math.max(0, firstLoadIndex))) {
  await openLibrary(desktop);
  const card = desktop.locator(`li[data-score-id="${id}"]`);
  await card.scrollIntoViewIfNeeded();
  await card.getByRole("button", { name: "Load score" }).click();
  try {
    await desktop.getByRole("heading", { name: "Score Library" }).waitFor({ state: "hidden", timeout: 20000 });
  } catch (error) {
    const text = (await desktop.locator("body").innerText()).replace(/\s+/g, " ");
    throw new Error(`${id} did not load. UI: ${text.slice(-1200)}`, { cause: error });
  }
  console.log(`Loaded ${id}.`);
}
if (pageErrors.length) throw new Error(`Browser page errors: ${pageErrors.join(" | ")}`);

await desktop.reload({ waitUntil: "domcontentloaded" });
await desktop.getByText(/LOADED: GP-EXERCISE-KEY-CHANGES\.GP/i).waitFor({ timeout: 30000 });
console.log("Library score persistence verified after reload.");

const retryPage = await browser.newPage({ viewport: { width: 1100, height: 850 } });
let catalogRequests = 0;
await retryPage.route("**/score-library/catalog.json", async (route) => {
  catalogRequests += 1;
  if (catalogRequests === 1) await route.fulfill({ status: 503, body: "unavailable" });
  else await route.continue();
});
await retryPage.goto(`${baseUrl}#/musicxml`, { waitUntil: "domcontentloaded" });
await retryPage.getByRole("button", { name: "Browse library" }).waitFor({ timeout: 30000 });
await retryPage.getByRole("button", { name: "Browse library" }).click();
await retryPage.getByRole("button", { name: "Retry catalog" }).waitFor();
await retryPage.getByRole("button", { name: "Retry catalog" }).click();
await retryPage.getByText("87 of 87 scores").waitFor();

await retryPage.route("**/score-library/assets/pdmx/pdmx-amazing-grace.mxl", async (route) => {
  await new Promise((resolve) => setTimeout(resolve, 2000));
  await route.continue().catch(() => undefined);
});
await retryPage.locator('li[data-score-id="pdmx-amazing-grace"] button').click();
await retryPage.getByRole("button", { name: "Cancel download" }).waitFor();
await retryPage.getByRole("button", { name: "Cancel download" }).click();
await retryPage.getByRole("button", { name: "Cancel download" }).waitFor({ state: "hidden" });
await retryPage.getByRole("heading", { name: "Score Library" }).waitFor();
console.log("Catalog retry and score cancellation verified.");

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
await mobile.goto(`${baseUrl}#/musicxml`, { waitUntil: "domcontentloaded" });
await mobile.getByRole("button", { name: "Browse library" }).waitFor({ timeout: 30000 });
await openLibrary(mobile);
console.log("Mobile catalog opened.");
if ((await mobile.locator("li[data-score-id]").count()) !== 87) throw new Error("Mobile catalog did not render 87 cards");
await mobile.getByLabel("Filter by difficulty").selectOption("beginner");
await mobile.getByText(/of 87 scores/).waitFor();

const catalogResponse = await mobile.request.get(`${baseUrl}score-library/catalog.json`);
if (catalogResponse.status() !== 200) throw new Error(`Catalog HTTP ${catalogResponse.status()}`);
for (const path of [
  "score-library/assets/musetrainer/Happy_Birthday_To_You_Piano.mxl",
  "score-library/assets/openscore-lieder/openscore-wiegenlied.mxl",
  "score-library/assets/pdmx/pdmx-mary-lamb.mxl",
  "score-library/assets/pdmx/pdmx-hickory-dickory-dock.mxl",
  "score-library/assets/guitar-pro/gp-exercise-c-major-scale.gp",
]) {
  const response = await mobile.request.get(`${baseUrl}${path}`);
  if (response.status() !== 200) throw new Error(`${path} HTTP ${response.status()}`);
}

await browser.close();
console.log(`Browser QA OK: desktop/mobile catalog, filters, 25 MusicXML, all 12 GP, and HTTP assets at ${baseUrl}`);
