/**
 * Captures real product footage from the deployed sentinel-agent site.
 *
 * Every frame of UI in the film comes from here — nothing is recreated. The site
 * disables its GSAP reveals and ScrollSmoother under `prefers-reduced-motion`,
 * so emulating that gives fully-revealed content and plain native scroll, which
 * is the only way a full-page clip lands deterministically.
 *
 * Shots are captured at deviceScaleFactor 3 so a 1080p composition can push in
 * on a panel without the pixels showing.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '..', 'public', 'shots');
const BASE = process.env.SHOT_BASE_URL ?? 'https://sentinel-agent-web.vercel.app';
const SCALE = 3;

/** Panels located by a distinctive string, then widened to the nearest real panel. */
const PANELS = [
  { name: 'timeline', url: '/', text: 'sentinel-agent — run · INC-2048', minW: 500, minH: 200 },
  { name: 'sandbox', url: '/', text: 'sandbox · python 3.13 · no credentials', minW: 460, minH: 200 },
  { name: 'gate', url: '/', text: 'approval required — thread thr_9f2a', minW: 500, minH: 200 },
  { name: 'latency', url: '/', sel: 'svg[aria-label^="Checkout p95 latency"]' },
  { name: 'signals', url: '/', text: 'settled before', minW: 900, minH: 200 },
  { name: 'annotation', url: '/', text: 'not even @read-only', minW: 900, minH: 200 },
  { name: 'probes', url: '/', text: 'ROUTE NOT TAKEN', minW: 900, minH: 260 },
  { name: 'doctor', url: '/', text: 'none configured — local fallback active', minW: 600, minH: 300 },
  { name: 'systemmap', url: '/docs/architecture', text: 'TRUEFORGE HARNESS', minW: 600, minH: 250 },
  { name: 'tools', url: '/docs/tools', text: 'rollback_deployment', minW: 600, minH: 300 },
  // The guided tour is the film's narrative spine; these are its key exhibits.
  { name: 'suspects', url: '/docs/tour', text: 'ruled out, 28h earlier', minW: 600, minH: 220 },
  { name: 'diff', url: '/docs/tour', text: 'be more patient with it', minW: 600, minH: 240 },
  { name: 'stats', url: '/docs/tour', text: 'clicks required to reach a root cause', minW: 600, minH: 120 },
  { name: 'incident', url: '/docs/tour', text: 'Checkout p95 latency regression', minW: 600, minH: 130 },
];

/** Whole-viewport shots, taken after scrolling to a y offset. */
const VIEWS = [
  { name: 'hero', url: '/', y: 0 },
  { name: 'run-section', url: '/', y: 1180 },
  { name: 'evidence-section', url: '/', y: 3860 },
  { name: 'bug-section', url: '/', y: 4460 },
  { name: 'platform-section', url: '/', y: 5400 },
  { name: 'proof-section', url: '/', y: 6500 },
  { name: 'finale-section', url: '/', y: 8100 },
  { name: 'docs-gate-prover', url: '/docs/gate-prover', y: 0 },
  { name: 'docs-subagents', url: '/docs/subagents', y: 0 },
  { name: 'docs-approval-gate', url: '/docs/approval-gate', y: 0 },
  { name: 'docs-tour', url: '/docs/tour', y: 0 },
];

/** Finds the smallest ancestor of the text match that reads as a real panel. */
const boxFor = (page, text, minW, minH) =>
  page.evaluate(
    ({ text, minW, minH }) => {
      const all = Array.from(document.querySelectorAll('div,section,figure,pre,article,table'));
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

const settle = async (page) => {
  await page.waitForLoadState('networkidle').catch(() => {});
  // Fonts drive every panel's metrics; a clip taken before they swap is a different shot.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
};

const run = async () => {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: SCALE,
    reducedMotion: 'reduce',
    colorScheme: 'dark',
  });

  let loaded = null;
  const goto = async (url) => {
    if (loaded === url) return;
    await page.goto(BASE + url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await settle(page);
    loaded = url;
  };

  for (const v of VIEWS) {
    await goto(v.url);
    await page.evaluate((y) => window.scrollTo(0, y), v.y);
    await page.waitForTimeout(450);
    await page.screenshot({ path: path.join(OUT, `${v.name}.png`) });
    console.log(`view   ${v.name}`);
  }

  for (const p of PANELS) {
    await goto(p.url);
    const box = p.sel
      ? await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return {
            x: Math.round(r.left + scrollX),
            y: Math.round(r.top + scrollY),
            width: Math.round(r.width),
            height: Math.round(r.height),
          };
        }, p.sel)
      : await boxFor(page, p.text, p.minW, p.minH);
    if (!box) {
      console.warn(`MISS   ${p.name} — "${p.sel ?? p.text}" not found on ${p.url}`);
      continue;
    }
    // A little air around the panel so a camera push never hits a hard edge.
    const pad = 18;
    await page.screenshot({
      path: path.join(OUT, `${p.name}.png`),
      fullPage: true,
      clip: {
        x: Math.max(0, box.x - pad),
        y: Math.max(0, box.y - pad),
        width: box.width + pad * 2,
        height: box.height + pad * 2,
      },
    });
    console.log(`panel  ${p.name}  ${box.width}x${box.height}`);
  }

  await browser.close();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
