import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createCourier, animateCourier } from '../src/stormline-art.js';
import { validateCourierAsset, installCourierAsset } from '../src/stormline-model.js';
import { ANCHORS, createState, begin, jump, tether, simulate, score } from '../src/stormline-physics.mjs';

const bytes=await readFile(new URL('../public/models/courier/courier.glb',import.meta.url));
assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
assert.ok(bytes.length<512*1024,'Courier must remain below 512 KiB');
const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
assert.ok(!(json.images?.length),'Courier should need no image downloads');assert.ok(json.buffers.every(buffer=>!buffer.uri),'GLB must be self-contained');
let triangles=0;for(const mesh of json.meshes)for(const primitive of mesh.primitives){assert.ok(primitive.indices!=null);triangles+=json.accessors[primitive.indices].count/3;}
assert.ok(triangles>1000&&triangles<10000,'Courier triangle budget must remain below 10,000');
console.log(`PASS self-contained GLB: ${bytes.length} bytes, ${triangles} triangles`);
const array=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
const gltf=await new GLTFLoader().parseAsync(array,'');validateCourierAsset(gltf.scene);
const player=createCourier(),ghost=createCourier(true);
installCourierAsset(player,gltf.scene);installCourierAsset(ghost,gltf.scene,true);
const s={phase:'playing',grounded:false,z:30,vz:25,vy:3,rope:{anchor:0}};
animateCourier(player,s,1,.1,{x:0,y:34,z:55});player.updateMatrixWorld(true);
const hand=player.userData.grip.getWorldPosition(new THREE.Vector3());
assert.ok([hand.x,hand.y,hand.z].every(Number.isFinite));assert.ok(hand.y>1,'Grapple hand must reach above the waist');
assert.notEqual(player.userData.rig.arms[1].shoulder,ghost.userData.rig.arms[1].shoulder);
assert.ok(Math.abs(ghost.userData.rig.arms[1].shoulder.rotation.x)<1e-7,'Ghost pose must be independent');
console.log('PASS named joints animate independently and provide a valid grapple grip');
let liveMaterial;player.traverse(object=>{if(object.isMesh&&object!==player.userData.rig.contact)liveMaterial=Array.isArray(object.material)?object.material[0]:object.material;});
assert.equal(liveMaterial.transparent,false);
ghost.traverse(object=>{if(object.isMesh){assert.equal(object.material.transparent,true);assert.equal(object.material.depthWrite,false);}});
console.log('PASS ghost materials do not modify the visible courier');
const fallback=createCourier(),original=fallback.userData.rig.root;
assert.throws(()=>installCourierAsset(fallback,new THREE.Group()),/missing joint/);assert.equal(fallback.userData.rig.root,original);assert.equal(original.parent,fallback);
console.log('PASS invalid model leaves the fallback courier intact');
const run=createState();begin(run);let next=0;
for(let i=0;i<12000&&run.phase==='playing';i++) {
  const a=ANCHORS[next];
  if(a&&!run.rope&&run.z>a.z-35&&!run.tetherHeld){jump(run);jump(run,false);tether(run,true);}
  if(run.rope&&run.z>ANCHORS[run.rope.anchor].z+16){tether(run,false);next++;}
  simulate(run);player.position.set(run.x,run.y,run.z);
  animateCourier(player,run,run.t,1/120,run.rope?ANCHORS[run.rope.anchor]:null);
  player.updateMatrixWorld(true);
  assert.ok(player.userData.grip.getWorldPosition(hand).toArray().every(Number.isFinite));
  run.events=[];
}
assert.equal(run.phase,'won');assert.equal(run.cells.length,3);assert.ok(score(run)>20000);
console.log('PASS exported courier and grip remain valid through a complete four-grapple delivery');
