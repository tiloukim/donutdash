import { chromium } from 'playwright';
import { join } from 'path';
import { mkdirSync } from 'fs';

const BASE = 'https://donutdash.app';
const OUT = join(import.meta.dirname, '..', 'screenshots');

const SIZES = {
  '6.7': { width: 430, height: 932, scale: 3 },
  '6.5': { width: 428, height: 926, scale: 3 },
};

async function dismissCookie(page) {
  try {
    const btn = await page.$('button:has-text("Accept")');
    if (btn) await btn.click();
    await page.waitForTimeout(300);
  } catch {}
}

async function run() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  for (const [sizeName, size] of Object.entries(SIZES)) {
    console.log(`\n📱 Capturing ${sizeName}" screenshots...`);

    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      deviceScaleFactor: size.scale,
      isMobile: true,
      hasTouch: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    });

    const page = await context.newPage();

    // Dismiss cookie on first load
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await dismissCookie(page);

    // 1. Home page
    console.log('  📸 01-home...');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: join(OUT, `01-home-${sizeName}in.png`), fullPage: false });

    // 2. Browse shops
    console.log('  📸 02-shops...');
    await page.goto(`${BASE}/shops`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);
    await dismissCookie(page);
    await page.screenshot({ path: join(OUT, `02-shops-${sizeName}in.png`), fullPage: false });

    // 3. Shop menu (click first shop)
    console.log('  📸 03-shop-menu...');
    const shopLink = await page.$('a[href^="/shops/"]');
    if (shopLink) {
      await shopLink.click();
      await page.waitForTimeout(3000);
      await dismissCookie(page);
    }
    await page.screenshot({ path: join(OUT, `03-shop-menu-${sizeName}in.png`), fullPage: false });

    // 4. Login page (shows the nice branded sign-in)
    console.log('  📸 04-login...');
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await dismissCookie(page);
    await page.screenshot({ path: join(OUT, `04-login-${sizeName}in.png`), fullPage: false });

    // 5. Support page
    console.log('  📸 05-support...');
    await page.goto(`${BASE}/support`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await dismissCookie(page);
    await page.screenshot({ path: join(OUT, `05-support-${sizeName}in.png`), fullPage: false });

    await context.close();
    console.log(`  ✅ Done ${sizeName}"`);
  }

  await browser.close();
  console.log(`\n✅ All screenshots saved to ${OUT}`);
}

run().catch(console.error);
