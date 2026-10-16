import * as THREE from 'three';
import { CONFIG } from '../src/constants.js';
import { PLATFORMS_DATA, CELLS_DATA } from '../src/level.js';
import { sound } from '../src/audio.js';
import { Player } from '../src/player.js';
import { Environment } from '../src/environment.js';
import {
  applyLanding,
  buildResult,
  buildShareText,
  classifyMargin,
  createRun,
  describeLine,
  encodeLine,
  gradeRun,
  parseLine,
  readChallenge,
  totalScore,
} from '../src/score.js';
import { challengeUrl, initialShareStatus, xIntentUrl } from '../src/share.js';

console.log("====================================================");
console.log("   MONSOON ROOFTOPS: GAME LOGIC & PHYSICS TEST SUITE");
console.log("====================================================");

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    testsPassed++;
  } else {
    console.error(`[FAIL] ${message}`);
    testsFailed++;
  }
}

class MockPlayer {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.velY = 0;
    this.velZ = CONFIG.SPEED_FORWARD;
    this.isGrounded = true;
    this.jumpHeld = false;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.jumpCount = 0;
  }

  requestJump() {
    if (this.jumpHeld) return false;
    this.jumpHeld = true;

    if (this.isGrounded || this.coyoteTimer > 0) {
      this.executeJump();
      return true;
    } else {
      this.jumpBufferTimer = CONFIG.JUMP_BUFFER_TIME;
      return false;
    }
  }

  releaseJump() {
    this.jumpHeld = false;
  }

  executeJump() {
    this.velY = CONFIG.JUMP_VELOCITY;
    this.isGrounded = false;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.jumpCount++;
  }

  step(dt, platforms, onFall) {
    dt = Math.min(dt, CONFIG.MAX_FRAME_DELTA);

    if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer -= dt;
      if (this.jumpBufferTimer < 0) this.jumpBufferTimer = 0;
    }

    if (!this.isGrounded && this.coyoteTimer > 0) {
      this.coyoteTimer -= dt;
      if (this.coyoteTimer < 0) this.coyoteTimer = 0;
    }

    const prevY = this.y;
    const prevZ = this.z;
    this.z += this.velZ * dt;
    this.velY += CONFIG.GRAVITY * dt;
    let candidateY = this.y + this.velY * dt;

    let landed = false;
    const playerRadius = CONFIG.PLAYER_RADIUS;

    for (const p of platforms) {
      const halfW = p.width * 0.5;
      const inXBounds = this.x >= p.x - halfW - playerRadius * 0.5 && this.x <= p.x + halfW + playerRadius * 0.5;

      if (inXBounds && candidateY < p.topY - 0.2) {
        const wallZ = p.zStart - playerRadius * 0.35;
        if (this.z >= wallZ && prevZ < p.zStart + 1.0) {
          this.z = wallZ;
          this.velZ = 0;
        }
      }

      if (this.velY <= 0) {
        if (this.z < p.zStart - playerRadius * 0.5 || this.z > p.zEnd) continue;
        if (!inXBounds) continue;

        if (prevY >= p.topY - 0.15 && candidateY <= p.topY + 0.1) {
          candidateY = p.topY;
          this.velY = 0;
          landed = true;
          this.isGrounded = true;
          this.coyoteTimer = CONFIG.COYOTE_TIME;

          if (this.jumpBufferTimer > 0) {
            this.executeJump();
          }
          break;
        }
      }
    }

    if (!landed && this.isGrounded) {
      this.isGrounded = false;
      this.coyoteTimer = CONFIG.COYOTE_TIME;
    }

    this.y = candidateY;
    if (this.y < CONFIG.FALL_LIMIT_Y && onFall) {
      onFall();
    }
  }
}

// ----------------------------------------------------
// Test 1: Holding Jump Button Does NOT Trigger Repeated Jumps
// ----------------------------------------------------
console.log("\n--- Test 1: Jump Input Latching (No Auto-Repeat) ---");
{
  const p = new MockPlayer();
  const j1 = p.requestJump();
  assert(j1 === true && p.jumpCount === 1, "First jump request succeeds");
  
  // Keep holding jump button and simulate 20 frames
  for (let i = 0; i < 20; i++) {
    p.step(0.016, PLATFORMS_DATA);
    const jRepeated = p.requestJump();
    assert(jRepeated === false, `Frame ${i}: Repeated jump blocked while holding`);
  }
  assert(p.jumpCount === 1, "Only 1 jump executed while button held down");

  // Release jump button
  p.releaseJump();
  assert(p.jumpHeld === false, "Jump released properly");
}

// ----------------------------------------------------
// Test 2: Coyote Time
// ----------------------------------------------------
console.log("\n--- Test 2: Coyote Time Mechanics ---");
{
  const p = new MockPlayer();
  p.z = 44.9; // Platform 0 ends at 45.0
  p.y = 0;
  p.step(0.02, PLATFORMS_DATA); // Now at z = 45.3 (> 45.0) => stepped off ledge!
  assert(p.isGrounded === false, "Player leaves platform and becomes airborne");
  assert(p.coyoteTimer > 0, "Coyote timer starts counting down");

  // Jump within coyote window (e.g. 0.05s after ledge)
  p.step(0.05, PLATFORMS_DATA);
  const coyoteJump = p.requestJump();
  assert(coyoteJump === true && p.jumpCount === 1, "Jump within coyote window succeeds");
  assert(p.velY === CONFIG.JUMP_VELOCITY, "Full jump velocity applied during coyote jump");
  p.releaseJump();
}

// ----------------------------------------------------
// Test 3: Coyote Time Expiration
// ----------------------------------------------------
console.log("\n--- Test 3: Coyote Time Expiration ---");
{
  const p = new MockPlayer();
  p.z = 44.9;
  p.step(0.02, PLATFORMS_DATA); // Stepped off ledge at 45.3
  assert(p.isGrounded === false, "Airborne after ledge");
  // Advance until coyote timer expires (CONFIG.COYOTE_TIME = 0.14s)
  p.step(0.05, PLATFORMS_DATA);
  p.step(0.05, PLATFORMS_DATA);
  p.step(0.05, PLATFORMS_DATA);
  assert(p.coyoteTimer === 0, "Coyote timer has expired");
  const lateJump = p.requestJump();
  assert(lateJump === false, "Jump after coyote window does not trigger immediate jump");
  p.releaseJump();
}

// ----------------------------------------------------
// Test 4: Jump Buffer Mechanics
// ----------------------------------------------------
console.log("\n--- Test 4: Jump Buffering Upon Landing ---");
{
  const p = new MockPlayer();
  // Airborne and descending towards platform 1 (topY = 0, zStart = 51.5)
  p.z = 60.0;
  p.y = 0.4;
  p.velY = -8.0;
  p.isGrounded = false;
  p.coyoteTimer = 0;

  // Press jump 0.05s before landing
  p.requestJump();
  assert(p.jumpBufferTimer > 0, "Jump buffer active while falling towards roof");
  p.releaseJump(); // Player released key, buffered jump is queued

  // Simulate falling onto the rooftop: candidateY = 0.4 + (-8 + (-38*0.05))*0.05 = -0.095 <= 0.1
  p.step(0.05, PLATFORMS_DATA); // Lands on roof and automatically executes buffered jump!
  assert(p.jumpCount === 1, "Buffered jump executed upon rooftop landing");
  assert(p.velY === CONFIG.JUMP_VELOCITY, "Buffered jump launched with full jump velocity");
}

// ----------------------------------------------------
// Test 5: Collectibles Single-Collection Per Run & Reset
// ----------------------------------------------------
console.log("\n--- Test 5: Collectibles Single-Collection & Reset ---");
{
  const cellsState = CELLS_DATA.map(c => ({ ...c, isCollected: false }));
  let collectedCount = 0;

  function simulatePickupCheck(playerPos) {
    cellsState.forEach(cell => {
      if (cell.isCollected) return;
      const dx = playerPos.x - cell.x;
      const dy = playerPos.y + 0.9 - cell.y;
      const dz = playerPos.z - cell.z;
      if (dx * dx + dy * dy + dz * dz < 1.4 * 1.4) {
        cell.isCollected = true;
        collectedCount++;
      }
    });
  }

  // Check initial pickup
  simulatePickupCheck({ x: 0, y: 1.0, z: 80.0 });
  assert(collectedCount === 1, "Cell 1 collected on first contact");
  assert(cellsState[0].isCollected === true, "Cell 1 marked as collected");

  // Check second contact at same position in same run
  simulatePickupCheck({ x: 0, y: 1.0, z: 80.0 });
  assert(collectedCount === 1, "Cell 1 cannot be collected again in same run");

  // Reset collectibles
  cellsState.forEach(c => c.isCollected = false);
  collectedCount = 0;
  assert(cellsState.every(c => c.isCollected === false), "Reset restores all collectibles");
}

// ----------------------------------------------------
// Test 6: Full Level Traversal Simulation (Bot Runner)
// ----------------------------------------------------
console.log("\n--- Test 6: Full Level Playthrough Simulation ---");
{
  const runner = new MockPlayer();
  let fell = false;
  let reachedHelipad = false;
  let totalTime = 0;
  const dt = 0.016; // 60 FPS

  const cellsState = CELLS_DATA.map(c => ({ ...c, isCollected: false }));
  let cellsCollected = 0;

  // Intelligent runner bot: taps jump when approaching platform end
  while (totalTime < 65.0 && !fell && !reachedHelipad) {
    totalTime += dt;

    // Check if near the end of current platform
    for (let i = 0; i < PLATFORMS_DATA.length - 1; i++) {
      const plat = PLATFORMS_DATA[i];
      if (runner.z >= plat.zEnd - 2.5 && runner.z <= plat.zEnd && runner.isGrounded) {
        runner.requestJump();
        runner.releaseJump();
        break;
      }
    }

    runner.step(dt, PLATFORMS_DATA, () => {
      fell = true;
    });

    // Check collectible pickup during active run
    cellsState.forEach(cell => {
      if (cell.isCollected) return;
      const dx = runner.x - cell.x;
      const dy = runner.y + 0.9 - cell.y;
      const dz = runner.z - cell.z;
      if (dx * dx + dy * dy + dz * dz < 1.4 * 1.4) {
        cell.isCollected = true;
        cellsCollected++;
      }
    });

    if (runner.z >= CONFIG.FINISH_Z) {
      reachedHelipad = true;
      break;
    }
  }

  assert(!fell, "Runner traversed all gaps without falling");
  assert(reachedHelipad, "Runner successfully reached final Helipad");
  assert(totalTime >= 45.0 && totalTime <= 60.0, `Run time (${totalTime.toFixed(2)}s) within 45-60s requirement`);
  assert(cellsCollected === 5, `All 5 Energy Cells successfully collected along route (${cellsCollected} / 5)`);
  console.log(`Bot Playthrough Completed in: ${totalTime.toFixed(2)}s, Final Z: ${runner.z.toFixed(1)}m, Cells: ${cellsCollected}/5`);
}

// ----------------------------------------------------
// Test 7: Building Wall Collision on Missed Jump
// ----------------------------------------------------
console.log("\n--- Test 7: Building Wall Collision on Missed Jump ---");
{
  const p = new MockPlayer();
  // Player runs off Platform 0 at z = 44.0 without jumping
  p.z = 44.0;
  p.y = 0.0;
  p.velZ = CONFIG.SPEED_FORWARD;

  // Step forward off the edge and fall into gap towards Platform 1 (zStart = 51.5)
  for (let i = 0; i < 35; i++) {
    p.step(0.016, PLATFORMS_DATA);
  }

  // Player should have impacted the wall of Platform 1 and stopped forward velocity
  assert(p.velZ === 0, "Forward velocity stops upon impacting building wall");
  assert(p.z <= 51.5, `Player stopped at building face (z = ${p.z.toFixed(2)}m <= 51.5m)`);
}

// ----------------------------------------------------
// Test 8: Audio Engine Suspend & Resume Methods
// ----------------------------------------------------
console.log("\n--- Test 8: Audio Engine Suspend & Resume Methods ---");
{
  assert(typeof sound.pause === 'function', "SoundEngine has pause method for tab blur");
  assert(typeof sound.resume === 'function', "SoundEngine has resume method for tab focus");
}

// ----------------------------------------------------
// Test 9: Courier score, ranks, and X challenge links
// ----------------------------------------------------
console.log("\n--- Test 9: Courier Score & Challenge Links ---");
{
  assert(classifyMargin(CONFIG.RAZOR_MARGIN) === 'razor', "Landing on the lip edge is a razor");
  assert(classifyMargin(CONFIG.RAZOR_MARGIN + 0.01) === 'steady', "Landing past the gold band is steady");
  assert(classifyMargin(-0.2) === 'razor', "A lip clipped from the near side is still a razor");

  let run = createRun();
  run = applyLanding(run, 'razor');
  run = applyLanding(run, 'razor');
  assert(run.chain === 2 && run.razors === 2, "Two razor gaps raise flow to x2");
  assert(run.landingPoints === 700 + 1400, `Razor points scale with flow (${run.landingPoints})`);

  run = applyLanding(run, 'steady');
  assert(run.steadies === 1 && run.landingPoints === 2100 + 360, "A steady landing pays the smaller flow rate");

  const clear = totalScore({ distance: 1000, cells: 5, landingPoints: 2100, victory: true });
  assert(clear === 975 * 10 + 5 * 2500 + 2100 + 5000, `Clear score clamps distance at the helipad (${clear})`);

  assert(gradeRun({ victory: true, cells: 5, razors: 8 }).rank === 'S+', "Five cells and 8 razors is S+");
  assert(gradeRun({ victory: true, cells: 5, razors: 7 }).rank === 'S', "Five cells without 8 razors stays S");
  assert(gradeRun({ victory: true, cells: 3, razors: 10 }).rank === 'A', "Three cells is rank A");
  assert(gradeRun({ victory: true, cells: 1, razors: 10 }).rank === 'B', "A thin clear is rank B");
  assert(gradeRun({ victory: false, cells: 5, razors: 9 }).rank === 'D', "A fall is rank D even with every cell");

  const victory = buildResult({
    distance: CONFIG.FINISH_Z,
    timeSeconds: 49,
    cells: 5,
    totalCells: 5,
    run: { chain: 15, razors: 9, steadies: 6, landingPoints: 8000 },
    victory: true,
    rival: { score: 20000, cells: 5, razors: 4, rank: 'S' },
    bestScore: 10000,
  });
  assert(victory.rivalBeaten && victory.isNewBest, "Beating a posted line and your best both flag");
  assert(victory.rank === 'S+', `Nine razors and a full clear grade S+ (${victory.rank})`);

  const text = buildShareText(victory);
  assert(text.includes('35,250') && text.includes('Cleared Helipad 01') && text.includes('9 razor') && text.includes('Beat this line'), "Share text carries the score, the clear, the razors, and the dare");
  assert(text.includes('Took the line'), "A beaten rival is named in the post");
  const oneRazor = buildShareText({ ...victory, razors: 1, rival: null });
  assert(oneRazor.includes('1 razor landing') && !oneRazor.includes('landings'), "One razor is singular in the post");

  const encoded = encodeLine(victory);
  assert(parseLine(encoded).rank === 'S+' && parseLine(encoded).score === victory.score, `Line token round-trips (${encoded})`);
  assert(parseLine('nope') === null && parseLine('12.6.1.S') === null, "Broken or impossible lines are ignored");
  assert(readChallenge('?line=18420.5.9.SP').rank === 'S+', "A shared URL opens as an S+ line");
  assert(describeLine(readChallenge('?line=100.2.1.D')).includes('A FALL'), "A posted fall is described as a fall");

  const href = challengeUrl(victory, 'http://localhost:5173/index.html?old=1#top');
  const reopened = readChallenge(new URL(href).search);
  assert(reopened.score === victory.score && reopened.razors === 9 && reopened.rank === 'S+', `Challenge URL reopens the same line (${href})`);

  const intent = xIntentUrl('Beat this line', href);
  assert(intent.startsWith('https://x.com/intent/post?') && intent.includes('url='), "Post opens the X composer with the link");
  assert(initialShareStatus('localhost').includes('hosted'), "Local play says the link needs a host");
  assert(!initialShareStatus('rooftops.example.com').includes('hosted'), "A public host does not warn about localhost");
}

// ----------------------------------------------------
// Test 10: Razor lip is visible, and jump timing earns it
// ----------------------------------------------------
console.log("\n--- Test 10: Razor Lip Placement & Landing Timing ---");
{
  const scene = new THREE.Scene();
  const env = new Environment(scene);
  const lips = [];
  scene.traverse((obj) => {
    if (obj.name === 'razor-lip') lips.push(obj);
  });
  assert(lips.length === PLATFORMS_DATA.length, `Every roof has a gold razor lip (${lips.length})`);
  const firstLip = lips[0];
  const firstPlat = PLATFORMS_DATA[0];
  const lipDepth = firstLip.geometry.parameters.depth;
  assert(Math.abs(lipDepth - CONFIG.RAZOR_MARGIN) < 0.001, `Lip depth matches the score window (${lipDepth})`);
  const expectedZ = firstPlat.zStart + CONFIG.RAZOR_MARGIN * 0.5;
  assert(Math.abs(firstLip.position.z - expectedZ) < 0.001, `Lip sits on the leading edge (z ${firstLip.position.z.toFixed(2)})`);
  assert(firstLip.position.y > firstPlat.topY, "Lip is painted above the roof, not inside the collider");
  env.dispose?.();

  function runGap(jumpAt) {
    const gapScene = new THREE.Scene();
    const player = new Player(gapScene);
    const platforms = [
      { id: 0, x: 0, width: 12, zStart: -5, zEnd: 30, topY: 0 },
      { id: 1, x: 0, width: 12, zStart: 36, zEnd: 90, topY: 0 },
    ];
    const gaps = [];
    let jumped = false;
    for (let i = 0; i < 500 && player.y > -15; i++) {
      if (!jumped && player.z >= jumpAt) {
        player.requestJump();
        jumped = true;
      }
      player.update(1 / 60, platforms, null, (gap) => gaps.push(gap));
      if (gaps.length > 0) break;
    }
    return { jumped, gaps, z: player.z, y: player.y };
  }

  const early = runGap(23.2);
  assert(early.jumped && early.gaps.length === 1, `Early jump reaches the next roof (${early.gaps.length} landings, y ${early.y.toFixed(2)})`);
  if (early.gaps[0]) {
    const kind = classifyMargin(early.gaps[0].margin);
    assert(kind === 'razor', `Jumping early cuts the lip (margin ${early.gaps[0].margin.toFixed(2)}m, ${kind})`);
  }

  const late = runGap(29);
  assert(late.gaps.length === 1, "Jumping at the edge still clears the gap");
  if (late.gaps[0]) {
    const kind = classifyMargin(late.gaps[0].margin);
    assert(kind === 'steady', `Jumping late lands deep and safe (margin ${late.gaps[0].margin.toFixed(2)}m, ${kind})`);
  }

  const hopScene = new THREE.Scene();
  const hopper = new Player(hopScene);
  const oneRoof = [{ id: 0, x: 0, width: 12, zStart: -5, zEnd: 80, topY: 0 }];
  const hops = [];
  let hopped = false;
  for (let i = 0; i < 400 && hopper.z < 40; i++) {
    if (!hopped && hopper.z >= 5) {
      hopper.requestJump();
      hopped = true;
    }
    hopper.update(1 / 60, oneRoof, null, (gap) => hops.push(gap));
  }
  assert(hopped && hops.length === 0 && hopper.y > -1, "A hop on the same roof does not farm razor points");
}

// ----------------------------------------------------
// Summary
// ----------------------------------------------------
console.log("\n====================================================");
console.log(`TEST SUMMARY: ${testsPassed} Passed, ${testsFailed} Failed`);
console.log("====================================================");

if (testsFailed > 0) {
  process.exit(1);
} else {
  console.log(">>> ALL GAME LOGIC & SIMULATION TESTS PASSED! <<<");
}
