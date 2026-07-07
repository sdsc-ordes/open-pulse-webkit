import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const OUT = process.argv[2] ?? '/tmp/shots';
const pages = ['index', 'landscape', 'people', 'health', 'impact', 'coverage'];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
let failures = 0;

for (const name of pages) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`));

  await page.goto(`${BASE}/${name}.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500); // let force simulation settle

  // page-specific interactions
  if (name === 'landscape') {
    await page.fill('input[type=search]', 'climate');
    await page.waitForTimeout(300);
    const count = await page.textContent('p.small.muted');
    console.log(`  search "climate": ${count?.trim()}`);
    await page.fill('input[type=search]', '');
    const selects = page.locator('select');
    await selects.nth(1).selectOption({ index: 1 }); // type filter
    await page.waitForTimeout(300);
    console.log(`  type filter: ${(await page.textContent('p.small.muted'))?.trim()}`);
    await selects.nth(1).selectOption({ index: 0 });
    await page.waitForTimeout(300);
  }
  if (name === 'people') {
    // filter to one lab and back
    await page.locator('select').first().selectOption({ index: 4 });
    await page.waitForTimeout(1500);
    const circles = await page.locator('svg circle').count();
    console.log(`  lab-filtered graph circles: ${circles}`);
  }
  if (name === 'coverage') {
    await page.locator('details.op-gaplist summary').first().click();
    await page.waitForTimeout(300);
  }

  const nodeCount = await page.locator('svg circle').count();
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log(
    `${name}: ${errors.length ? 'ERRORS' : 'ok'} (svg circles: ${nodeCount})${errors.length ? '\n  ' + errors.join('\n  ') : ''}`,
  );
  if (errors.length) failures++;
  await page.close();
}

await browser.close();
process.exit(failures ? 1 : 0);
