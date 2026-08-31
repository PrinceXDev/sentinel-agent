/**
 * Captures the operator console showing a real, completed run.
 *
 * The run itself was executed by `scripts/demo-run.mjs` against a live TrueForge
 * harness; the console here is reading the same estate the agent mutated, so
 * every panel below is a record of what actually happened rather than a mock-up:
 * the incident is `mitigated`, the live deployment is the rolled-back-to one,
 * and the audit rail lists the six gated calls a human approved.
 *
 * Point it at a loopback origin — Next's dev server refuses non-loopback Hosts.
 * `scripts/wsl-proxy.mjs` provides one when the console runs inside WSL.
 *
 *   node scripts/capture-console.mjs [baseUrl]
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '..', 'public', 'shots');
const BASE = process.argv[2] ?? 'http://127.0.0.1:3200';
const SCALE = 3;

/** Panels located by a distinctive string, widened to the nearest real panel. */
const PANELS = [
  { name: 'con-incident', text: 'Checkout p95 latency regression', minW: 700, minH: 120 },
  { name: 'con-rootcause', text: 'increased the tax provider upstream client timeout', minW: 700, minH: 200 },
  { name: 'con-audit', text: 'estate audit — what actually changed', minW: 240, minH: 300 },
  { name: 'con-verify', text: 'Rollback verification complete', minW: 700, minH: 140 },
  { name: 'con-evidence', text: 'evidence-auditor-independent', minW: 700, minH: 260 },
  // The two-arc dial: the investigator's number inside, the reviewer's outside.
  { name: 'con-confidence', sel: 'section div.shrink-0' },
  { name: 'con-claims', text: 'P95 latency increased from 177.8ms baseline', minW: 700, minH: 300 },
];

const boxFor = (page, text, minW, minH) =>
  page.evaluate(
    ({ text, minW, minH }) => {
      const all = Array.from(document.querySelectorAll('div,section,article,aside,table,figure'));
      const hits = all.filter((e) => e.textContent?.includes(text));
      if (!hits.length) return null;
      let el = hits[hits.length - 1];
      let chosen = el;
      while (el?.parentElement) {
        const r = el.getBoundingClientRect();
        if (r.width >= minW && r.height >= minH) {
          chosen = el;
          break;
        }
        el = el.parentElement;
      }
      const r = chosen.getBoundingClientRect();
      return {
        x: Math.round(r.left + scrollX),
        y: Math.round(r.top + scrollY),
        width: Math.round(r.width),
        height: Math.round(r.height),
      };
    },
    { text, minW, minH },
  );

const run = async () => {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1600, height: 950 },
    deviceScaleFactor: SCALE,
    reducedMotion: 'reduce',
    colorScheme: 'dark',
  });

  await page.goto(`${BASE}/console`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  // The console loads the estate client-side; wait for it to actually arrive.
  await page.waitForFunction(() => document.body.innerText.includes('MITIGATED'), {
    timeout: 45_000,
  });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);

  await page.screenshot({ path: path.join(OUT, 'con-full.png') });
  console.log('view   con-full');

  const docH = await page.evaluate(() => document.documentElement.scrollHeight);
  for (const [i, y] of [0, 780, 1560, 2340, 3120].entries()) {
    if (y > docH) break;
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(OUT, `con-scroll-${i}.png`) });
    console.log(`view   con-scroll-${i}`);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);

  for (const p of PANELS) {
    // Scroll the panel into view and clip in viewport coordinates. A fullPage
    // clip below the fold comes back black here: the console only paints what
    // is on screen, so the region has never been rendered when it is captured.
    const box = await page.evaluate(
      ({ sel, text, minW, minH }) => {
        let chosen = null;
        if (sel) {
          chosen = document.querySelector(sel);
        } else {
          const all = Array.from(
            document.querySelectorAll('div,section,article,aside,table,figure'),
          );
          const hits = all.filter((e) => e.textContent?.includes(text));
          if (hits.length) {
            let el = hits[hits.length - 1];
            chosen = el;
            while (el?.parentElement) {
              const r = el.getBoundingClientRect();
              if (r.width >= minW && r.height >= minH) {
                chosen = el;
                break;
              }
              el = el.parentElement;
            }
          }
        }
        if (!chosen) return null;
        chosen.scrollIntoView({ block: 'center', behavior: 'instant' });
        const r = chosen.getBoundingClientRect();
        return {
          x: Math.round(r.left),
          y: Math.round(r.top),
          width: Math.round(r.width),
          height: Math.round(r.height),
        };
      },
      { sel: p.sel ?? null, text: p.text ?? '', minW: p.minW ?? 0, minH: p.minH ?? 0 },
    );

    if (!box || box.height < 40) {
      console.warn(`MISS   ${p.name} — "${p.sel ?? p.text}"`);
      continue;
    }
    await page.waitForTimeout(320);

    const pad = 16;
    const vw = 1600;
    const vh = 950;
    const clip = {
      x: Math.max(0, box.x - pad),
      y: Math.max(0, box.y - pad),
      width: Math.min(vw, box.width + pad * 2),
      height: Math.min(vh, box.height + pad * 2),
    };
    clip.width = Math.min(clip.width, vw - clip.x);
    clip.height = Math.min(clip.height, vh - clip.y);

    await page.screenshot({ path: path.join(OUT, `${p.name}.png`), clip });
    console.log(`panel  ${p.name}  ${clip.width}x${clip.height}`);
  }

  await browser.close();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
