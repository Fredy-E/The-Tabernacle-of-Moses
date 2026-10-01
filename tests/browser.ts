import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, type Page } from 'playwright';

interface Renderer {
  alive(): boolean;
  software(): boolean;
  visibility(): { mask: number; triangles: number; totalTriangles: number; particles: number };
}
declare const GL: Renderer;

const root = path.resolve(__dirname, '..');
const results = path.join(root, 'test-results');
const screenshots = process.env.UPDATE_SCREENSHOTS === '1'
  ? path.join(root, 'docs', 'images') : results;
const target = process.env.SITE_URL || pathToFileURL(path.join(root, 'index.html')).href;

async function settle(page: Page, step: number): Promise<void> {
  await page.evaluate(() => {
    document.documentElement.dataset.verifyScrollY = '';
    document.documentElement.dataset.verifyLastMove = String(performance.now());
  });
  await page.waitForFunction(() => {
    const data = document.documentElement.dataset;
    if (data.verifyScrollY !== String(scrollY)) {
      data.verifyScrollY = String(scrollY);
      data.verifyLastMove = String(performance.now());
    }
    return performance.now() - Number(data.verifyLastMove) > 250;
  });
  assert.equal(await page.locator('.pill.on').getAttribute('data-step'), String(step));
}

async function main(): Promise<void> {
  await mkdir(results, { recursive: true });
  await mkdir(screenshots, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    args: ['--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
  });
  const errors: string[] = [];
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  try {
    await page.goto(target);
    await page.waitForFunction(() => document.querySelector('#gltoggle')?.getAttribute('aria-busy') !== 'true');
    assert.equal(await page.locator('blockquote').count(), 33);
    assert.equal(await page.locator('.stop').count(), 9);
    assert.equal(await page.locator('.pill').count(), 9);
    assert.equal(await page.locator('#markers .mk').count(), 8);
    assert.deepEqual(await page.locator('#navlinks a').allTextContents(), ['Why', 'Walkthrough', 'Verses', 'Map', 'Sources']);
    assert.equal(await page.evaluate(() => GL.alive()), true);
    assert(await page.evaluate(() => [...document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')]
      .every(a => document.getElementById(a.getAttribute('href')!.slice(1)))));
    for (const quality of ['low', 'medium', 'high']) {
      await page.selectOption('#quality-select', quality);
      await page.waitForTimeout(600);
      assert.equal(await page.evaluate(() => GL.alive()), true);
      assert.equal(await page.evaluate(() => document.querySelector<HTMLCanvasElement>('#stage')!.getContext('webgl2')!.getError()), 0);
    }
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(screenshots, 'hero.png') });
    await page.selectOption('#quality-select', 'low');
    for (let step = 1; step <= 9; step++) {
      await page.locator(`.pill[data-step="${step}"]`).evaluate(el => (el as HTMLButtonElement).click());
      await settle(page, step);
      await page.waitForFunction(n => getComputedStyle(document.getElementById('step-' + n)!).opacity === '1', step);
      assert.equal(await page.locator('#legend .on').getAttribute('data-step'), String(step));
    }
    assert.equal(await page.locator('#next').isDisabled(), true);
    await page.selectOption('#quality-select', 'high');
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(screenshots, 'ark.png') });
    await page.selectOption('#quality-select', 'low');
    await page.locator('#prev').click();
    await settle(page, 8);
    await page.locator('#next').click();
    await settle(page, 9);
    await page.locator('#legend a[data-step="4"]').click();
    await settle(page, 4);
    await page.locator('#markers a[data-step="6"]').click();
    await settle(page, 6);
    await page.evaluate(() => document.querySelector('#step-3')!.scrollIntoView({ behavior: 'instant' }));
    await settle(page, 3);
    await page.keyboard.press('ArrowRight');
    await settle(page, 4);
    await page.keyboard.press('ArrowLeft');
    await settle(page, 3);
    for (const pressed of ['false', 'true']) {
      await page.locator('#gltoggle').click();
      assert.equal(await page.locator('#gltoggle').getAttribute('aria-pressed'), pressed);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(750);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.join(results, 'mobile.png') });
    await page.evaluate(() => document.querySelector('#step-9')!.scrollIntoView({ behavior: 'instant' }));
    await settle(page, 9);
    await page.waitForFunction(() => getComputedStyle(document.getElementById('step-9')!).opacity === '1');
    await page.emulateMedia({ reducedMotion: 'reduce', media: 'print' });
    assert.equal(await page.locator('#stage').evaluate(el => getComputedStyle(el).display), 'none');
    assert(await page.locator('.reveal').evaluateAll(elements => elements.every(el => getComputedStyle(el).opacity === '1')));
    const fallback = await browser.newPage();
    await fallback.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
        if (type === 'webgl2') return null;
        return Reflect.apply(original, this, [type, ...args]);
      } as typeof original;
    });
    await fallback.goto(target);
    await fallback.waitForFunction(() => document.querySelector('#gltoggle')?.getAttribute('aria-busy') !== 'true');
    assert.equal(await fallback.locator('#gltoggle').isDisabled(), true);
    assert.equal(await fallback.locator('.pill').count(), 9);
    await fallback.close();
    assert.deepEqual(errors, []);
    console.log('PASS: WebGL quality profiles, nine steps, scrolling, map, keyboard, 3D toggle, mobile, print, and WebGL fallback.');
  } catch (error) {
    await page.screenshot({ path: path.join(results, 'failure.png') }).catch(() => {});
    throw error;
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
