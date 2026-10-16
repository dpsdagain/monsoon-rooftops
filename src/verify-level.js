import { PLATFORMS_DATA, CELLS_DATA } from './level.js';
import { CONFIG } from './constants.js';

console.log("=== MONSOON ROOFTOPS: LEVEL & PHYSICS VERIFICATION ===");
console.log(`Forward Speed: ${CONFIG.SPEED_FORWARD} m/s`);
console.log(`Gravity: ${CONFIG.GRAVITY} m/s^2`);
console.log(`Jump Velocity: ${CONFIG.JUMP_VELOCITY} m/s`);
console.log(`Coyote Time: ${CONFIG.COYOTE_TIME} s`);
console.log(`Level Finish Z: ${CONFIG.FINISH_Z} m`);
console.log(`Target Time at Full Speed: ${(CONFIG.FINISH_Z / CONFIG.SPEED_FORWARD).toFixed(2)}s\n`);

let failed = false;

// 1. Verify Platform Order and Gaps
console.log("--- 1. Platform & Gap Analysis ---");
for (let i = 0; i < PLATFORMS_DATA.length - 1; i++) {
  const cur = PLATFORMS_DATA[i];
  const next = PLATFORMS_DATA[i + 1];

  const gapZ = next.zStart - cur.zEnd;
  const dy = next.topY - cur.topY;

  if (gapZ <= 0) {
    console.error(`[FAIL] Platform ${cur.id} and ${next.id} overlap or touch! gap = ${gapZ}`);
    failed = true;
    continue;
  }

  // Calculate max jump reach from cur to next:
  // Equation for vertical motion: y(t) = cur.topY + V_jump * t + 0.5 * g * t^2
  // We want y(t) = next.topY => 0.5 * g * t^2 + V_jump * t - dy = 0
  // a = 0.5 * g, b = V_jump, c = -dy
  const a = 0.5 * CONFIG.GRAVITY;
  const b = CONFIG.JUMP_VELOCITY;
  const c = -dy;

  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) {
    console.error(`[FAIL] Gap ${cur.id} -> ${next.id}: Apex cannot reach height dy = ${dy}`);
    failed = true;
    continue;
  }

  // Larger root of quadratic (landing on descent)
  const tLanding = (-b - Math.sqrt(discriminant)) / (2 * a);
  const maxAirDistance = CONFIG.SPEED_FORWARD * tLanding;
  
  // Extra reach enabled by coyote time
  const coyoteBonusDist = CONFIG.SPEED_FORWARD * CONFIG.COYOTE_TIME;
  const totalMaxJumpReach = maxAirDistance + coyoteBonusDist;

  // Margin of safety: how much extra horizontal distance the player has after clearing the gap
  const safetyMargin = maxAirDistance - gapZ;

  console.log(
    `Gap ${cur.id} -> ${next.id} [${cur.name.substring(0, 14)}... -> ${next.name.substring(0, 14)}...]: ` +
    `Gap = ${gapZ.toFixed(2)}m, dy = ${dy >= 0 ? '+' : ''}${dy.toFixed(2)}m | ` +
    `Max Jump Reach = ${maxAirDistance.toFixed(2)}m (with coyote: ${totalMaxJumpReach.toFixed(2)}m) | ` +
    `Margin = +${safetyMargin.toFixed(2)}m [${safetyMargin >= 1.5 ? 'OK' : 'TIGHT'}]`
  );

  if (safetyMargin < 1.0) {
    console.error(`[FAIL] Safety margin too small (< 1.0m)! Player might fail jump!`);
    failed = true;
  }
}

// 2. Verify Collectibles
console.log("\n--- 2. Collectibles Placement & Clearance ---");
console.log(`Total Collectibles: ${CELLS_DATA.length} (Expected: ${CONFIG.TOTAL_CELLS})`);
if (CELLS_DATA.length !== CONFIG.TOTAL_CELLS) {
  console.error(`[FAIL] Collectibles count is ${CELLS_DATA.length}, expected ${CONFIG.TOTAL_CELLS}`);
  failed = true;
}

CELLS_DATA.forEach((cell, idx) => {
  // Find which platform or gap this cell is on
  let location = "In gap";
  let surfaceY = 0;
  for (const plat of PLATFORMS_DATA) {
    if (cell.z >= plat.zStart && cell.z <= plat.zEnd) {
      location = `On Platform ${plat.id} (${plat.name})`;
      surfaceY = plat.topY;
      break;
    }
  }
  const heightAboveSurface = cell.y - surfaceY;
  console.log(`Cell ${cell.id} (${cell.name}) at Z=${cell.z}, Y=${cell.y} | ${location} (height rel: +${heightAboveSurface.toFixed(2)}m)`);
  if (cell.z < 0 || cell.z > CONFIG.FINISH_Z) {
    console.error(`[FAIL] Cell ${cell.id} out of route bounds!`);
    failed = true;
  }
});

// 3. Verify Route Timing
const estimatedTime = CONFIG.FINISH_Z / CONFIG.SPEED_FORWARD;
console.log(`\n--- 3. Route Duration ---`);
console.log(`Estimated run duration: ${estimatedTime.toFixed(1)} seconds`);
if (estimatedTime < 45 || estimatedTime > 60) {
  console.error(`[FAIL] Duration ${estimatedTime.toFixed(1)}s is not in target range [45, 60] seconds!`);
  failed = true;
} else {
  console.log(`[PASS] Duration is in target 45-60s window.`);
}

if (failed) {
  console.error("\n>>> VERIFICATION FAILED! Please fix parameters. <<<");
  process.exit(1);
} else {
  console.log("\n>>> ALL LEVEL & PHYSICS CHECKS PASSED! <<<");
}
