/* Verification of the prototype gap fixes.
 * Run:  NODE_PATH=/home/dante/Work/pouria/node_modules node verify-fixes.js
 * Needs a local server:  python3 -m http.server 8123 --directory /home/dante/Work/pouria
 */
const { chromium } = require('playwright');

const BASE = 'http://localhost:8123/prototype';
const CHROME = '/home/dante/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';

let passed = 0, failed = 0;
function check(name, cond, extra = '') {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}${extra ? ' — ' + extra : ''}`); }
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  async function load(path) {
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push('PAGEERROR: ' + String(e)));
    await page.goto(BASE + path, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(700); // let CDN scripts settle
    return { page, errors };
  }

  const visibleCards = (page) => page.$$eval('.catalog-item', els =>
    els.filter(e => e.style.display !== 'none')
       .map(e => ({ name: e.dataset.name, cars: e.dataset.cars, brand: e.dataset.brand })));

  // ---------- 1. Catalog: default load ----------
  console.log('\n[1] catalog.html — default state');
  {
    const { page } = await load('/store/catalog.html');
    check('badge shows همه خودروها', (await page.textContent('#activeCarBadge')).trim() === 'همه خودروها');
    check('count is ۱۲ (matches 12 cards)', (await page.textContent('#visibleCountDisplay')).trim() === '۱۲');
    check('all 12 cards visible', (await visibleCards(page)).length === 12);
    check('empty state hidden', await page.$eval('#emptyState', el => el.classList.contains('hidden')));
    check('hint hidden without car filter', await page.$eval('#activeCarHint', el => el.style.display === 'none'));
    check('link says انتخاب خودرو', (await page.textContent('#changeCarLink')).trim() === 'انتخاب خودرو');
    await page.close();
  }

  // ---------- 2. Catalog: vehicle deep-link ----------
  console.log('\n[2] catalog.html?make=saipa&model=quick&trim=کوئیک S');
  {
    const trim = encodeURIComponent('کوئیک S');
    const { page } = await load(`/store/catalog.html?make=saipa&model=quick&trim=${trim}`);
    check('badge shows کوئیک (کوئیک S)', (await page.textContent('#activeCarBadge')).includes('کوئیک (کوئیک S)'));
    const cards = await visibleCards(page);
    check('only quick-compatible cards visible (۲)', cards.length === 2, JSON.stringify(cards.map(c => c.name)));
    check('all visible cards list quick', cards.every(c => (c.cars || '').split(/\s+/).includes('quick')));
    check('count text is ۲', (await page.textContent('#visibleCountDisplay')).trim() === '۲');
    check('hint visible with car filter', await page.$eval('#activeCarHint', el => el.style.display === ''));
    await page.close();
  }

  // ---------- 2b. Catalog: zero-result car → empty state + clear ----------
  console.log('\n[2b] catalog.html?make=ikco&model=tara — empty state & clear car filter');
  {
    const { page } = await load('/store/catalog.html?make=ikco&model=tara');
    check('zero cards for تارا', (await visibleCards(page)).length === 0);
    check('empty state shown', !(await page.$eval('#emptyState', el => el.classList.contains('hidden'))));
    await page.click('button[onclick="clearCarFilter()"]');
    await page.waitForTimeout(200);
    check('after clear: badge همه خودروها', (await page.textContent('#activeCarBadge')).trim() === 'همه خودروها');
    check('after clear: ۱۲ cards visible', (await visibleCards(page)).length === 12);
    await page.close();
  }

  // ---------- 3. Category slug deep-links ----------
  console.log('\n[3] catalog.html?cat=… slugs');
  {
    const p1 = await load('/store/catalog.html?cat=consumable');
    check('consumable → تسمه تایم visible', (await visibleCards(p1.page)).some(c => c.name.includes('تسمه تایم')));
    check('consumable button selected', await p1.page.$eval('.cat-btn[data-cat="مصرفی"]', el => el.className.includes('bg-orange-50')));
    await p1.page.close();

    const p2 = await load('/store/catalog.html?cat=cooling');
    const c2 = await visibleCards(p2.page);
    check('cooling → ۲ cards (واترپمپ + رادیاتور)', c2.length === 2 && c2.some(c => c.name.includes('واتر پمپ')) && c2.some(c => c.name.includes('رادیاتور')));
    await p2.page.close();

    const p3 = await load('/store/catalog.html?cat=electrical');
    check('electrical → ۲ cards (سنسور + شمع)', (await visibleCards(p3.page)).length === 2);
    await p3.page.close();

    const p4 = await load('/store/catalog.html?cat=body');
    check('body → ۲ cards (چراغ‌ها)', (await visibleCards(p4.page)).length === 2);
    await p4.page.close();
  }

  // ---------- 4. Brand filter trap ----------
  console.log('\n[4] brand checkboxes — تکستار/دنسو reachable');
  {
    const { page } = await load('/store/catalog.html');
    const def = await visibleCards(page);
    check('تکستار card visible by default', def.some(c => c.brand === 'تکستار'));
    check('دنسو card visible by default', def.some(c => c.brand === 'دنسو'));
    for (const b of ['ایساکو', 'والئو', 'کروز', 'عظام']) {
      await page.uncheck(`input.brand-cb[value="${b}"]`);
    }
    await page.waitForTimeout(150);
    const mid = await visibleCards(page);
    check('original brands off → ۲ cards remain (تکستار، دنسو)', mid.length === 2 && mid.every(c => ['تکستار', 'دنسو'].includes(c.brand)), JSON.stringify(mid.map(c => c.brand)));
    for (const b of ['تکستار', 'دنسو']) {
      await page.uncheck(`input.brand-cb[value="${b}"]`);
    }
    await page.waitForTimeout(150);
    check('all brands off → empty state visible', !(await page.$eval('#emptyState', el => el.classList.contains('hidden'))));
    await page.close();
  }

  // ---------- 5. Availability filter + ناموجود + call-for-price bypass ----------
  console.log('\n[5] availability filter + ناموجود + استعلام price bypass');
  {
    const { page } = await load('/store/catalog.html');
    check('رادیاتور card carries ناموجود badge', await page.$$eval('.catalog-item', els => els.some(e => e.dataset.name.includes('رادیاتور') && e.textContent.includes('ناموجود'))));
    await page.check('#availOnly');
    await page.waitForTimeout(150);
    const avail = await visibleCards(page);
    check('availability hides رادیاتور → ۱۱ cards', avail.length === 11 && !avail.some(c => c.name.includes('رادیاتور')), `got ${avail.length}`);
    await page.uncheck('#availOnly');
    await page.$eval('#priceRange', el => { el.value = '500000'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.waitForTimeout(150);
    const minPrice = await visibleCards(page);
    check('min price → only استعلام card survives', minPrice.length === 1 && minPrice[0].name.includes('واتر پمپ'), JSON.stringify(minPrice.map(c => c.name)));
    await page.close();
  }

  // ---------- 6. Homepage search → catalog ?q= ----------
  console.log('\n[6] homepage search → catalog ?q=');
  {
    const { page } = await load('/store/index.html');
    await page.fill('#mainSearchInput', 'لنت');
    await page.click('button[onclick="submitMainSearch()"]');
    await page.waitForURL(/catalog\.html\?q=/, { timeout: 8000 });
    check('navigated to catalog with ?q=لنت', decodeURIComponent(page.url()).includes('q=لنت'));
    await page.waitForTimeout(500);
    const cards = await visibleCards(page);
    check('search box prefilled', (await page.inputValue('#catalogSearch')) === 'لنت');
    check('filtered to لنت card (۱)', cards.length === 1 && cards[0].name.includes('لنت'), JSON.stringify(cards.map(c => c.name)));
    await page.close();
  }

  // ---------- 7. Homepage VIN decoder: failure & success ----------
  console.log('\n[7] homepage VIN decoder');
  {
    const { page } = await load('/store/index.html');
    await page.fill('#vinDecoderInput', 'ABC123');
    await page.click('button[onclick*="runVinDecoder"]');
    await page.waitForTimeout(250);
    check('invalid → red «فرمت نامعتبر»', (await page.textContent('#vinStatusBadge')).includes('نامعتبر'));
    check('invalid → fields cleared', (await page.textContent('#resMake')).trim() === '—');
    check('invalid → valid-format hint shown', (await page.textContent('#resPartsList')).includes('NAAP03ED4LH198420'));

    await page.fill('#vinDecoderInput', 'NAS411100P1452098');
    await page.click('button[onclick*="runVinDecoder"]');
    await page.waitForTimeout(250);
    check('valid Saipa → تایید شد', (await page.textContent('#vinStatusBadge')).includes('تایید شد'));
    check('valid Saipa → سایپا decoded', (await page.textContent('#resMake')).includes('سایپا'));
    check('badge class restored to emerald', await page.$eval('#vinStatusBadge', el => el.className.includes('text-emerald-400')));
    await page.close();
  }

  // ---------- 8. Homepage quick view: variant reset + Persian qty ----------
  console.log('\n[8] homepage quick view');
  {
    const { page } = await load('/store/index.html');
    await page.hover('[data-product-id="p2"]');
    await page.click('[data-product-id="p2"] button:has-text("پیش‌نمایش سریع")', { force: true });
    await page.waitForTimeout(250);
    check('p2 (چراغ) shows variant box', await page.$eval('#modalVariantBox', el => el.style.display === 'block'));
    await page.click('button[onclick="changeModalQty(1)"]');
    check('qty shows ۲ (fa-IR)', (await page.textContent('#modalQtyDisplay')).trim() === '۲');
    await page.click('#quickViewModal button[onclick="closeQuickView()"]');
    await page.waitForTimeout(150);
    await page.click('button[onclick="openQuickViewFromInspector()"]');
    await page.waitForTimeout(250);
    check('inspector quick view (لنت) hides variant box', await page.$eval('#modalVariantBox', el => el.style.display === 'none'));
    check('qty reset to ۱', (await page.textContent('#modalQtyDisplay')).trim() === '۱');
    await page.close();
  }

  // ---------- 9. PDP VIN scanner: three outcomes ----------
  console.log('\n[9] product-detail VIN scanner');
  {
    const { page } = await load('/store/product-detail.html');
    async function scan(vin) {
      await page.fill('#vinInput', vin);
      await page.click('button[onclick="verifyLiveVin()"]');
      await page.waitForTimeout(950);
      return {
        badge: await page.textContent('#vinResultBadge'),
        note: await page.textContent('#vinResultNote'),
        badgeClass: await page.$eval('#vinResultBadge', el => el.className)
      };
    }
    let r = await scan('NAAP03ED4LH198420');
    check('IKCO chassis → amber «عدم تطابق پلتفرم»', r.badge.includes('عدم تطابق پلتفرم') && r.badgeClass.includes('text-amber-700'));
    check('mismatch note mentions ایران‌خودرو', r.note.includes('ایران‌خودرو'));

    r = await scan('NAS411100P1452098');
    check('Saipa chassis → green تایید شد', r.badge.includes('تایید شد') && r.badgeClass.includes('text-emerald-700'));

    r = await scan('ABC123');
    check('bad format → red «نامعتبر»', r.badge.includes('نامعتبر') && r.badgeClass.includes('text-rose-700'));

    await page.click('button[onclick="changeQty(1)"]');
    check('qty display ۲ (fa-IR)', (await page.textContent('#qtyDisplay')).trim() === '۲');
    await page.click('#btnLeft');
    check('stock count ۲ (fa-IR)', (await page.textContent('#stockCount')).trim().startsWith('۲'));
    await page.close();
  }

  // ---------- 10. Admin fast table: keyboard nav + stock sync ----------
  console.log('\n[10] admin fast table');
  {
    const { page } = await load('/admin/index.html');
    check('row count shows ۶', (await page.textContent('#totalRowsCount')).trim() === '۶');

    const activeInfo = () => page.evaluate(() => {
      const el = document.activeElement;
      const tr = el.closest('tr');
      return { row: tr ? tr.dataset.id : null, isPrice: el.classList.contains('price-input'), isStock: el.matches('input[type="number"]') };
    });

    await (await page.$('tr[data-id="1"] .price-input')).focus();
    await page.keyboard.press('ArrowDown');
    let info = await activeInfo();
    check('ArrowDown from row1 price → row2 price', info.row === '2' && info.isPrice, JSON.stringify(info));

    await page.keyboard.press('ArrowRight');
    info = await activeInfo();
    check('ArrowRight (RTL previous field) → row2 stock', info.row === '2' && info.isStock, JSON.stringify(info));

    await page.keyboard.press('ArrowLeft');
    info = await activeInfo();
    check('ArrowLeft (RTL next field) → back to row2 price', info.row === '2' && info.isPrice, JSON.stringify(info));

    await page.keyboard.press('Enter');
    info = await activeInfo();
    check('Enter from row2 → row3', info.row === '3', JSON.stringify(info));

    await page.fill('tr[data-id="1"] input[type="number"]', '0');
    await page.$eval('tr[data-id="1"] input[type="number"]', el => el.dispatchEvent(new Event('change', { bubbles: true })));
    await page.selectOption('#stockFilter', 'out');
    await page.waitForTimeout(150);
    const visibleRows = await page.$$eval('#productTableBody tr', rows => rows.filter(r => r.style.display !== 'none').map(r => r.dataset.id));
    check('stock=0 edit syncs filter → only row 1 in «ناموجودها»', visibleRows.length === 1 && visibleRows[0] === '1', JSON.stringify(visibleRows));
    check('visible count text ۱', (await page.textContent('#totalRowsCount')).trim() === '۱');
    await page.close();
  }

  // ---------- 11. Orders page ----------
  console.log('\n[11] orders page');
  {
    const { page } = await load('/admin/orders.html');
    const body = await page.textContent('body');
    check('stat card: سفارشات جدید', body.includes('سفارشات جدید'));
    check('stat card: در انتظار تایید شاسی', body.includes('در انتظار تایید شاسی'));
    check('stat card: در حال بسته‌بندی', body.includes('در حال بسته‌بندی'));
    check('realistic 17-char VIN NAAB01EC5MJ884102', body.includes('NAAB01EC5MJ884102'));
    check('pseudo-chassis removed', !body.includes('IR-IKCO-PARS-TU5-99824'));
    await page.close();
  }

  // ---------- 12. Console health on all pages ----------
  console.log('\n[12] console health — all pages');
  {
    const paths = ['/index.html', '/store/index.html', '/store/catalog.html', '/store/product-detail.html',
                   '/admin/index.html', '/admin/product-add.html', '/admin/orders.html'];
    for (const p of paths) {
      const { errors } = await load(p);
      const jsErrors = errors.filter(e => !/Failed to load resource|net::ERR|ERR_(INTERNET|NAME|CONNECTION|TIMED_OUT)|favicon/i.test(e));
      check(`${p}: no JS/console errors`, jsErrors.length === 0, jsErrors.slice(0, 3).join(' | '));
    }
  }

  console.log('\n================================');
  console.log(`PASSED: ${passed}   FAILED: ${failed}`);
  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
})().catch(e => { console.error('SCRIPT ERROR:', e); process.exit(2); });
