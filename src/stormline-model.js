import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const JOINTS = ['RigBody','Head','CoatHem',...['L','R'].flatMap(side=>['Hip','Knee','Foot','Shoulder','Elbow','HandGrip'].map(name=>`${name}_${side}`)),...Array.from({length:5},(_,i)=>`Scarf_${i}`)];
let pending;

export function validateCourierAsset(scene) {
  for(const name of JOINTS)if(!scene.getObjectByName(name))throw new Error(`Courier asset is missing joint ${name}`);
  const bounds=new THREE.Box3().setFromObject(scene),size=bounds.getSize(new THREE.Vector3());
  if(![size.x,size.y,size.z,bounds.min.y].every(Number.isFinite)||size.y<2||size.y>2.8||size.x<.5||size.x>1.6||size.z<.5||size.z>2.5||Math.abs(bounds.min.y)>.04)throw new Error('Courier asset has invalid scale or foot origin');
  return scene;
}

export function loadCourierAsset() {
  if(!pending)pending=new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/courier/courier.glb`).then(gltf=>validateCourierAsset(gltf.scene)).catch(error=>{pending=null;throw error;});
  return pending;
}

export function installCourierAsset(target,source,ghost=false) {
  validateCourierAsset(source);
  const model=source.clone(true),node=name=>model.getObjectByName(name);
  const previous=target.userData.rig;
  if(!previous)throw new Error('Courier target has no fallback rig');
  if(ghost) {
    const material=new THREE.MeshBasicMaterial({color:0xd3ff7a,transparent:true,opacity:.18,depthWrite:false,side:THREE.DoubleSide});
    model.traverse(object=>{if(object.isMesh)object.material=material;});
  }
  const rig={
    root:node('RigBody'),head:node('Head'),skirt:node('CoatHem'),
    legs:['L','R'].map(side=>({hip:node(`Hip_${side}`),knee:node(`Knee_${side}`),foot:node(`Foot_${side}`)})),
    arms:['L','R'].map(side=>({shoulder:node(`Shoulder_${side}`),elbow:node(`Elbow_${side}`),hand:node(`HandGrip_${side}`)})),
    scarf:Array.from({length:5},(_,i)=>node(`Scarf_${i}`)),contact:previous.contact,
    direction:new THREE.Vector3(),target:new THREE.Quaternion(),inverse:new THREE.Quaternion(),
  };
  previous.root.removeFromParent();
  target.add(model);target.userData.rig=rig;target.userData.grip=rig.arms[1].hand;target.userData.model='blender';
  return rig;
}
