import * as THREE from 'three';

const materialCache = new Map();
const material = (color, roughness = .85, metalness = .03) => {
  const key=`${color}/${roughness}/${metalness}`;
  if(!materialCache.has(key))materialCache.set(key,new THREE.MeshStandardMaterial({color,roughness,metalness}));
  return materialCache.get(key);
};
const basic = color => new THREE.MeshBasicMaterial({color});
const boxGeometry = new THREE.BoxGeometry(1,1,1);
const down = new THREE.Vector3(0,-1,0);
const clamp = THREE.MathUtils.clamp;
const mix = THREE.MathUtils.lerp;

function randomSource(seed) {
  return () => { seed=(seed*1664525+1013904223)>>>0; return seed/4294967296; };
}

// Static architectural details share a handful of draw calls.
class CityBatch {
  constructor(parent) { this.parent=parent; this.buckets=new Map(); this.count=0; }
  box(mat,w,h,d,x,y,z,rx=0,ry=0,rz=0) {
    if(!this.buckets.has(mat))this.buckets.set(mat,[]);
    this.buckets.get(mat).push([w,h,d,x,y,z,rx,ry,rz]); this.count++;
  }
  finish() {
    const transform=new THREE.Object3D();
    for(const [mat,items] of this.buckets) {
      const mesh=new THREE.InstancedMesh(boxGeometry,mat,items.length);
      for(const [i,v] of items.entries()) {
        transform.position.set(v[3],v[4],v[5]);transform.scale.set(v[0],v[1],v[2]);transform.rotation.set(v[6],v[7],v[8]);transform.updateMatrix();mesh.setMatrixAt(i,transform.matrix);
      }
      mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();this.parent.add(mesh);
    }
  }
}

function plasterTexture(seed) {
  const rand=randomSource(seed),canvas=document.createElement('canvas');canvas.width=256;canvas.height=512;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#bac4b7';ctx.fillRect(0,0,256,512);
  for(let i=0;i<1600;i++) { const v=Math.floor(110+rand()*100);ctx.fillStyle=`rgba(${v},${v+5},${v},${.04+rand()*.09})`;ctx.fillRect(rand()*256,rand()*512,1+rand()*5,1+rand()*5); }
  for(let i=0;i<45;i++) { const x=rand()*256,y=rand()*512;const g=ctx.createLinearGradient(x,y,x,y+130);g.addColorStop(0,'#314e463b');g.addColorStop(1,'#314e4600');ctx.fillStyle=g;ctx.fillRect(x,y,1+rand()*4,60+rand()*100); }
  for(let i=0;i<22;i++) { ctx.fillStyle='#d1cdb532';ctx.fillRect(rand()*256,rand()*512,8+rand()*22,4+rand()*15); }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}

function skyTexture() {
  const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=768;
  const ctx=canvas.getContext('2d'),gradient=ctx.createLinearGradient(0,0,0,768);
  gradient.addColorStop(0,'#142e3b');gradient.addColorStop(.55,'#38616a');gradient.addColorStop(1,'#829d94');ctx.fillStyle=gradient;ctx.fillRect(0,0,1536,768);
  const rand=randomSource(914);
  for(let i=0;i<45;i++) {
    const x=rand()*1800-130,y=rand()*500,r=110+rand()*190,g=ctx.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,i%3?'#10273530':'#a7beb00e');g.addColorStop(1,'#10273500');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}

function sign(parent,text,x,y,z,width=8,rotation=Math.PI) {
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=160;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#152e33';ctx.fillRect(0,0,512,160);ctx.fillStyle='#af4f32';ctx.fillRect(0,0,15,160);ctx.strokeStyle='#b5bd9a';ctx.lineWidth=4;ctx.strokeRect(23,12,477,136);
  ctx.fillStyle='#f0d7a4';ctx.font='bold 61px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,262,84,448);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,width*160/512),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));mesh.position.set(x,y,z);mesh.rotation.y=rotation;parent.add(mesh);
}

function addTank(parent,x,y,z,scale=1) {
  const group=new THREE.Group();group.position.set(x,y,z);group.scale.setScalar(scale);
  const dark=material(0x182d32,.73),band=material(0x405152,.6,.25);
  const tank=new THREE.Mesh(new THREE.CylinderGeometry(1.22,1.32,2.5,12),dark);tank.position.y=1.5;group.add(tank);
  for(const height of [.65,1.1,1.6,2.1,2.65]) { const ring=new THREE.Mesh(new THREE.TorusGeometry(1.27,.045,4,12),band);ring.rotation.x=Math.PI/2;ring.position.y=height;group.add(ring); }
  const lid=new THREE.Mesh(new THREE.CylinderGeometry(.7,.77,.16,12),band);lid.position.y=2.8;group.add(lid);
  const foot=new THREE.Mesh(boxGeometry,material(0x7c8980));foot.scale.set(2.8,.3,2.8);foot.position.y=.15;group.add(foot);parent.add(group);
}

function decorateRoof(batch,parent,r,mats) {
  const {trim,dark,metal,ochre,glass,warm,wall,awning}=mats;
  const z=r.start-.09,base=-21,h=r.y-base;
  // Inhabited facades under the landing deck; nothing intrudes into the centre lane.
  for(let y=base+3;y<r.y-3;y+=4.2) {
    batch.box(trim,r.width,.17,.25,0,y-1.2,z-.1);
    for(let col=0;col<4;col++) {
      const x=-r.width/2+2+col*(r.width-4)/3;
      batch.box(trim,1.78,2.05,.18,x,y,z-.08);
      batch.box((col+Math.round(y))%3===0?warm:glass,1.42,1.74,.15,x,y,z-.2);
      batch.box(dark,.065,1.75,.16,x,y,z-.3);
      if((col+Math.round(y))%3===0) {batch.box(trim,2.1,.17,1.15,x,y-1.1,z-.5);batch.box(metal,2,.12,.1,x,y-.3,z-1.05);for(const d of [-.8,0,.8])batch.box(metal,.06,.8,.06,x+d,y-.7,z-1.05);}
      if(col===0||col===3)batch.box(awning[col===0?0:1],1.95,.13,1.08,x,y+1.15,z-.4,-.15);
    }
  }
  for(const side of [-1,1]) {
    const x=side*(r.width/2+.08);
    for(let y=base+4;y<r.y-3;y+=4.2)for(let q=0;q<5;q++) {
      const zz=r.start+4+q*(r.end-r.start-8)/4;
      batch.box(trim,.18,2,1.7,x,y,zz);batch.box((q+Math.round(y))%3?glass:warm,.18,1.65,1.38,x+side*.1,y,zz);
      if(q%2===0)batch.box(metal,.7,.65,.9,x+side*.3,y-1.2,zz+1.35);
    }
    batch.box(ochre,.15,h,.15,x,base+h/2,r.start+1.1);
    const hutX=side*(r.width/2-2.25),hutZ=r.start+9+(side===1?8:0);
    batch.box(wall,3.2,2.5,4.3,hutX,r.y+1.25,hutZ);
    batch.box(awning[side===1?1:0],3.8,.18,5.1,hutX,r.y+2.68,hutZ,.12);
    for(let k=0;k<9;k++)batch.box(metal,.035,.04,4.9,hutX-1.6+k*.4,r.y+2.8,hutZ,.12);
    batch.box(dark,.6,1.7,.08,hutX,r.y+.9,hutZ-2.2);
    addTank(parent,hutX,r.y,r.start+27,side===1?.83:1);
    batch.box(metal,.12,.12,7,x,r.y+1,r.end-5);
    for(let i=0;i<4;i++)batch.box(metal,.09,1.8,.09,x,r.y+.7,r.end-8+i*2);
  }
  // Flush roof patches and a perimeter drain are visual details, not obstacles.
  for(let i=0;i<4;i++)batch.box(dark,.12,.025,1.1,r.width/2-1,r.y+.112,r.start+3+i*7);
  batch.box(metal,r.width-2,.04,.18,0,r.y+.12,r.start+1.2);
  for(let k=0;k<3;k++)for(const side of [-1,1])batch.box(trim,.11,.025,1.15,side*.35,r.y+.125,r.start+3+k*2,0,side*.65);
}

export function buildStormCity(scene,roofs,roofGroups,train) {
  scene.background=skyTexture();
  const batch=new CityBatch(scene),rand=randomSource(4127);
  const grain=plasterTexture(219),walls=[0x78857a,0x596e69,0x8a8c79,0x53676a,0x6f7c70,0x446164].map(c=>{const m=material(c);m.map=grain;return m;});
  const trim=material(0x9a9e87),dark=material(0x20393d),metal=material(0x435c5b,.6,.35),ochre=material(0x9b754a),glass=material(0x304f54,.28,.24);
  const warm=new THREE.MeshStandardMaterial({color:0xc7a578,emissive:0xffb968,emissiveIntensity:.55,roughness:.6});
  const amber=new THREE.MeshStandardMaterial({color:0xe3be86,emissive:0xf6aa54,emissiveIntensity:.8,roughness:.7});
  const awning=[material(0x8e5943),material(0x536e6c)],mats={trim,dark,metal,ochre,glass,warm,wall:walls[1],awning};
  for(const [i,r] of roofs.entries())if(!r.train&&!r.shortcut)decorateRoof(batch,roofGroups[i],r,mats);
  let windowCount=0;
  for(let i=0;i<62;i++) {
    const side=i%2?1:-1,near=i<34;
    const w=10+rand()*13,d=12+rand()*16,h=27+rand()*(near?62:100);
    const x=side*((near?52:105)+rand()*(near?34:110)),z=-60+rand()*690,y=-25+h/2,wall=walls[i%walls.length];
    batch.box(wall,w,h,d,x,y,z);
    batch.box(trim,w+.55,.45,d+.5,x,-25+h,z);
    const rows=Math.floor((h-4)/4.3),cols=Math.max(3,Math.floor(w/3.8));
    for(let row=0;row<rows;row++) {
      const yy=-21+row*4.3;
      if(row%3===0)batch.box(trim,w,.16,d+.12,x,yy-1.4,z);
      for(let col=0;col<cols;col++) {
        const xx=x-w/2+1.7+col*(w-3.4)/Math.max(1,cols-1),zz=z-d/2-.12;
        batch.box(dark,1.85,2.25,.14,xx,yy,zz);
        const choice=rand(),windowMat=choice>.8?amber:choice>.51?warm:glass;
        batch.box(windowMat,1.55,1.95,.13,xx,yy,zz-.1);windowCount++;
        if(near) {
          batch.box(trim,1.95,.15,.35,xx,yy-1.12,zz-.1);
          batch.box(metal,.06,1.95,.16,xx,yy,zz-.19);
          if((row+col+i)%5===0) {batch.box(awning[(i+row)%2],2.3,.16,1.2,xx,yy+1.35,zz-.5,-.13);batch.box(metal,.8,.7,.7,xx+1.45,yy-1,zz-.3);}
          if((row+i)%4===0) {
            batch.box(trim,2.5,.18,1.1,xx,yy-1.3,zz-.5);batch.box(metal,2.4,.09,.08,xx,yy-.5,zz-1);
            for(const bx of [-1,0,1])batch.box(metal,.055,.8,.055,xx+bx,yy-.9,zz-1);
          }
        }
      }
    }
    // Side windows and vertical ribs stop buildings reading as flat boxes.
    for(const signX of [-1,1]) {
      for(let q=0;q<3;q++) {
        const zz=z-d/2+3+q*(d-6)/2;
        batch.box(trim,.24,h-.8,.22,x+signX*(w/2+.1),y,zz-1.2);
        for(let row=0;row<rows;row+=near?1:2)batch.box((row+q+i)%4===0?warm:glass,.16,1.9,1.5,x+signX*(w/2+.15),-21+row*4.3,zz);
      }
    }
    batch.box(walls[(i+2)%walls.length],w*.43,3.2,d*.35,x+w*.18,-23.2+h,z+d*.1);
    batch.box(awning[i%2],w*.5,.22,d*.42,x+w*.18,-21.5+h,z+d*.1,.07);
    if(i<12)addTank(scene,x-w*.24,-24.8+h,z-d*.23,.9);
    if(i%5===0) {
      batch.box(metal,.12,6,.12,x+w*.3,-22+h,z);
      batch.box(metal,3,.08,.08,x+w*.3,-20+h,z);
    }
    if(i<16&&i%3===0)sign(scene,['चाय / CHAI','COLABA','RAIL / 01','MONSOON'][i%4],x,-25+h*.64,z-d/2-.3,Math.min(w-1,12));
  }
  // Rail viaduct and pillars give the final platform a believable home.
  const viaduct=material(0x64776d),rail=material(0x586d68,.5,.5);
  batch.box(viaduct,19,1.7,135,0,1.1,414);
  for(const x of [-5,5])batch.box(rail,.22,.22,135,x,2.1,414);
  for(let z=355;z<482;z+=20) {batch.box(viaduct,2.1,24,3.2,-5,-11.5,z);batch.box(viaduct,2.1,24,3.2,5,-11.5,z);batch.box(viaduct,15,1.5,3.8,0,.1,z);}
  // Low-key reflections sit at flood height, safely below every landing.
  const water=new THREE.Mesh(new THREE.PlaneGeometry(2400,2400),material(0x254951,.28,.58));water.rotation.x=-Math.PI/2;water.position.set(0,-21,200);scene.add(water);
  const reflection=basic(0x5f817c),warmReflection=basic(0x8e8461);
  for(let i=0;i<135;i++)batch.box(i%5?reflection:warmReflection,.2+rand()*1.7,.012,2+rand()*10,(rand()-.5)*180,-20.975,-20+rand()*600);
  for(const x of [-13,13])batch.box(rail,.35,.5,550,x,-4,230);
  const trainBatch=new CityBatch(train);
  for(let c=0;c<3;c++) {
    const z=379+c*28;
    trainBatch.box(awning[0],13.4,.32,24,0,3.8,z);
    for(const x of [-6.65,6.65]) {
      trainBatch.box(trim,.12,.15,24,x,6.7,z);
      trainBatch.box(ochre,.14,.28,24,x,4.1,z);
      for(let w=0;w<7;w++)trainBatch.box(dark,.14,.08,1.5,x,5.5,z-10+w*3);
    }
    for(const x of [-4,4])for(let k=0;k<9;k++)trainBatch.box(metal,.8,.04,.1,x,8.02,z-9+k*2.3);
  }
  trainBatch.finish();batch.finish();
  // Landing ripples are a small reusable pool, not a particle emitter per frame.
  const rippleMaterial=new THREE.MeshBasicMaterial({color:0xd4e4cf,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide});
  const ripples=Array.from({length:4},()=>{const m=new THREE.Mesh(new THREE.RingGeometry(.8,1,32),rippleMaterial.clone());m.rotation.x=-Math.PI/2;m.visible=false;m.userData.dynamic=true;scene.add(m);return {mesh:m,age:2};});
  let nextRipple=0;
  return {
    stats:{architectureInstances:batch.count,architectureBatches:batch.buckets.size,windows:windowCount},
    land(x,y,z) {const r=ripples[nextRipple++%ripples.length];r.age=0;r.mesh.position.set(x,y+.16,z);r.mesh.visible=true;},
    update(dt) {for(const r of ripples)if(r.age<.65){r.age+=dt;r.mesh.scale.setScalar(1+r.age*5);r.mesh.material.opacity=Math.max(0,.28*(1-r.age/.65));r.mesh.visible=r.age<.65;}},
  };
}

function mesh(parent,geometry,mat,x=0,y=0,z=0,sx=1,sy=1,sz=1) {
  const m=new THREE.Mesh(geometry,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m;
}

export function createCourier(ghost=false) {
  const g=new THREE.Group(),root=new THREE.Group();g.add(root);g.scale.setScalar(1.18);
  const ghostMat=new THREE.MeshBasicMaterial({color:0xd3ff7a,transparent:true,opacity:.18,depthWrite:false});
  const coat=ghost?ghostMat:material(0xe3d2a4,.88),hem=ghost?ghostMat:material(0xbba87c),rubber=ghost?ghostMat:material(0x162d34,.65),orange=ghost?ghostMat:material(0xc56532,.85),reflector=ghost?ghostMat:basic(0xe5efcb),skin=ghost?ghostMat:material(0x9e7254);
  const cylinder=new THREE.CylinderGeometry(.11,.105,.48,8),sphere=new THREE.SphereGeometry(1,12,8);
  mesh(root,new THREE.CapsuleGeometry(.34,.53,4,10),coat,0,1.38,0,1,1,.82);
  const skirt=mesh(root,new THREE.CylinderGeometry(.33,.46,.55,10),coat,0,1.01,0,1,1,.88);
  mesh(root,boxGeometry,hem,0,1.17,.286,.05,.68,.025);
  mesh(root,boxGeometry,reflector,0,1.5,.298,.47,.04,.025);
  const head=new THREE.Group();head.position.set(0,1.97,0);root.add(head);
  mesh(head,sphere,coat,0,0,-.035,.34,.38,.31);
  mesh(head,sphere,rubber,0,-.045,.24,.255,.25,.09);
  mesh(head,boxGeometry,skin,0,.02,.315,.26,.075,.025);
  mesh(head,boxGeometry,reflector,0,-.11,.323,.22,.025,.028);
  mesh(head,boxGeometry,coat,0,.18,.22,.57,.085,.31);
  mesh(root,boxGeometry,rubber,0,1.4,-.35,.54,.64,.3);
  mesh(root,boxGeometry,orange,0,1.42,-.515,.4,.42,.04);
  mesh(root,boxGeometry,reflector,0,1.45,-.543,.29,.055,.018);
  for(const x of [-.22,.22])mesh(root,boxGeometry,hem,x,1.45,.22,.055,.63,.05);
  const legs=[],arms=[];
  for(const side of [-1,1]) {
    const hip=new THREE.Group();hip.position.set(side*.2,.89,0);root.add(hip);
    mesh(hip,cylinder,rubber,0,-.22,0,1.1,1,1.1);
    const knee=new THREE.Group();knee.position.y=-.44;hip.add(knee);
    mesh(knee,cylinder,rubber,0,-.17,0,.9,.75,.9);
    const foot=mesh(knee,boxGeometry,rubber,0,-.35,.09,.24,.19,.42);legs.push({hip,knee,foot});
    const shoulder=new THREE.Group();shoulder.position.set(side*.38,1.66,0);root.add(shoulder);
    mesh(shoulder,cylinder,coat,0,-.22,0,1.25,.95,1.2);
    const elbow=new THREE.Group();elbow.position.y=-.42;shoulder.add(elbow);
    mesh(elbow,cylinder,coat,0,-.17,0,.9,.75,.9);
    mesh(elbow,boxGeometry,reflector,0,-.18,.105,.18,.045,.035);
    const hand=mesh(elbow,sphere,rubber,0,-.36,0,.11,.14,.11);arms.push({shoulder,elbow,hand});
  }
  const scarfBase=new THREE.Group();scarfBase.position.set(-.1,1.84,-.13);root.add(scarfBase);
  mesh(scarfBase,new THREE.TorusGeometry(.23,.085,5,12),orange,0,0,.08,1,1,.9).rotation.x=Math.PI/2;
  const scarf=[];let parent=scarfBase;
  for(let i=0;i<5;i++) {const joint=new THREE.Group();joint.position.z=i===0?-.13:-.29;parent.add(joint);mesh(joint,boxGeometry,orange,0,0,-.15,.24-i*.022,.036,.31);scarf.push(joint);parent=joint;}
  const contact=ghost?null:mesh(g,new THREE.CircleGeometry(.65,20),new THREE.MeshBasicMaterial({color:0x0b252a,transparent:true,opacity:.28,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}),0,.11,0,1,1,1);
  if(contact)contact.rotation.x=-Math.PI/2;
  g.userData={rig:{root,head,skirt,legs,arms,scarf,contact,direction:new THREE.Vector3(),target:new THREE.Quaternion(),inverse:new THREE.Quaternion()},grip:arms[1].hand};
  return g;
}

export function animateCourier(g,s,time,dt,anchor,landing=0) {
  const rig=g.userData.rig;if(!rig)return;
  const running=s.phase==='playing'&&s.grounded,phase=s.z*.72,speed=clamp(s.vz/24,.4,1.7);
  rig.root.position.y=running?Math.abs(Math.sin(phase))* .07:Math.sin(time*2)*.012;
  rig.root.scale.y=1-landing*.08;rig.root.scale.x=1+landing*.035;
  rig.root.rotation.x=s.rope?-.06:running?.12:clamp(-s.vy*.013,-.23,.25);
  rig.root.rotation.z=running?Math.sin(phase)*.035:0;rig.head.rotation.x=-rig.root.rotation.x*.6;rig.head.rotation.y=Math.sin(time*.9)*.035;
  rig.skirt.rotation.x=running?Math.sin(phase)*.07:clamp(s.vy*.015,-.14,.22);
  for(let i=0;i<2;i++) {
    const stride=Math.sin(phase+i*Math.PI),leg=rig.legs[i],arm=rig.arms[i];
    leg.hip.rotation.x=running?stride*.8*speed:s.rope?[-.6,.5][i]:[-.38,.62][i];
    leg.knee.rotation.x=running?Math.max(0,-stride)*1.15:s.rope?.7:.48;
    leg.foot.rotation.x=running?Math.max(0,stride)*.2:-.12;
    const desired=rig.target;
    if(anchor&&i===1) {
      rig.inverse.copy(g.quaternion).invert();
      rig.direction.set(anchor.x-g.position.x,anchor.y-g.position.y-1.8,anchor.z-g.position.z).applyQuaternion(rig.inverse).normalize();
      desired.setFromUnitVectors(down,rig.direction);arm.elbow.rotation.x=.06;
    } else {
      desired.setFromEuler(new THREE.Euler(running?-stride*.65:s.rope?-.7:-.48,0,i===0?.14:-.14));arm.elbow.rotation.x=running?-.5:s.rope?-.6:-.85;
    }
    arm.shoulder.quaternion.slerp(desired,1-Math.exp(-dt*18));
  }
  for(const [i,joint] of rig.scarf.entries()) {joint.rotation.x=.08+Math.sin(time*9-i*.8)*(.06+speed*.035);joint.rotation.y=Math.sin(time*7-i*.9)*.16;joint.scale.z=.85+Math.min(speed,1.5)*.15;}
  if(rig.contact){rig.contact.visible=!!s.grounded;rig.contact.material.opacity=.28;}
}

export function batchStaticMeshes(scene,excluded=[]) {
  scene.updateMatrixWorld(true);
  const buckets=new Map();
  scene.traverse(object=>{
    if(!object.isMesh||object.isInstancedMesh||Array.isArray(object.material)||object.material.transparent||!object.visible)return;
    for(let p=object;p;p=p.parent)if(p.userData.dynamic||excluded.includes(p))return;
    const key=`${object.geometry.type}/${JSON.stringify(object.geometry.parameters)}/${object.material.uuid}`;
    if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(object);
  });
  let saved=0;
  for(const items of buckets.values()) {
    if(items.length<3)continue;
    const mesh=new THREE.InstancedMesh(items[0].geometry,items[0].material,items.length);
    items.forEach((item,i)=>mesh.setMatrixAt(i,item.matrixWorld));mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();scene.add(mesh);
    for(const item of items)item.removeFromParent();saved+=items.length-1;
  }
  return saved;
}
