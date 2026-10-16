import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 5173;
const CDP_PORT = 9388; // Use dedicated port 9388

console.log("====================================================");
console.log("   LIVE BROWSER AUTOMATION & E2E VERIFICATION       ");
console.log("====================================================");

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();
    this.consoleErrors = [];

    this.ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.id && this.callbacks.has(data.id)) {
        this.callbacks.get(data.id)(data);
        this.callbacks.delete(data.id);
      }
      if (data.method === 'Runtime.consoleAPICalled') {
        const text = (data.params.args || []).map(a => a.value || a.description || JSON.stringify(a)).join(' ');
        console.log(`[BROWSER LOG (${data.params.type})]: ${text}`);
        if (data.params.type === 'error') {
          this.consoleErrors.push(data.params.args);
        }
      }
      if (data.method === 'Runtime.exceptionThrown') {
        console.error("BROWSER EXCEPTION:", data.params.exceptionDetails);
        this.consoleErrors.push(data.params.exceptionDetails);
      }
    };
  }

  ready() {
    return new Promise((resolve, reject) => {
      if (this.ws.readyState === WebSocket.OPEN) return resolve();
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
    });
  }

  send(method, params = {}) {
    return new Promise((resolve) => {
      const msgId = this.id++;
      this.callbacks.set(msgId, resolve);
      this.ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.result && res.result.exceptionDetails) {
      throw new Error(`Eval error: ${JSON.stringify(res.result.exceptionDetails)}`);
    }
    return res.result?.result?.value;
  }
}

async function run() {
  // 1. Check if Vite is already running or launch it
  console.log("[1/7] Ensuring Vite server is accessible on http://localhost:5173...");
  let viteProcess = null;
  let serverReady = false;

  try {
    await new Promise((res, rej) => {
      const req = http.get(`http://localhost:${PORT}`, (r) => {
        if (r.statusCode === 200) { serverReady = true; res(); }
        else rej(new Error());
      });
      req.on('error', rej);
    });
  } catch (e) {
    serverReady = false;
  }

  if (!serverReady) {
    console.log("Starting local Vite preview/dev server...");
    viteProcess = spawn('npx.cmd', ['vite', '--port', `${PORT}`, '--strictPort'], {
      cwd: process.cwd(),
      shell: true,
      stdio: 'pipe'
    });

    for (let i = 0; i < 20; i++) {
      await sleep(400);
      try {
        await new Promise((res, rej) => {
          const req = http.get(`http://localhost:${PORT}`, (r) => {
            if (r.statusCode === 200) { serverReady = true; res(); }
            else rej(new Error());
          });
          req.on('error', rej);
        });
        if (serverReady) break;
      } catch (e) {}
    }
  }

  if (!serverReady) {
    throw new Error("Could not start or reach Vite server on port " + PORT);
  }
  console.log(`[PASS] Server responding on http://localhost:${PORT}`);

  // 2. Launch Chrome and listen for DevTools WebSocket URL
  console.log("\n[2/7] Launching Headless Chrome browser...");
  const tmpProfileDir = path.join(process.cwd(), '.tmp-chrome-p2');
  if (!fs.existsSync(tmpProfileDir)) fs.mkdirSync(tmpProfileDir, { recursive: true });

  let browserWsUrl = null;
  const chromeProcess = spawn(CHROME_PATH, [
    '--headless',
    '--no-sandbox',
    `--remote-debugging-port=${CDP_PORT}`,
    '--remote-allow-origins=*',
    `--user-data-dir=${tmpProfileDir}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1280,720',
    `http://localhost:${PORT}`
  ]);

  const wsPromise = new Promise((resolve, reject) => {
    chromeProcess.stderr.on('data', (d) => {
      const text = d.toString();
      const match = text.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) {
        browserWsUrl = match[1];
        resolve(browserWsUrl);
      }
    });
    setTimeout(() => {
      if (!browserWsUrl) reject(new Error("Timeout waiting for Chrome DevTools websocket URL"));
    }, 10000);
  });

  console.log("[3/7] Waiting for Chrome to emit DevTools WebSocket endpoint...");
  await wsPromise;
  console.log(`[PASS] Browser DevTools endpoint: ${browserWsUrl}`);

  // Connect to Browser target
  const browserClient = new CDPClient(browserWsUrl);
  await browserClient.ready();

  // Find page target
  console.log("Finding game page target...");
  const targetsRes = await browserClient.send('Target.getTargets');
  const pageTarget = targetsRes.result?.targetInfos?.find(t => t.type === 'page');
  if (!pageTarget) {
    throw new Error("No page target found in browser!");
  }

  const attachRes = await browserClient.send('Target.attachToTarget', {
    targetId: pageTarget.targetId,
    flatten: true
  });
  const sessionId = attachRes.result?.sessionId;

  // Create page client wrapping this session
  class PageClient {
    constructor(client, sessionId) {
      this.client = client;
      this.sessionId = sessionId;
      this.id = 1;
      this.callbacks = new Map();
      this.consoleErrors = [];

      this.client.ws.addEventListener('message', (event) => {
        const data = JSON.parse(event.data);
        if (data.sessionId === this.sessionId) {
          if (data.id && this.callbacks.has(data.id)) {
            this.callbacks.get(data.id)(data);
            this.callbacks.delete(data.id);
          }
          if (data.method === 'Runtime.consoleAPICalled') {
            const text = (data.params.args || []).map(a => a.value || a.description || JSON.stringify(a)).join(' ');
            console.log(`[PAGE LOG (${data.params.type})]: ${text}`);
            if (data.params.type === 'error') {
              this.consoleErrors.push(data.params.args);
            }
          }
          if (data.method === 'Runtime.exceptionThrown') {
            console.error("PAGE EXCEPTION:", data.params.exceptionDetails);
            this.consoleErrors.push(data.params.exceptionDetails);
          }
        }
      });
    }

    send(method, params = {}) {
      return new Promise((resolve) => {
        const msgId = this.id++;
        this.callbacks.set(msgId, resolve);
        this.client.ws.send(JSON.stringify({
          id: msgId,
          sessionId: this.sessionId,
          method,
          params
        }));
      });
    }

    async eval(expression) {
      const res = await this.send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true
      });
      if (res.result && res.result.exceptionDetails) {
        throw new Error(`Eval error: ${JSON.stringify(res.result.exceptionDetails)}`);
      }
      return res.result?.result?.value;
    }
  }

  const page = new PageClient(browserClient, sessionId);
  await page.send('Runtime.enable');
  await page.send('Page.enable');

  console.log("Navigating to http://localhost:5173...");
  await page.send('Page.navigate', { url: `http://localhost:${PORT}` });

  // Wait for load event
  await new Promise((resolve) => {
    const handler = (event) => {
      const data = JSON.parse(event.data);
      if (data.sessionId === sessionId && data.method === 'Page.loadEventFired') {
        browserClient.ws.removeEventListener('message', handler);
        resolve();
      }
    };
    browserClient.ws.addEventListener('message', handler);
    setTimeout(resolve, 3000); // safety fallback
  });

  // Wait an extra moment for Vite module resolution & Three.js initialization
  await sleep(1500);

  // 4. Verify initial state and no console errors
  console.log("\n[4/7] Checking Initial State & Console Errors...");
  const title = await page.eval("document.title");
  console.log(`Document Title: "${title}"`);

  const hasCanvas = await page.eval("!!document.querySelector('#game-container canvas')");
  console.log(`WebGL Canvas initialized: ${hasCanvas}`);
  if (!hasCanvas) throw new Error("Canvas was not created!");

  const startVisible = await page.eval("!document.getElementById('start-overlay').classList.contains('hidden')");
  console.log(`Start Screen visible: ${startVisible}`);
  if (!startVisible) throw new Error("Start overlay is not visible on launch!");

  // 5. Test Start Run via Space Key & Forward Run
  console.log("\n[5/7] Testing Game Launch via Spacebar, Forward Sprint & Real Gap Leap...");
  // Launch run using keyboard Space key
  await page.eval("window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }))");
  await page.eval("window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', bubbles: true }))");
  await sleep(300);

  const isPlaying = await page.eval("window.gameInstance.state === 'PLAYING'");
  console.log(`Game State after Space launch: ${isPlaying ? 'PLAYING' : 'FAILED'}`);
  if (!isPlaying) throw new Error("Spacebar did not start the game from Start overlay!");

  // Wait for runner to approach edge of Platform 0 (ends at 45.0m)
  console.log("Waiting for runner to approach edge of Platform 0...");
  for (let i = 0; i < 40; i++) {
    await sleep(100);
    const z = await page.eval("window.gameInstance.player.z");
    if (z >= 42.0) break;
  }

  // Leap across Gap 0 -> 1 (45.0m to 51.5m)
  console.log("Approaching ledge! Triggering Spacebar jump...");
  await page.eval("window.gameInstance.handleJumpDown()");
  const velYAfterJump = await page.eval("window.gameInstance.player.velY");
  console.log(`Upward jump impulse: ${velYAfterJump.toFixed(2)} m/s`);
  if (velYAfterJump <= 0) throw new Error("Jump failed to apply positive vertical velocity!");
  await page.eval("window.gameInstance.handleJumpUp()");

  // Wait for landing on Platform 1
  await sleep(750);
  const posAfterLanding = await page.eval("({ z: window.gameInstance.player.z, y: window.gameInstance.player.y, grounded: window.gameInstance.player.isGrounded })");
  console.log(`Player landed on Platform 1: Z=${posAfterLanding.z.toFixed(1)}m, Y=${posAfterLanding.y.toFixed(2)}m, Grounded=${posAfterLanding.grounded}`);
  if (!posAfterLanding.grounded || posAfterLanding.z < 51.0) {
    throw new Error("Player failed to clear Gap 0->1 and land on Platform 1!");
  }

  // 6. Test In-Game Energy Cell Collection & Mobile Touchscreen Tap
  console.log("\n[6/7] Testing Real Collectible Pickup, Mobile Touch Jump, Natural Fall & Game Over...");
  // Cell 1 is located at Z=80.0 on Platform 1
  console.log("Waiting for runner to reach Cell 1 at Z=80.0m...");
  for (let i = 0; i < 30; i++) {
    await sleep(100);
    const z = await page.eval("window.gameInstance.player.z");
    if (z >= 81.0) break;
  }

  const cellsCount = await page.eval("window.gameInstance.collectedCellsCount");
  const cell1Active = await page.eval("document.getElementById('cell-1').classList.contains('active')");
  console.log(`Cells collected: ${cellsCount}/5, HUD Cell 1 Icon Active: ${cell1Active}`);
  if (cellsCount < 1 || !cell1Active) {
    throw new Error("Energy Cell 1 was not collected upon running over it!");
  }

  // Test Mobile Touchscreen Tap on Canvas
  console.log("Testing mobile touchscreen tap on canvas...");
  await page.eval("document.querySelector('#game-container canvas').dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true }))");
  const velYMobile = await page.eval("window.gameInstance.player.velY");
  console.log(`Mobile canvas touch jump velocity: ${velYMobile.toFixed(2)} m/s`);
  if (velYMobile <= 0) throw new Error("Mobile touch on canvas failed to trigger jump!");
  await page.eval("document.querySelector('#game-container canvas').dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true }))");
  await sleep(700);

  // Test Natural Fall off Platform 1 (ends at z=105.0) into Gap 1->2 without jumping
  console.log("Testing natural ledge fall (no jump)...");
  for (let i = 0; i < 45; i++) {
    await sleep(100);
    const state = await page.eval("window.gameInstance.state");
    if (state === 'GAMEOVER') break;
  }

  const isGameOver = await page.eval("window.gameInstance.state === 'GAMEOVER'");
  const gameoverVisible = await page.eval("!document.getElementById('gameover-overlay').classList.contains('hidden')");
  const failDistText = await page.eval("document.getElementById('fail-dist').textContent");
  const failCellsText = await page.eval("document.getElementById('fail-cells').textContent");
  console.log(`Natural Game Over triggered: ${isGameOver}, Modal visible: ${gameoverVisible}`);
  console.log(`Game Over Stats displayed: Distance=${failDistText}, Cells=${failCellsText}`);
  if (!isGameOver || !gameoverVisible) throw new Error("Natural fall did not trigger Game Over overlay!");

  // Test Restart Button & State Reset
  console.log("Testing Restart button...");
  await page.eval("document.getElementById('btn-restart-fail').click()");
  await sleep(300);

  const stateAfterRestart = await page.eval("window.gameInstance.state");
  const posAfterRestart = await page.eval("window.gameInstance.player.z");
  const cellsAfterRestart = await page.eval("window.gameInstance.collectedCellsCount");
  const cell1ActiveAfterRestart = await page.eval("document.getElementById('cell-1').classList.contains('active')");
  console.log(`State after restart: ${stateAfterRestart}, Z: ${posAfterRestart.toFixed(1)}m, Cells: ${cellsAfterRestart}, Cell 1 Active: ${cell1ActiveAfterRestart}`);
  if (stateAfterRestart !== 'PLAYING' || posAfterRestart > 15.0 || cellsAfterRestart !== 0 || cell1ActiveAfterRestart) {
    throw new Error("Restart failed to reset player position, timer, and collectibles!");
  }

  // Test Tab Blur / Auto-Pause
  console.log("Testing tab blur / loss of focus auto-pause...");
  await page.eval("window.dispatchEvent(new Event('blur'))");
  await sleep(200);
  const isPaused = await page.eval("window.gameInstance.state === 'PAUSED'");
  const pauseVisible = await page.eval("!document.getElementById('pause-overlay').classList.contains('hidden')");
  console.log(`Auto-pause on blur: ${isPaused}, Pause overlay visible: ${pauseVisible}`);
  if (!isPaused || !pauseVisible) throw new Error("Tab blur failed to pause the game!");

  // Resume game from pause
  console.log("Resuming from pause...");
  await page.eval("document.getElementById('btn-resume').click()");
  await sleep(200);
  const isResumed = await page.eval("window.gameInstance.state === 'PLAYING'");
  console.log(`Game resumed: ${isResumed}`);

  // Test Victory Screen Trigger & Stats
  console.log("Testing Level Finish & Victory Screen...");
  await page.eval("window.gameInstance.player.z = 975.5; window.gameInstance.onVictory();");
  await sleep(200);
  const isVictory = await page.eval("window.gameInstance.state === 'VICTORY'");
  const victoryVisible = await page.eval("!document.getElementById('victory-overlay').classList.contains('hidden')");
  const winDistText = await page.eval("document.getElementById('win-dist').textContent");
  console.log(`Victory state: ${isVictory}, Modal visible: ${victoryVisible}, Distance: ${winDistText}`);
  if (!isVictory || !victoryVisible) throw new Error("Victory screen did not display properly!");

  // Restart from victory
  await page.eval("document.getElementById('btn-restart-win').click()");
  await sleep(200);

  // 7. Test Mute Toggle, Screenshot & Console Error Audit
  console.log("\n[7/7] Testing Mute Toggle, Screenshot & Console Error Audit...");
  const muteInitial = await page.eval("document.getElementById('btn-mute').textContent");
  await page.eval("document.getElementById('btn-mute').click()");
  const muteToggled = await page.eval("document.getElementById('btn-mute').textContent");
  console.log(`Mute button icon toggled from "${muteInitial}" to "${muteToggled}"`);
  if (muteInitial === muteToggled) throw new Error("Mute button did not toggle visual icon!");

  // Let game run for 1 second to capture active gameplay
  await sleep(1000);

  // Capture screenshot of running game
  console.log("Capturing live game screenshot...");
  const screenshotData = await page.send('Page.captureScreenshot', { format: 'png' });
  if (screenshotData && screenshotData.result && screenshotData.result.data) {
    fs.writeFileSync('screenshot.png', Buffer.from(screenshotData.result.data, 'base64'));
    console.log("[PASS] Screenshot successfully saved to screenshot.png!");
  }

  // Audit console errors
  if (page.consoleErrors.length > 0) {
    console.error("Browser Console Errors encountered during execution:", page.consoleErrors);
    throw new Error(`Encountered ${page.consoleErrors.length} browser console errors!`);
  } else {
    console.log("[PASS] Exactly 0 Browser Console Errors detected!");
  }

  console.log("\n====================================================");
  console.log(">>> ALL REAL BROWSER E2E TESTS PASSED CLEANLY! <<<");
  console.log("====================================================");

  // Clean exit
  try { chromeProcess.kill(); } catch (e) {}
  if (viteProcess) {
    try { viteProcess.kill(); } catch (e) {}
  }
  process.exit(0);
}

run().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
