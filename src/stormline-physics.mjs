// The simulation is independent of rendering and runs at a fixed 120 Hz.
export const STEP = 1 / 120;
export const ANCHORS = [
  { id: 0, x: 0, y: 34, z: 55 },
  { id: 1, x: 0, y: 40, z: 151 },
  { id: 2, x: 0, y: 37, z: 246 },
  { id: 3, x: 0, y: 37, z: 344 },
];
export const ROOFS = [
  { id: 0, x: 0, width: 15, start: -22, end: 30, y: 8, name: 'THE DEPARTURE' },
  { id: 1, x: 0, width: 17, start: 83, end: 121, y: 10, name: 'CRANE DISTRICT' },
  { id: 2, x: 0, width: 18, start: 178, end: 215, y: 12, name: 'THE HIGH LINE' },
  { id: 3, x: 0, width: 19, start: 273, end: 311, y: 9, name: 'LAST CONNECTION' },
  { id: 4, x: 0, width: 13, start: 365, end: 451, y: 8, train: true, name: 'THE LAST TRAIN' },
  // The small upper deck rewards releasing at the right height; the main roof below is safer.
  { id: 5, x: 0, width: 8, start: 174, end: 193, y: 18, shortcut: true, name: 'SKY CUT' },
];
export const CELLS = [
  { id: 0, x: 0, y: 12.5, z: 101 },
  { id: 1, x: 0, y: 14.5, z: 194 },
  { id: 2, x: 0, y: 11.5, z: 291 },
];
export function roofAt(roof, time) {
  const shift = roof.train ? time * 1.1 : 0;
  return { ...roof, start: roof.start + shift, end: roof.end + shift };
}
export function createState() {
  return {
    phase: 'ready', t: 0, x: 0, y: 8, z: 0, vx: 0, vy: 0, vz: 16,
    grounded: true, roof: 0, coyote: 0.12, buffer: 0, jumpHeld: false,
    tetherHeld: false, rope: null, cooldown: 0, maxSpeed: 16, bestChain: 0,
    chain: 0, landings: 0, shortcut: false, cells: [], events: [],
    usedAnchors: [], distance: 0, deathReason: '', lastRelease: null,
  };
}
export function begin(s) { if (s.phase === 'ready') s.phase = 'playing'; }
export function jump(s, down = true) {
  if (!down) { s.jumpHeld = false; return; }
  if (s.phase !== 'playing' || s.jumpHeld) return;
  s.jumpHeld = true;
  s.buffer = 0.14;
}
export function tether(s, down) {
  if (s.phase !== 'playing') return;
  s.tetherHeld = down;
  if (!down && s.rope) {
    s.lastRelease = { z: s.z, y: s.y, vz: s.vz, vy: s.vy };
    s.events.push({ type: 'release' });
    s.rope = null;
    s.cooldown = 0.24;
  }
}
export function candidateAnchor(s) {
  if (s.rope || s.cooldown > 0) return null;
  return ANCHORS.find(a => a.z > s.z + 3 && !s.usedAnchors.includes(a.id)
    && Math.hypot(a.x - s.x, a.y - s.y, a.z - s.z) < 46) || null;
}
export function score(s) {
  return Math.round(Math.max(0, s.distance) * 24 + s.cells.length * 1500
    + s.bestChain * 750 + (s.shortcut ? 2400 : 0)
    + (s.phase === 'won' ? Math.max(1000, 20000 - s.t * 360) : 0));
}
export function simulate(s, dt = STEP) {
  if (s.phase !== 'playing') return;
  dt = Math.min(STEP, Math.max(0, dt));
  if (!dt) return;
  s.t += dt;
  s.cooldown = Math.max(0, s.cooldown - dt);
  s.buffer = Math.max(0, s.buffer - dt);
  s.coyote = Math.max(0, s.coyote - dt);
  if (s.tetherHeld && !s.rope) {
    const a = candidateAnchor(s);
    if (a) {
      s.rope = { anchor: a.id, length: Math.hypot(s.x - a.x, s.y - a.y, s.z - a.z) };
      s.usedAnchors.push(a.id);
      if (s.grounded) s.buffer = Math.max(s.buffer, 0.14);
      s.events.push({ type: 'attach', anchor: a.id });
    }
  }
  if (s.buffer > 0 && (s.grounded || s.coyote > 0)) {
    s.vy = 11.8;
    s.grounded = false;
    s.coyote = 0;
    s.buffer = 0;
    s.events.push({ type: 'jump' });
  }
  const oldY = s.y, oldZ = s.z, wasGrounded = s.grounded;
  // The powered line reels in smoothly; position changes only through integration and constraint.
  const targetSpeed = 20;
  s.vz += (s.grounded ? Math.max(0, targetSpeed - s.vz) * 2.4 : 3.6) * dt;
  s.vz = Math.min(s.vz, 44);
  s.vx += (-s.x * 0.8 - s.vx * 2) * dt;
  s.vy -= 27 * dt;
  s.x += s.vx * dt;
  s.y += s.vy * dt;
  s.z += s.vz * dt;
  if (s.rope) {
    const a = ANCHORS[s.rope.anchor];
    s.rope.length = Math.max(23, s.rope.length - 5.5 * dt);
    const dx = s.x - a.x, dy = s.y - a.y, dz = s.z - a.z;
    const d = Math.hypot(dx, dy, dz);
    if (d > s.rope.length) {
      const nx = dx / d, ny = dy / d, nz = dz / d;
      const correction = d - s.rope.length;
      s.x -= nx * correction; s.y -= ny * correction; s.z -= nz * correction;
      const outward = s.vx * nx + s.vy * ny + s.vz * nz;
      if (outward > -5.5) {
        s.vx -= nx * (outward + 5.5);
        s.vy -= ny * (outward + 5.5);
        s.vz -= nz * (outward + 5.5);
      }
    }
  }
  s.grounded = false;
  if (s.vy <= 0) {
    // Highest roof first means the shortcut has real collision above the lower route.
    for (const p of [...ROOFS].sort((a, b) => b.y - a.y)) {
      const r = roofAt(p, s.t);
      if (s.z < r.start - 0.3 || s.z > r.end + 0.1 || Math.abs(s.x - r.x) > r.width / 2) continue;
      if (oldY >= r.y - 0.06 && s.y <= r.y) {
        s.y = r.y; s.vy = 0; s.grounded = true; s.coyote = 0.12;
        if (!wasGrounded && s.roof !== r.id) {
          s.landings++;
          s.chain = s.vz >= 22 ? s.chain + 1 : 0;
          s.bestChain = Math.max(s.bestChain, s.chain);
          if (r.shortcut) s.shortcut = true;
          s.events.push({ type: 'land', clean: s.vz >= 22, shortcut: !!r.shortcut });
        }
        const changedRoof = s.roof !== r.id;
        s.roof = r.id;
        if (s.rope && changedRoof) {
          s.rope = null; s.tetherHeld = false; s.cooldown = 0.2;
        }
        if (r.train && s.z > r.start + 3) {
          s.phase = 'won'; s.events.push({ type: 'won' });
        }
        break;
      }
    }
  }
  if (wasGrounded && !s.grounded && s.vy < 0) s.coyote = 0.12;
  // Sweep collectible pickup in z so fast runs cannot skip through a cell.
  for (const c of CELLS) {
    if (s.cells.includes(c.id)) continue;
    const alpha = Math.abs(s.z - oldZ) > 1e-7 ? Math.max(0, Math.min(1, (c.z - oldZ) / (s.z - oldZ))) : 0;
    const y = oldY + (s.y - oldY) * alpha + 1.1;
    if (c.z >= Math.min(oldZ, s.z) - 1.1 && c.z <= Math.max(oldZ, s.z) + 1.1
      && Math.abs(c.x - s.x) < 2.4 && Math.abs(c.y - y) < 2.4) {
      s.cells.push(c.id); s.events.push({ type: 'cell', id: c.id });
    }
  }
  s.distance = Math.max(s.distance, s.z);
  s.maxSpeed = Math.max(s.maxSpeed, Math.hypot(s.vz, s.vx));
  if (s.y < -20 || s.t > 100 || s.z < -35) {
    s.phase = 'lost';
    s.deathReason = s.rope ? 'Release the line as you swing toward the next roof.' : 'Hold GRAPPLE near the edge, then release above the next roof.';
    s.events.push({ type: 'lost' });
  }
  if (![s.x, s.y, s.z, s.vx, s.vy, s.vz].every(Number.isFinite)) throw new Error('Non-finite Stormline physics state');
}
