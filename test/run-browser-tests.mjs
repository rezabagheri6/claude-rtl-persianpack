/**
 * Runs the sandbox assertions in headless Chrome and reports the result.
 *
 * No test framework and no browser download: the page runs its own checks and
 * writes them into the DOM, and `chrome --dump-dom` carries them back out.
 *
 *   node test/run-browser-tests.mjs
 *   CHROME="C:/path/to/chrome.exe" node test/run-browser-tests.mjs
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = resolve(HERE, 'rtl-sandbox.html');

const CANDIDATES = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

function findBrowser() {
  const found = CANDIDATES.find((path) => existsSync(path));
  if (found) return found;
  console.error('No Chrome or Edge found. Set CHROME to the executable path.');
  process.exit(2);
}

function dumpDom(browser, url) {
  return execFileSync(
    browser,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      // Layout is asserted on, so pin the viewport.
      '--window-size=1280,900',
      // Let the streaming simulation's timers run to completion.
      '--virtual-time-budget=20000',
      '--dump-dom',
      url,
    ],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }
  );
}

const browser = findBrowser();
const url = `${pathToFileURL(PAGE).href}?autotest=1`;

let dom;
try {
  dom = dumpDom(browser, url);
} catch (err) {
  console.error(`Failed to run ${browser}: ${err.message}`);
  process.exit(2);
}

const match = dom.match(/id="test-results"[^>]*data-b64="([A-Za-z0-9+/=]+)"/);
if (!match) {
  console.error('The assertions never finished — no results element in the dumped DOM.');
  console.error('Re-run the page in a real browser with ?autotest=1 to see why.');
  process.exit(2);
}

const payload = JSON.parse(Buffer.from(match[1], 'base64').toString('utf8'));

for (const result of payload.results) {
  const mark = result.pass ? 'ok  ' : 'FAIL';
  const detail = result.pass || result.detail === null ? '' : `  -> ${result.detail}`;
  console.log(`${mark} ${result.name}${detail}`);
}

console.log(`\n${payload.total - payload.failed}/${payload.total} passed`);
process.exit(payload.failed ? 1 : 0);
