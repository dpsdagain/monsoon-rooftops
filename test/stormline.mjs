import assert from 'node:assert/strict';
import { STEP, ANCHORS, ROOFS, CELLS, createState, begin, jump, tether, simulate, candidateAnchor, roofAt, score } from '../src/stormline-physics.mjs';

let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`PASS ${name}`); }
function run(releaseOffset = 16) {
  const s = createState(); begin(s); let next = 0; const log = [];
  for (let i=0;i<12000 && s.phase==='playing';i++) {
    const a = ANCHORS[next];
    if(a&&!s.rope&&s.z>a.z-35&&!s.tetherHeld){jump(s);jump(s,false);tether(s,true);}
    if(s.rope&&s.z>ANCHORS[s.rope.anchor].z+releaseOffset){tether(s,false);next++;}
    simulate(s); log.push(...s.events); s.events=[];
    if(s.rope){const a=ANCHORS[s.rope.anchor];assert.ok(Math.hypot(s.x-a.x,s.y-a.y,s.z-a.z)<=s.rope.length+.001,'rope must never stretch beyond its constraint');}
  }
  return { s, log };
}
test('a complete run reaches the moving train and collects all three cells',()=>{
  const {s,log}=run();assert.equal(s.phase,'won');assert.equal(s.cells.length,3);assert.equal(new Set(s.cells).size,3);assert.equal(log.filter(e=>e.type==='attach').length,4);assert.equal(log.filter(e=>e.type==='won').length,1);assert.ok(s.t<30);assert.ok(score(s)>20000);
});
test('later releases can take the upper optional landing route',()=>{
  const {s,log}=run(19);assert.equal(s.phase,'won');assert.equal(s.shortcut,true);assert.ok(log.some(e=>e.type==='land'&&e.shortcut));
});
test('an early-release run fails instead of being auto-completed',()=>{assert.equal(run(13).s.phase,'lost');});
test('without inputs the courier falls into the flood',()=>{
  const s=createState();begin(s);for(let i=0;i<2000&&s.phase==='playing';i++)simulate(s);assert.equal(s.phase,'lost');assert.ok(s.z<100);
});
test('jump only fires once until released',()=>{
  const s=createState();begin(s);jump(s);simulate(s);const count=s.events.filter(e=>e.type==='jump').length;for(let i=0;i<10;i++){jump(s);simulate(s);}assert.equal(s.events.filter(e=>e.type==='jump').length,count);assert.equal(count,1);
});
test('releasing a tether preserves velocity and position without a launch teleport',()=>{
  const s=createState();begin(s);s.z=25;tether(s,true);simulate(s);assert.ok(s.rope);const snapshot=[s.x,s.y,s.z,s.vx,s.vy,s.vz];tether(s,false);assert.equal(s.rope,null);assert.deepEqual([s.x,s.y,s.z,s.vx,s.vy,s.vz],snapshot);
});
test('menus and pauses freeze simulation and reject movement inputs',()=>{
  const s=createState();jump(s);tether(s,true);simulate(s);assert.equal(s.t,0);assert.equal(s.rope,null);begin(s);s.phase='paused';const before=JSON.stringify(s);jump(s);tether(s,true);simulate(s);assert.equal(JSON.stringify(s),before);
});
test('a fresh run resets progress, momentum history, rope and collected cells',()=>{
  const {s}=run();assert.equal(s.phase,'won');const fresh=createState();assert.equal(fresh.phase,'ready');assert.equal(fresh.z,0);assert.equal(fresh.t,0);assert.equal(fresh.rope,null);assert.deepEqual(fresh.cells,[]);assert.deepEqual(fresh.usedAnchors,[]);assert.equal(fresh.shortcut,false);
});
test('the moving landing platform has a consistent physical displacement',()=>{
  const train=ROOFS.find(r=>r.train);assert.equal(roofAt(train,10).start,train.start+11);assert.equal(roofAt(train,20).end,train.end+22);assert.equal(roofAt(ROOFS[0],20).start,ROOFS[0].start);
});
test('fixed-step runs are repeatable and finish states cannot award extra pickups',()=>{
  const a=run().s,b=run().s;assert.deepEqual(a,b);const before=JSON.stringify(a);simulate(a);assert.equal(JSON.stringify(a),before);
});
test('cell pickups cannot repeat across consecutive grounded frames',()=>{
  const s=createState();begin(s);s.z=CELLS[0].z;s.y=10;s.roof=1;s.grounded=true;for(let i=0;i<20;i++)simulate(s);assert.equal(s.cells.filter(id=>id===0).length,1);
});
test('unreachable anchors cannot attach and a zero step changes nothing',()=>{
  const s=createState();begin(s);s.x=500;tether(s,true);assert.equal(candidateAnchor(s),null);simulate(s);assert.equal(s.rope,null);const before=JSON.stringify(s);simulate(s,0);assert.equal(JSON.stringify(s),before);
});
console.log(`\n${passed} Stormline simulation tests passed.`);
