import { CONFIG } from '../src/constants.js';
import { PLATFORMS_DATA, CELLS_DATA } from '../src/level.js';
import { sound } from '../src/audio.js';

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
