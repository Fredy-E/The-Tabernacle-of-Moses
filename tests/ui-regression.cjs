'use strict';
/* UI regression for the Tabernacle portfolio preview shell (static, no browser).
 * Run: node tests/ui-regression.cjs
 * RED on the pre-redesign page (no data-ui-revision / prototype notice / ui tokens).
 * Content/geometry/shader assertions stay in geometry/materials/visibility/browser suites;
 * this file only guards the UI-only wrapper and readability guardrails.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

let n = 0;
function check(name, cond, extra) {
  n += 1;
  assert.ok(cond, `${name}${extra ? ' — ' + extra : ''}`);
  console.log(`ok ${n} - ${name}`);
}

// 1. Principal shell carries the preview revision marker.
check('principal shell has data-ui-revision="portfolio-preview-1"',
  html.includes('data-ui-revision="portfolio-preview-1"'));

// 2. Visible prototype notice with the exact approved wording.
const m = html.match(/<[^>]*id="prototype-notice"[^>]*>([\s\S]*?)<\/p>/);
check('#prototype-notice exists', !!m);
if (m) {
  const text = m[1].replace(/<[^>]+>/g, ' ');
  check('notice carries exact concept-prototype sentence',
    text.includes('Experimental concept prototype — idea exploration only.'), text.slice(0, 180));
  check('notice states not finished/production-ready',
    /not (a )?finished/i.test(text) && /production-ready/i.test(text), text.slice(0, 180));
}

// 3. Family UI tokens on :root (single-file stylesheet).
const head = html.slice(0, html.indexOf('</style>') + 8);
for (const tok of ['--ui-bg', '--ui-surface', '--ui-ink', '--ui-muted', '--ui-accent', '--ui-border', '--ui-radius']) {
  check(`single-file style defines ${tok}`, head.includes(tok));
}

// 4. Existing walkthrough controls/ids/actions/content intact (no renames).
for (const id of ['stage', 'gltoggle', 'quality-select', 'navlinks', 'walkthrough', 'prev', 'next', 'pills', 'map', 'markers', 'legend', 'sources', 'pattern']) {
  check(`existing id #${id} intact`, html.includes(`id="${id}"`));
}
for (const sid of ['step-1', 'step-2', 'step-3', 'step-4', 'step-5', 'step-6', 'step-7', 'step-8', 'step-9']) {
  check(`existing ${sid} intact`, html.includes(`id="${sid}"`));
}
check('33 NIV quotation blocks intact', (html.match(/<blockquote\b/g) || []).length === 33);
check('existing Arabic title intact', html.includes('خيمة الاجتماع'));
check('existing nav labels intact',
  JSON.stringify(['Why', 'Walkthrough', 'Verses', 'Map', 'Sources'].map(s => html.includes(`>${s}<`))) === JSON.stringify([true, true, true, true, true]));
check('no new Bible sources introduced (only existing citations)',
  !/ESV|KJV|RSV|NRSV|Berean/i.test(html.slice(0, html.indexOf('<script>'))));

// 5. Readability/accessibility guardrails (UI-only CSS additions).
check('visible keyboard focus style', /:focus-visible/.test(html));
check('reduced-motion honored', /prefers-reduced-motion/.test(html));
check('system color scheme adaptation without persistence', /prefers-color-scheme:\s*light/.test(html));
check('print stylesheet keeps walkthrough readable', /@media\s+print/.test(html));
check('responsive small-viewport rule', /max-width/.test(html) && /390px|320px|760px|900px/.test(html));

// 6. Single-file offline discipline preserved.
check('no external scripts/stylesheets', !/<script\s+src=|<link\s+[^>]*href="http/i.test(html));
check('no network APIs at runtime', !/\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/.test(html.match(/<script>([\s\S]*?)<\/script>/)[1]));
check('no open-source license added (owner unlicensed decision preserved)',
  !/MIT License|Apache License|GPL/i.test(html.slice(0, 20000)) && !fs.existsSync(path.join(ROOT, 'LICENSE')));

console.log(`Passed: Tabernacle portfolio preview UI regression (${n} checks).`);
