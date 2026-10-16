import * as THREE from 'three';
import { STEP, ANCHORS, ROOFS, CELLS, createState, begin, jump, tether, simulate, candidateAnchor, roofAt, score } from './stormline-physics.mjs';
import './stormline.css';
import { buildStormCity, createCourier, animateCourier, batchStaticMeshes } from './stormline-art.js';
import { loadCourierAsset, installCourierAsset } from './stormline-model.js';

const C = { sky: 0x1b3944, fog: 0x315454, roof: 0x66817c, wall: 0x30494b, dark: 0x172f35, acid: 0xd3ff7a, orange: 0xff9463, paper: 0xfaf6e8, crane: 0xd5a058 };
const KEY = 'monsoon-stormline-best-v1';
const safeRead = () => { try { const b = JSON.parse(localStorage.getItem(KEY)); return b && Number.isFinite(b.score) && Array.isArray(b.frames) && b.frames.length > 1 && b.frames.length < 6000 && b.frames.every(f => ['t','x','y','z'].every(k => Number.isFinite(f[k]))) ? b : null; } catch { return null; } };
const clock = t => `${Math.floor(t / 60).toString().padStart(2,'0')}:${(t % 60).toFixed(2).padStart(5,'0')}`;
const fmt = n => Math.round(n).toLocaleString();
const mat = (color, roughness = .72, metalness = .14) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const glow = color => new THREE.MeshBasicMaterial({ color });
const clamp = THREE.MathUtils.clamp;
const unitBox = new THREE.BoxGeometry(1,1,1);
const unitBar = new THREE.CylinderGeometry(1,1,1,7);

class Audio {
  constructor() { this.ctx = null; this.muted = false; try { this.muted = localStorage.getItem('stormline-muted') === 'true'; } catch {} }
  init() {
    try {
      if (this.ctx) { this.ctx.resume().catch(() => {}); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : .25; this.master.connect(this.ctx.destination);
      const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
      const data = buffer.getChannelData(0); let previous = 0;
      for (let i=0;i<data.length;i++) { previous = (previous + (Math.random() * 2 - 1) * .035) / 1.035; data[i] = previous; }
      this.wind = this.ctx.createBufferSource(); this.wind.buffer = buffer; this.wind.loop = true;
      this.filter = this.ctx.createBiquadFilter(); this.filter.type = 'lowpass'; this.filter.frequency.value = 300;
      this.windGain = this.ctx.createGain(); this.windGain.gain.value = .15;
      this.wind.connect(this.filter); this.filter.connect(this.windGain); this.windGain.connect(this.master); this.wind.start();
    } catch { this.ctx = null; }
  }
  play(type) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const values = { attach:[180,700,.12], release:[720,150,.16], jump:[220,420,.13], land:[100,40,.12], cell:[600,1100,.2], won:[480,960,.6], lost:[180,55,.4] }[type];
    if (!values) return;
    const [from,to,duration] = values, t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator(), gain = this.ctx.createGain(); osc.type = type === 'land' ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(from,t); osc.frequency.exponentialRampToValueAtTime(to,t+duration);
    gain.gain.setValueAtTime(.001,t); gain.gain.exponentialRampToValueAtTime(.4,t+.01); gain.gain.exponentialRampToValueAtTime(.001,t+duration);
    osc.connect(gain); gain.connect(this.master); osc.start(t); osc.stop(t+duration+.02);
  }
  update(speed, active) {
    if (!this.ctx) return;
    this.windGain.gain.setTargetAtTime(active ? .15 + speed / 80 : .08,this.ctx.currentTime,.2);
    this.filter.frequency.setTargetAtTime(250 + speed * 24,this.ctx.currentTime,.15);
  }
  mute() { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : .25; try { localStorage.setItem('stormline-muted',String(this.muted)); } catch {} }
}

export class StormlineGame {
  constructor() {
    document.body.classList.add('stormline-mode');
    document.title = 'Stormline — Monsoon Rooftops';
    document.querySelector('meta[name="description"]')?.setAttribute('content','Jump. Hold the line. Release into the monsoon. A playable rooftop grapple run through Neo-Mumbai.');
    this.root = document.createElement('div'); this.root.id = 'stormline-app';
    this.polished = new URLSearchParams(location.search).get('art') !== 'plain';
    this.root.dataset.art = this.polished ? 'city' : 'plain';
    this.root.innerHTML = `
      <div id="stormline-stage"></div><div class="sl-grain"></div>
      <header class="sl-top"><div class="sl-brand"><div class="sl-mark">↗</div><div class="sl-wordmark">MONSOON ROOFTOPS<small>STORMLINE / NEO-MUMBAI 2088</small></div></div>
      <div class="sl-tools"><button class="sl-tool" id="sl-sound" aria-label="Toggle sound">SOUND ON</button><button class="sl-tool" id="sl-pause" aria-label="Pause game">Ⅱ</button><button class="sl-tool" id="sl-retry" aria-label="Restart run">↻</button></div></header>
      <div class="sl-route"><div class="sl-route-head"><span>COLABA → THE LAST TRAIN</span><span id="sl-progress-label">DELIVERY 01</span></div><div class="sl-route-track"><div class="sl-route-fill" id="sl-progress"></div></div><div class="sl-route-dots"><i></i><i></i><i></i><i></i><i></i></div></div>
      <div class="sl-readout"><div class="sl-kicker" id="sl-phase-label">A CITY BETWEEN STORMS</div><div class="sl-objective" id="sl-objective">Make the last connection.</div><div class="sl-hint" id="sl-hint">Four lines. One delivery. Find your flow.</div></div>
      <div class="sl-reticle" id="sl-reticle"><div class="sl-reticle-ring"></div><span class="sl-reticle-label" id="sl-reticle-label">HOLD TO GRAPPLE</span></div>
      <div class="sl-toast" id="sl-toast"><strong id="sl-toast-title"></strong><span id="sl-toast-sub"></span></div>
      <div class="sl-bottom"><div><div class="sl-stat-label">VELOCITY</div><div class="sl-speed"><b id="sl-speed">0</b><span>KM/H</span></div></div><div><div class="sl-stat-label">RUN TIME</div><div class="sl-time" id="sl-time">00:00.00</div><div class="sl-cells" id="sl-cells" aria-label="0 of 3 energy cells"><i></i><i></i><i></i></div></div></div>
      <div class="sl-controls"><button class="sl-action" id="sl-jump" aria-label="Jump">JUMP<small>SPACE / TAP</small></button><button class="sl-action grapple" id="sl-grapple" aria-label="Hold to grapple, release to launch">HOLD GRAPPLE<small>E / HOLD MOUSE · RELEASE TO LAUNCH</small></button></div>
      <section class="sl-overlay" id="sl-overlay" aria-label="Game menu"><div class="sl-panel" id="sl-panel"></div></section>`;
    document.body.replaceChildren(this.root);
    this.ui = id => document.getElementById(`sl-${id}`);
    this.s = createState(); this.best = safeRead(); this.frames = []; this.lastSample = 0;
    this.audio = new Audio(); this.toastTime = 0; this.accumulator = 0; this.previous = null; this.visualTime = 0;
    this.landing = 0; this.gripPosition = new THREE.Vector3();
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(C.sky); this.scene.fog = new THREE.FogExp2(C.fog,.0047);
    this.camera = new THREE.PerspectiveCamera(58,innerWidth/innerHeight,.15,1200);
    try { this.renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:'high-performance' }); }
    catch { this.root.innerHTML = '<div class="sl-error">This device could not start WebGL. Try a current browser with hardware acceleration enabled.</div>'; return; }
    this.renderer.setSize(innerWidth,innerHeight); this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1,1.6));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = this.polished ? 1.08 : 1.25;
    document.getElementById('stormline-stage').append(this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight(0xb5d5d1,0x20303a,this.polished?1.8:2.6));
    const sunlight = new THREE.DirectionalLight(0xffd1a7,this.polished?2.7:3); sunlight.position.set(-65,90,40); this.scene.add(sunlight);
    const fill = new THREE.DirectionalLight(0x80c0cc,this.polished?1.05:1.3); fill.position.set(40,25,-30); this.scene.add(fill);
    this.buildWorld(); this.player = this.courier(); this.scene.add(this.player);
    this.ghost = this.courier(true); this.scene.add(this.ghost); this.ghost.visible = false;
    if(this.polished) {
      this.root.dataset.courierModel='loading';
      loadCourierAsset().then(asset=>{
        installCourierAsset(this.player,asset);
        installCourierAsset(this.ghost,asset,true);
        this.root.dataset.courierModel='blender';
      }).catch(()=>{this.root.dataset.courierModel='fallback';});
    } else this.root.dataset.courierModel='procedural';
    this.rope = this.bar(new THREE.Vector3(),new THREE.Vector3(0,1,0),.065,glow(C.acid)); this.rope.visible = false;
    this.camera.position.set(34,29,-31); this.look = new THREE.Vector3(0,17,37); this.camera.lookAt(this.look);
    this.setupInput(); this.showMenu('ready'); this.updateUI(); this.updateSoundButton();
    this.frame = this.frame.bind(this); this.frameID = requestAnimationFrame(this.frame);
  }
  box(parent,w,h,d,x,y,z,material) {
    const m = new THREE.Mesh(unitBox,material); m.scale.set(w,h,d); m.position.set(x,y,z); parent.add(m); return m;
  }
  bar(a,b,r,material,parent=this.scene) {
    const m = new THREE.Mesh(unitBar,material); m.userData.radius=r; parent.add(m); this.setBar(m,a,b); return m;
  }
  setBar(m,a,b) { const diff = new THREE.Vector3().subVectors(b,a); m.position.copy(a).add(b).multiplyScalar(.5); m.scale.set(m.userData.radius,Math.max(.001,diff.length()),m.userData.radius); m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),diff.normalize()); }
  sign(parent,text,x,y,z,width=8,color='#d3ff7a',background='#1b383b') {
    const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 192;
    const ctx=canvas.getContext('2d'); ctx.fillStyle=background; ctx.fillRect(0,0,768,192); ctx.strokeStyle=color; ctx.lineWidth=5; ctx.strokeRect(12,12,744,168);
    ctx.fillStyle=color; ctx.font='bold 76px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(text,384,103,710);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width,width/4),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide})); mesh.position.set(x,y,z); mesh.rotation.y=Math.PI; parent.add(mesh); return mesh;
  }
  buildWorld() {
    const wall=mat(C.wall), roof=mat(C.roof,.45,.22), lip=mat(0xb1b6a0), dark=mat(C.dark), orange=mat(C.orange), acid=glow(C.acid);
    const flowArt = this.polished;
    const flowSurfaces = [];
    this.root.dataset.flowTexture = flowArt ? 'loading' : 'off';
    this.train = new THREE.Group(); this.scene.add(this.train); this.roofMeshes=[];
    for (const r of ROOFS) {
      const group = r.train ? this.train : new THREE.Group(); if (!r.train) this.scene.add(group);
      const height=r.train?5:r.shortcut?1.2:r.y+25;
      const z=(r.start+r.end)/2;
      this.box(group,r.width,height,r.end-r.start,r.x,r.y-height/2,z,r.train?mat(0x3b625a,.3,.6):wall);
      const roofTop = flowArt && !r.train ? roof.clone() : roof;
      const roofMaterial = flowArt && !r.train ? [roof,roof,roofTop,roof,roof,roof] : roof;
      this.box(group,r.width+.3,.4,r.end-r.start+.2,0,r.y-.1,z,roofMaterial);
      if (flowArt && !r.train) flowSurfaces.push({material:roofTop,width:r.width+.3,depth:r.end-r.start+.2});
      this.box(group,r.width,.12,.45,0,r.y+.14,r.start+.2,acid);
      this.box(group,r.width,.12,.45,0,r.y+.14,r.end-.3,orange);
      for (const x of [-r.width/2,r.width/2]) {
        this.box(group,.18,.3,r.end-r.start,x,r.y+.1,z,lip);
        if (!r.shortcut) for(let k=0;k<4;k++) this.box(group,.3,2,.3,x,r.y-2,r.start+k*(r.end-r.start)/4,orange);
      }
      if (r.train) {
        for(let q=0;q<3;q++) {
          const carZ=r.start+14+q*28;
          for(const x of [-6.57,6.57]) for(let k=0;k<7;k++) this.box(group,.08,1.5,1.6,x,5.5,carZ-10+k*3,glow(0xffd9a0));
          this.box(group,4,1,5,0,9,carZ,mat(0x789c8b));
          this.box(group,13.3,.14,.8,0,8.3,carZ+13,acid);
        }
        this.sign(group,'LAST TRAIN / 01',0,6.2,r.start-.15,10);
      } else if (r.shortcut) {
        this.sign(group,'SKY CUT',0,r.y+2,r.start,7);
        for(const x of [-4,4]) this.box(group,.3,36,.3,x,0,z,mat(C.crane));
      } else if (!this.polished) {
        for(const side of [-1,1]) {
          for(let i=0;i<3;i++) {
            const tank=new THREE.Mesh(new THREE.CylinderGeometry(1.5,1.65,2.7,12),dark);
            tank.position.set(side*(r.width/2-2),r.y+1.6,r.start+10+i*9); group.add(tank);
            this.box(group,2.5,.35,2.5,side*(r.width/2-2),r.y+.25,r.start+10+i*9,lip);
          }
          for(let k=0;k<6;k++) {
            this.box(group,.1,1.6,.1,side*(r.width/2+.1),r.y+1,r.start+5+k*5,dark);
          }
          this.box(group,.1,.1,r.end-r.start-5,side*(r.width/2+.1),r.y+1.8,z,dark);
        }
        this.sign(group,r.id===0?'COLABA / DEPARTURE':`SECTOR 0${r.id+1}`,0,r.y-3.2,r.start-.1,r.width-2,'#f5d7a3');
        for(let k=0;k<Math.floor((r.end-r.start)/4);k++) this.box(group,.12,.025,1.6,0,r.y+.13,r.start+2+k*4,mat(0xe7e1bf));
        // Layered apartment facade windows.
        for(let row=0;row<5;row++) for(let col=0;col<5;col++) {
          if ((row+col+r.id)%4===0) continue;
          this.box(group,.75,1.3,.06,-r.width/2+1.2+col*(r.width-2)/5,r.y-5-row*3,r.start-.04,glow((row+col)%3?0xcba96d:0x7ba6a0));
        }
      }
      this.roofMeshes.push(group);
    }
    if (flowArt) {
      new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}art/nano-banana/rooftop-concrete.jpg`, source => {
        source.colorSpace = THREE.SRGBColorSpace;
        for (const surface of flowSurfaces) {
          const texture = source.clone();
          texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
          texture.repeat.set(surface.width / 12, surface.depth / 12);
          texture.anisotropy = Math.min(4,this.renderer.capabilities.getMaxAnisotropy());
          texture.needsUpdate = true;
          surface.material.map = texture;
          surface.material.color.set(0xffffff);
          surface.material.roughness = .84;
          surface.material.metalness = .04;
          surface.material.needsUpdate = true;
        }
        source.dispose();
        this.root.dataset.flowTexture = 'ready';
      }, undefined, () => { this.root.dataset.flowTexture = 'failed'; });
    }
    this.anchorGroups=[];
    const steel=mat(C.crane,.5,.45), brace=mat(0x5b6860), cable=mat(0x667c74);
    for(const a of ANCHORS) {
      const crane=new THREE.Group(); this.scene.add(crane);
      const towerX=a.id%2===0?-19:19, towerBase=-16;
      for(const x of [towerX-1.2,towerX+1.2]) for(const z of [a.z-1.2,a.z+1.2]) this.box(crane,.4,a.y-towerBase,.4,x,(a.y+towerBase)/2,z,steel);
      for(let y=towerBase;y<a.y;y+=5) {
        this.box(crane,2.9,.25,2.9,towerX,y,a.z,steel);
        this.bar(new THREE.Vector3(towerX-1.2,y,a.z-1.2),new THREE.Vector3(towerX+1.2,y+4.7,a.z-1.2),.09,brace,crane);
        this.bar(new THREE.Vector3(towerX+1.2,y,a.z+1.2),new THREE.Vector3(towerX-1.2,y+4.7,a.z+1.2),.09,brace,crane);
      }
      this.box(crane,Math.abs(towerX)+8,1.3,2.2,towerX/2,a.y+5,a.z,steel);
      for(let i=0;i<6;i++) this.box(crane,.35,2,2.5,towerX*(i/6),a.y+5,a.z,steel);
      this.bar(new THREE.Vector3(towerX,a.y+13,a.z),new THREE.Vector3(0,a.y+5,a.z),.1,cable,crane);
      this.box(crane,.4,10,.4,towerX,a.y+8,a.z,steel);
      this.bar(new THREE.Vector3(0,a.y+5,a.z),new THREE.Vector3(0,a.y,a.z),.09,cable,crane);
      const orb=new THREE.Group(); orb.position.set(a.x,a.y,a.z);
      const ring=new THREE.Mesh(new THREE.TorusGeometry(.9,.13,8,28),acid); orb.add(ring);
      const core=new THREE.Mesh(new THREE.OctahedronGeometry(.48),glow(C.paper)); orb.add(core);
      const frame=new THREE.Mesh(new THREE.TorusGeometry(1.65,.035,5,32),glow(0x8fbeb2)); orb.add(frame);
      if(this.polished) {
        core.visible=false;
        this.box(orb,.8,.9,.55,0,.35,0,mat(0xc6b746,.4,.5));
        this.box(orb,.16,.6,.18,0,-.3,0,acid);
        const hook=new THREE.Mesh(new THREE.TorusGeometry(.35,.095,6,16,Math.PI*1.55),acid);hook.rotation.z=-Math.PI*.95;hook.position.set(.1,-.72,0);orb.add(hook);
      }
      const light=new THREE.PointLight(C.acid,12,10,2); orb.add(light); this.scene.add(orb);
      this.anchorGroups.push(orb);
    }
    if(this.polished) {
      this.art=buildStormCity(this.scene,ROOFS,this.roofMeshes,this.train);
      this.root.dataset.architectureInstances=String(this.art.stats.architectureInstances);
    } else {
    // The previous visual prototype is retained for comparison.
    let seed=421; const rand=()=>{seed=(seed*1664525+1013904223)>>>0; return seed/4294967296;};
    const windowGeo=new THREE.BoxGeometry(1.05,1.55,.06);
    const windows=new THREE.InstancedMesh(windowGeo,glow(0xc2a779),2400); let wi=0; const dummy=new THREE.Object3D();
    for(let i=0;i<100;i++) {
      const side=i%2?1:-1, x=side*(48+rand()*110), z=-80+rand()*700, h=16+rand()*100, w=7+rand()*16,d=8+rand()*15;
      this.box(this.scene,w,h,d,x,-26+h/2,z,mat(new THREE.Color().setHSL(.47+rand()*.04,.12,.15+rand()*.1)));
      this.box(this.scene,w+.5,.4,d+.5,x,-26+h,z,mat(0x55736e));
      for(let row=0;row<Math.min(11,h/4);row++) for(let col=0;col<4;col++) {
        if(rand()<.33||wi>=2400) continue;
        dummy.position.set(x-w/2+1.5+col*(w-2)/4,-24+row*4,z-d/2-.05); dummy.updateMatrix(); windows.setMatrixAt(wi++,dummy.matrix);
      }
      if(i%8===0) this.sign(this.scene,['चाय','मुंबई','OPEN LATE','जल सेवा'][i%4],x,-23+h*.8,z-d/2-.12,Math.min(w,12),i%16?'#f3c88c':'#d3ff7a');
    }
    windows.count=wi; windows.instanceMatrix.needsUpdate=true; this.scene.add(windows);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(3000,3000),mat(0x274c50,.23,.65)); water.rotation.x=-Math.PI/2; water.position.set(0,-21,200); this.scene.add(water);
    const waterMarks=new THREE.Group();
    for(let i=0;i<120;i++) this.box(waterMarks,.08+rand()*.8,.012,2+rand()*18,(rand()-.5)*240,-20.97,rand()*650,glow(i%3?0x436565:0x8e8a65));
    this.scene.add(waterMarks);
    const sun=new THREE.Mesh(new THREE.SphereGeometry(29,24,16),glow(0xe2b68a)); sun.position.set(-130,68,650); this.scene.add(sun);
    for(const x of [-13,13]) this.box(this.scene,.35,.5,550,x,-4,230,mat(0x77918a));
    }
    // A few cables and cloths add scale without cluttering the landing surfaces.
    for(let z=90;!this.polished&&z<320;z+=95) {
      this.bar(new THREE.Vector3(-13,16,z),new THREE.Vector3(13,17,z+4),.045,dark);
      for(let i=0;i<5;i++) this.box(this.scene,1.2,1.8,.06,-10+i*3,15.3,z+1+i*.3,mat([0xc39a6a,0x8da79e,0xbcb19a][i%3]));
    }
    this.cellMeshes=CELLS.map(c=>{
      const g=new THREE.Group(); g.position.set(c.x,c.y,c.z);
      const core=new THREE.Mesh(new THREE.OctahedronGeometry(.65),glow(C.acid)); g.add(core);
      const ring=new THREE.Mesh(new THREE.TorusGeometry(1.08,.04,5,24),glow(C.paper)); g.add(ring); this.scene.add(g); return g;
    });
    const rainCount=750, rain=new Float32Array(rainCount*6);
    for(let i=0;i<rainCount;i++){const x=(Math.random()-.5)*120,y=Math.random()*75,z=(Math.random()-.5)*160;rain.set([x,y,z,x-.35,y-1.4,z+.1],i*6);}
    this.rainGeometry=new THREE.BufferGeometry(); this.rainGeometry.setAttribute('position',new THREE.BufferAttribute(rain,3));
    this.rain=new THREE.LineSegments(this.rainGeometry,new THREE.LineBasicMaterial({color:0xb4d4d1,transparent:true,opacity:.22}));this.rain.frustumCulled=false;this.scene.add(this.rain);
    if(this.polished)this.root.dataset.savedDrawCalls=String(batchStaticMeshes(this.scene,[this.train,...this.anchorGroups]));
  }
  courier(ghost=false) {
    if(this.polished)return createCourier(ghost);
    const g=new THREE.Group(), jacket=ghost?new THREE.MeshBasicMaterial({color:C.acid,transparent:true,opacity:.18,depthWrite:false}):mat(0xe5b78b,.66), black=ghost?jacket:mat(0x1b3035), bright=ghost?jacket:glow(C.acid);
    const body=new THREE.Mesh(new THREE.CapsuleGeometry(.39,.65,4,8),jacket);body.position.y=1.25;g.add(body);
    this.box(g,.55,.5,.53,0,1.99,.04,black);this.box(g,.48,.1,.06,0,2.02,.325,bright);
    this.box(g,.55,.66,.3,0,1.3,-.36,black);this.box(g,.12,.48,.03,0,1.3,-.53,bright);
    const limbs=[];
    for(const x of [-.23,.23]) {
      const leg=new THREE.Group();leg.position.set(x,.9,0);this.box(leg,.2,.75,.23,0,-.36,0,black);this.box(leg,.25,.15,.42,0,-.73,.08,black);g.add(leg);limbs.push(leg);
      const arm=new THREE.Group();arm.position.set(x*2,1.55,0);this.box(arm,.18,.63,.21,0,-.29,0,jacket);g.add(arm);limbs.push(arm);
    }
    const scarf=this.box(g,.19,.12,1.2,-.25,1.85,-.78,ghost?jacket:mat(C.orange)); scarf.rotation.x=-.2;
    g.userData={limbs,scarf};return g;
  }
  setupInput() {
    this.ui('jump').addEventListener('pointerdown',e=>{e.preventDefault();jump(this.s);e.currentTarget.setPointerCapture?.(e.pointerId);});
    this.ui('grapple').addEventListener('pointerdown',e=>{e.preventDefault();tether(this.s,true);e.currentTarget.setPointerCapture?.(e.pointerId);});
    const release=()=>{jump(this.s,false);tether(this.s,false);};
    this.ui('jump').addEventListener('pointerup',()=>jump(this.s,false));
    this.ui('grapple').addEventListener('pointerup',()=>tether(this.s,false));
    window.addEventListener('pointerup',release);window.addEventListener('pointercancel',release);
    const canvas=this.renderer.domElement;canvas.addEventListener('pointerdown',e=>{if(e.button===0&&this.s.phase==='playing'){e.preventDefault();tether(this.s,true);canvas.setPointerCapture?.(e.pointerId);}});
    canvas.addEventListener('contextmenu',e=>e.preventDefault());
    window.addEventListener('keydown',e=>{
      if(['Space','KeyE','ArrowUp'].includes(e.code))e.preventDefault();
      if(e.repeat)return;
      if(e.code==='KeyR'){this.start();return;}
      if(e.code==='Escape'||e.code==='KeyP'){this.togglePause();return;}
      if(e.code==='Enter'&&this.s.phase!=='playing'){this.s.phase==='paused'?this.togglePause():this.start();return;}
      if((e.code==='Space'||e.code==='ArrowUp')&&this.s.phase==='playing')jump(this.s);
      if(e.code==='KeyE')tether(this.s,true);
    });
    window.addEventListener('keyup',e=>{if(e.code==='Space'||e.code==='ArrowUp')jump(this.s,false);if(e.code==='KeyE')tether(this.s,false);});
    this.ui('retry').onclick=()=>this.start();this.ui('pause').onclick=()=>this.togglePause();
    this.ui('sound').onclick=()=>{this.audio.init();this.audio.mute();this.updateSoundButton();};
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&this.s.phase==='playing')this.pause();});
    window.addEventListener('blur',()=>{if(this.s.phase==='playing')this.pause();});
    window.addEventListener('resize',()=>{this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight);});
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.pause();this.ui('hint').textContent='Graphics interrupted. Reload this page to reconnect.';});
  }
  updateSoundButton(){this.ui('sound').textContent=this.audio.muted?'SOUND OFF':'SOUND ON';this.ui('sound').setAttribute('aria-pressed',String(!this.audio.muted));}
  start() {
    this.audio.init();this.s=createState();begin(this.s);this.frames=[];this.lastSample=0;this.accumulator=0;this.previous=null;this.landing=0;this.ui('overlay').classList.add('hidden');this.ui('toast').classList.remove('show');this.toastTime=0;
    this.camera.position.set(this.polished?17:26,this.polished?22:27,this.polished?-25:-35);this.look.set(0,this.polished?12:15,this.polished?18:22);this.ghost.visible=!!this.best?.frames.length;
    this.ui('pause').setAttribute('aria-label','Pause game');this.updateUI();
  }
  pause(){if(this.s.phase!=='playing')return;this.s.phase='paused';this.s.jumpHeld=false;this.s.tetherHeld=false;this.accumulator=0;this.showMenu('paused');}
  togglePause(){if(this.s.phase==='playing')this.pause();else if(this.s.phase==='paused'){this.s.phase='playing';this.s.jumpHeld=false;this.s.tetherHeld=false;this.previous=null;this.accumulator=0;this.ui('overlay').classList.add('hidden');this.ui('pause').setAttribute('aria-label','Pause game');this.audio.init();}}
  showMenu(kind) {
    this.ui('overlay').classList.remove('hidden');this.root.classList.add('sl-menu-open');
    const ready=kind==='ready',paused=kind==='paused',won=kind==='won';
    const kicker=ready?'01 / COLABA AFTER THE RAIN':paused?'TAKE A BREATH':won?'DELIVERY COMPLETE':'THE CITY GETS ANOTHER CHANCE';
    const title=ready?'STORM<br><em>LINE.</em>':paused?'HOLD<br><em>ON.</em>':won?'LINE<br><em>MADE.</em>':'ONE<br><em>MORE.</em>';
    const description=ready?'The streets are underwater. The last train is leaving. Carry the power cell across the city, one swing at a time.':paused?'Your run is right where you left it. Reconnect when you’re ready.':won?'You caught the last train. Chase a cleaner line, collect the cells, or take the narrow sky deck.':this.s.deathReason;
    this.ui('panel').innerHTML=`<div class="sl-eyebrow">${kicker}</div><h1 class="sl-title">${title}</h1><div class="sl-subtitle">MONSOON ROOFTOPS / NEO-MUMBAI</div><p class="sl-desc">${description}</p>${!ready&&!paused?`<div class="sl-score-row"><div><b>${fmt(score(this.s))}</b><span>SCORE</span></div><div><b>${clock(this.s.t)}</b><span>RUN TIME</span></div><div><b>${this.s.cells.length}/3</b><span>CELLS</span></div></div>`:''}<button class="sl-primary" id="sl-launch">${paused?'RESUME RUN':ready?'TAKE THE LINE':'RUN IT AGAIN'} <span>↗</span></button>${paused?'<button class="sl-secondary" id="sl-menu-retry">RESTART</button>':''}<div class="sl-legend"><div><b>01 / JUMP</b>Space or left button</div><div><b>02 / GRAPPLE</b>Hold E or right button<br>Release to launch</div></div><div class="sl-ghost-note">${this.best?`PERSONAL BEST ${fmt(this.best.score)} · YOUR GHOST IS READY`:ready?'Four crossings. One moving train. Instant retries.':won?'Your best run is saved locally as a ghost.':''}</div><div class="sl-build">MOVEMENT PROTOTYPE 01 · <a href="?mode=classic">PLAY CLASSIC RUNNER ↗</a></div>`;
    this.ui('launch').onclick=()=>paused?this.togglePause():this.start();
    this.ui('menu-retry')?.addEventListener('click',()=>this.start());
    this.ui('pause').setAttribute('aria-label',paused?'Resume game':'Pause game');
  }
  toast(title,sub='') { this.ui('toast-title').textContent=title;this.ui('toast-sub').textContent=sub;this.ui('toast').classList.add('show');this.toastTime=1.5; }
  processEvents() {
    for(const e of this.s.events) {
      this.audio.play(e.type);
      if(e.type==='attach')this.toast('CONNECTED',`LINE 0${e.anchor+1} · RELEASE TO LAUNCH`);
      if(e.type==='release')this.toast('LET IT FLY','KEEP THE MOMENTUM');
      if(e.type==='land')this.toast(e.shortcut?'SKY CUT':e.clean?'CLEAN LANDING':'BACK ON THE ROOFS',e.clean?'MOMENTUM CARRIED':'FIND THE NEXT ANCHOR');
      if(e.type==='land'){this.landing=1;this.art?.land(this.s.x,this.s.y,this.s.z);}
      if(e.type==='cell')this.toast('POWER SECURED',`${this.s.cells.length} / 3 CELLS`);
      if(e.type==='won'||e.type==='lost') {
        if(e.type==='won'&&(!this.best||score(this.s)>this.best.score)) {
          this.best={score:score(this.s),time:this.s.t,frames:this.frames};try{localStorage.setItem(KEY,JSON.stringify(this.best));}catch{}
        }
        this.showMenu(this.s.phase);this.ghost.visible=false;
      }
    }
    this.s.events=[];
  }
  updateUI() {
    const s=this.s, active=s.phase==='playing';
    this.root.dataset.phase=s.phase;this.root.dataset.z=s.z.toFixed(2);this.root.dataset.y=s.y.toFixed(2);this.root.dataset.tether=s.rope?String(s.rope.anchor):'none';
    this.ui('speed').textContent=s.phase==='ready'?0:Math.round(Math.hypot(s.vz,s.vx)*3.6);this.ui('time').textContent=clock(s.t);
    this.ui('progress').style.width=`${clamp(s.z/400*100,0,100)}%`;this.ui('progress-label').textContent=active?`${Math.round(clamp(s.z/400*100,0,100))}% / DELIVERY 01`:'DELIVERY 01';
    [...this.root.querySelectorAll('.sl-route-dots i')].forEach((d,i)=>d.classList.toggle('passed',s.z>i*95));
    [...this.ui('cells').children].forEach((d,i)=>d.classList.toggle('collected',s.cells.includes(i)));this.ui('cells').setAttribute('aria-label',`${s.cells.length} of 3 energy cells`);
    if(this.lastRopeUI!==!!s.rope){this.lastRopeUI=!!s.rope;this.ui('grapple').classList.toggle('held',!!s.rope);this.ui('grapple').innerHTML=s.rope?'RELEASE TO LAUNCH<small>LET GO OF E / BUTTON</small>':'HOLD GRAPPLE<small>E / HOLD MOUSE · RELEASE TO LAUNCH</small>';}
    let objective='Jump toward the first crane.',hint='Near the edge, hold GRAPPLE. Release after you pass the anchor.',label='01 / THE FIRST CONNECTION';
    if(s.z>80){label='02 / CRANE DISTRICT';objective='Find the next line.';hint='Carry speed between rooftops. Hold early to connect.';}
    if(s.z>130){label='03 / THE HIGH LINE';objective='Take the sky cut?';hint='A later release gives height. The narrow upper deck is optional.';}
    if(s.z>220){label='04 / LAST CONNECTION';objective='The train is still moving.';hint='Cross the last roofs. Keep your momentum for the final swing.';}
    if(s.z>310){label='05 / CATCH THE LAST TRAIN';objective='Land on the train roof.';hint='Release toward the moving carriages. The delivery is almost there.';}
    if(s.rope){objective='Hold. Swing. Release.';hint=s.z>ANCHORS[s.rope.anchor].z+12?'Release now to launch toward the next roof.':'Stay connected as you pass beneath the crane.';}
    if(!active&&s.phase==='ready'){label='A CITY BETWEEN STORMS';objective='Make the last connection.';hint='Four lines. One delivery. Find your flow.';}
    this.ui('phase-label').textContent=label;this.ui('objective').textContent=objective;this.ui('hint').textContent=hint;
  }
  renderWorld(dt) {
    const s=this.s, playing=s.phase==='playing',ready=s.phase==='ready';this.visualTime+=dt;
    this.player.position.set(s.x,s.y,s.z);this.player.rotation.z=clamp(-s.vx*.025,-.25,.25);this.player.rotation.x=s.rope?clamp(-s.vy*.012,-.3,.3):(s.grounded ? .11 : -.14);
    if(this.polished) {
      this.landing*=Math.exp(-dt*11);
      animateCourier(this.player,s,this.visualTime,dt,s.rope?ANCHORS[s.rope.anchor]:null,this.landing);
      this.art.update(s.phase==='paused'?0:dt);
    } else {
    const limbs=this.player.userData.limbs;
    if(s.grounded){const swing=Math.sin(s.z*.65)*.65;limbs[0].rotation.x=swing;limbs[2].rotation.x=-swing;limbs[1].rotation.x=-swing*.6;limbs[3].rotation.x=swing*.6;}
    else{limbs[0].rotation.x=-.5;limbs[2].rotation.x=.6;limbs[1].rotation.x=s.rope?-2.4:-.7;limbs[3].rotation.x=s.rope?-2.1:-.3;}
    this.player.userData.scarf.scale.z=1+Math.max(0,s.vz-15)*.025;
    }
    this.train.position.z=s.t*1.1;
    this.cellMeshes.forEach((m,i)=>{m.visible=!s.cells.includes(i);m.rotation.y=this.visualTime*1.6;m.position.y=CELLS[i].y+Math.sin(this.visualTime*2+i)*.2;});
    for(const [i,g] of this.anchorGroups.entries()){g.children[0].rotation.z=this.visualTime*.4;g.children[2].rotation.y=this.visualTime*.6;g.scale.setScalar(s.rope?.anchor===i?1.22:1);}
    this.rope.visible=!!s.rope;
    if(s.rope){const a=ANCHORS[s.rope.anchor];if(this.polished){this.player.updateMatrixWorld(true);this.player.userData.grip.getWorldPosition(this.gripPosition);}else this.gripPosition.set(s.x+.1,s.y+1.65,s.z);this.setBar(this.rope,this.gripPosition,new THREE.Vector3(a.x,a.y,a.z));}
    const followY=Math.max(s.y,1),targetPos=ready?new THREE.Vector3(34+Math.sin(this.visualTime*.08)*3,29,-31):this.polished?new THREE.Vector3(s.x+(innerWidth<700?7:17),followY+13,s.z-(innerWidth<700?30:25)):new THREE.Vector3(s.x+(innerWidth<700?14:26),followY+18,s.z-(innerWidth<700?42:36));
    const desiredLook=ready?new THREE.Vector3(0,17,37):new THREE.Vector3(s.x,this.polished?Math.min(followY+4,22):followY+6,s.z+(this.polished?18:21));
    const k=1-Math.exp(-dt*5);if(s.phase!=='paused'){this.camera.position.lerp(targetPos,k);this.look.lerp(desiredLook,k);}
    const fov=58+(playing&&!this.reducedMotion?clamp((s.vz-20)*.2,0,4):0);this.camera.fov+= (fov-this.camera.fov)*k;this.camera.updateProjectionMatrix();this.camera.lookAt(this.look);
    const target=s.rope?ANCHORS[s.rope.anchor]:candidateAnchor(s),reticle=this.ui('reticle');
    if(target&&playing){const screen=new THREE.Vector3(target.x,target.y,target.z).project(this.camera);reticle.style.display=screen.z<1&&Math.abs(screen.x)<1&&Math.abs(screen.y)<1?'block':'none';reticle.style.left=`${(screen.x*.5+.5)*innerWidth}px`;reticle.style.top=`${(-screen.y*.5+.5)*innerHeight}px`;const releasing=!!s.rope&&s.z>target.z+12;reticle.classList.toggle('release',releasing);this.ui('reticle-label').textContent=releasing?'RELEASE TO LAUNCH':s.rope?'LINE CONNECTED':'HOLD TO GRAPPLE';}else reticle.style.display='none';
    this.rain.position.set(s.x,Math.max(s.y-15,-10),s.z+25);const p=this.rainGeometry.attributes.position;
    for(let i=0;i<p.array.length;i+=6){const fall=dt*27;p.array[i+1]-=fall;p.array[i+4]-=fall;if(p.array[i+1]<-5){p.array[i+1]+=75;p.array[i+4]+=75;}}p.needsUpdate=true;
    if(this.best&&playing){const f=this.best.frames;let lo=0,hi=f.length-1;while(lo+1<hi){const m=(lo+hi)>>1;if(f[m].t<=s.t)lo=m;else hi=m;}if(s.t<=f[f.length-1].t&&f[lo]&&f[hi]){const a=f[lo],b=f[hi],alpha=clamp((s.t-a.t)/(b.t-a.t||1),0,1);this.ghost.position.set(THREE.MathUtils.lerp(a.x,b.x,alpha),THREE.MathUtils.lerp(a.y,b.y,alpha),THREE.MathUtils.lerp(a.z,b.z,alpha));this.ghost.visible=Math.abs(this.ghost.position.z-s.z)<120;}else this.ghost.visible=false;}
    if(this.polished&&this.ghost.visible)animateCourier(this.ghost,s,this.visualTime,dt,null);
    if(this.toastTime>0){this.toastTime-=dt;if(this.toastTime<=0)this.ui('toast').classList.remove('show');}
    this.audio.update(Math.max(0,s.vz),playing);this.renderer.render(this.scene,this.camera);
    this.root.dataset.drawCalls=String(this.renderer.info.render.calls);this.root.dataset.triangles=String(this.renderer.info.render.triangles);
    this.frameCount=(this.frameCount||0)+1;
    if(!this.fpsStamp)this.fpsStamp=performance.now();
    if(performance.now()-this.fpsStamp>1000){this.root.dataset.fps=String(Math.round(this.frameCount*1000/(performance.now()-this.fpsStamp)));this.frameCount=0;this.fpsStamp=performance.now();}
  }
  frame(now) {
    this.frameID=requestAnimationFrame(this.frame);
    const dt=this.previous==null?0:Math.min(.1,Math.max(0,(now-this.previous)/1000));this.previous=now;
    if(this.s.phase==='playing') {
      this.accumulator=Math.min(.15,this.accumulator+dt);
      while(this.accumulator>=STEP&&this.s.phase==='playing') {
        simulate(this.s,STEP);this.accumulator-=STEP;
        if(this.s.t-this.lastSample>=.05){this.frames.push({t:this.s.t,x:this.s.x,y:this.s.y,z:this.s.z});this.lastSample=this.s.t;}
        this.processEvents();
      }
    }
    this.root.classList.toggle('sl-menu-open',this.s.phase!=='playing');
    if(!this.lastHUD||now-this.lastHUD>=45){this.updateUI();this.lastHUD=now;}
    this.renderWorld(Math.min(dt,.05));
  }
}
