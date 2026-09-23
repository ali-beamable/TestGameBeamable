// Live smoke test: plays a real session in Chromium and fails unless the Beamable realtime
// socket opens and the SDK sends its session-start frame. Records a video to e2e-output/.
//   BASE_URL=https://ali-beamable.github.io/TestGameBeamable/ node e2e/smoke.mjs
import { chromium } from 'playwright';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4173/';
const OUT = 'e2e-output';
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT);

const size = { width: 720, height: 1000 };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: process.env.CHROMIUM_ARGS ? process.env.CHROMIUM_ARGS.split(' ') : [] });
const context = await browser.newContext({ viewport: size, recordVideo: { dir: OUT, size } });
const page = await context.newPage();

const socket = { url: null, opened: false, sessionStartSent: false, framesReceived: 0, closed: null };
const problems = [];
page.on('websocket', (ws) => {
  if (!ws.url().includes('socket.beamable.com')) return;
  socket.url = ws.url().replace(/access_token=[^&]+/, 'access_token=***');
  // The SDK only sends frames once the socket is open, and its first frame is session-start.
  ws.on('framesent', (f) => {
    socket.opened = true;
    if (String(f.payload).includes('"session-start"')) socket.sessionStartSent = true;
  });
  ws.on('framereceived', () => { socket.opened = true; socket.framesReceived++; });
  ws.on('socketerror', (e) => problems.push(`websocket error: ${e}`));
  ws.on('close', () => { socket.closed = new Date().toISOString(); });
});
page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') console.log('console error:', m.text().slice(0, 300)); });

// Caption bar for the recording (not part of the game).
await page.addInitScript(() => {
  window.addEventListener('DOMContentLoaded', () => {
    const bar = document.createElement('div');
    bar.id = 'e2e-caption';
    bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;padding:12px 16px;background:#1d1d1f;color:#fff;font:15px system-ui;text-align:center;z-index:9';
    bar.textContent = 'Loading RPS Arena…';
    document.body.appendChild(bar);
  });
});
const caption = (t) => page.evaluate((t) => { const b = document.getElementById('e2e-caption'); if (b) b.textContent = t; }, t);
const pause = (ms) => page.waitForTimeout(ms);

let summary;
try {
  await page.goto(BASE_URL);
  await page.waitForSelector('#board:not([hidden])', { timeout: 45000 });
  await page.waitForSelector('#moves button:not([disabled])', { timeout: 30000 });
  if (!socket.opened || !socket.sessionStartSent) throw new Error('realtime socket did not open / no session-start frame was sent');
  await caption(`Realtime socket open, session-start sent. ${(await page.textContent('#player')).trim()}`);
  await pause(3000);

  const moves = ['rock', 'paper', 'scissors'];
  const hands = { '✊': 'rock', '✋': 'paper', '✌️': 'scissors' };
  for (let round = 1; round <= 9; round++) {
    const move = moves[Math.floor(Math.random() * 3)];
    await caption(`Round ${round}: throwing ${move}`);
    await pause(1000);
    // Wait on the PlayRound call itself: consecutive ties leave the status text unchanged.
    const played = page.waitForResponse((r) => r.url().includes('/PlayRound'), { timeout: 15000 });
    await page.click(`#moves button[data-move=${move}]`);
    if (!(await played).ok()) throw new Error(`PlayRound failed: HTTP ${(await played).status()}`);
    await page.waitForFunction(() => !document.querySelector('#forfeit').disabled || !document.querySelector('#new-match').hidden, null, { timeout: 15000 });
    const cpu = hands[await page.$eval('#cpu-hand', (e) => e.textContent)];
    const status = await page.textContent('#status');
    console.log(`round ${round}: ${move} vs ${cpu} -> ${status}`);
    await caption(`CPU threw ${cpu}. ${status}`);
    await pause(1800);
    if (!(await page.isHidden('#new-match'))) break;
  }
  await page.waitForFunction(() => document.querySelectorAll('#recent li').length > 0, null, { timeout: 15000 });
  await caption(`Match saved by MatchService. Socket still open: ${socket.closed ? 'no' : 'yes'} · frames received: ${socket.framesReceived}`);
  await pause(3000);
  if (socket.closed) throw new Error(`realtime socket closed during the session at ${socket.closed}`);

  summary = {
    ok: problems.length === 0,
    baseUrl: BASE_URL,
    player: (await page.textContent('#player')).trim(),
    record: (await page.textContent('#record')).replace(/\s+/g, ' ').trim(),
    lastMatch: (await page.textContent('#recent li')).replace(/\s+/g, ' ').trim(),
    socket,
    problems,
  };
} catch (err) {
  summary = { ok: false, baseUrl: BASE_URL, error: String(err), socket, problems };
  await page.screenshot({ path: `${OUT}/failure.png`, fullPage: true }).catch(() => {});
}

await context.close();
await browser.close();
writeFileSync(`${OUT}/summary.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
process.exit(summary.ok ? 0 : 1);
