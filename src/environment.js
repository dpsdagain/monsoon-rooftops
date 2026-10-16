import * as THREE from 'three';
import { CONFIG } from './constants.js';
import { PLATFORMS_DATA, CELLS_DATA } from './level.js';
import { sound } from './audio.js';

export class Environment {
  constructor(scene) {
    this.scene = scene;
    this.platformMeshes = [];
    this.cellObjects = [];
    this.rainSystem = null;
    this.lightningLight = null;
    this.ambientLight = null;
    this.dirLight = null;

    this.lightningTimer = 6.0;
    this.lightningDuration = 0;

    this.initLightingAndSky();
    this.buildPlatforms();
    this.buildDistantSkyline();
    this.buildCollectibles();
    this.initRainSystem();
  }

  initLightingAndSky() {
    // Atmospheric dark blue sky and fog
    this.scene.background = new THREE.Color(CONFIG.COLORS.BG_SKY);
    this.scene.fog = new THREE.FogExp2(CONFIG.COLORS.FOG, 0.014);

    // Hemisphere light - cyber sky tone and dark wet city bounce
    this.hemiLight = new THREE.HemisphereLight(0x6688bb, 0x182030, 2.0);
    this.scene.add(this.hemiLight);

    // Directional light - moonlight / stormy overhead glow with highlights
    this.dirLight = new THREE.DirectionalLight(0x88b5ec, 2.2);
    this.dirLight.position.set(15, 35, 25);
    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);

    // Lightning flash light
    this.lightningLight = new THREE.DirectionalLight(0xeeffff, 0.0);
    this.lightningLight.position.set(-10, 50, 40);
    this.scene.add(this.lightningLight);
  }

  buildPlatforms() {
    const wallMat = new THREE.MeshStandardMaterial({
      color: CONFIG.COLORS.ROOF_WALL,
      roughness: 0.85,
      metalness: 0.15
    });

    const roofSurfaceMat = new THREE.MeshStandardMaterial({
      color: CONFIG.COLORS.ROOF_SURFACE,
      roughness: 0.25, // Wet glossy concrete reflection
      metalness: 0.35
    });

    const cyanEdgeMat = new THREE.MeshBasicMaterial({
      color: CONFIG.COLORS.ROOF_EDGE_CYAN
    });

    const amberEdgeMat = new THREE.MeshBasicMaterial({
      color: CONFIG.COLORS.ROOF_EDGE_AMBER
    });

    // Decorative lip. Collision still reads PLATFORMS_DATA, not this mesh.
    const razorMat = new THREE.MeshBasicMaterial({
      color: 0xffc14d,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });

    PLATFORMS_DATA.forEach((plat) => {
      const length = plat.zEnd - plat.zStart;
      const centerZ = plat.zStart + length * 0.5;
      const height = 45.0; // Building extends downwards into the mist
      const centerY = plat.topY - height * 0.5;

      const group = new THREE.Group();

      // Main Building Block
      const buildingGeo = new THREE.BoxGeometry(plat.width, height, length);
      const buildingMesh = new THREE.Mesh(buildingGeo, wallMat);
      buildingMesh.position.set(plat.x, centerY, centerZ);
      group.add(buildingMesh);

      // Top Roof Slab (distinct wet texture surface)
      const slabGeo = new THREE.BoxGeometry(plat.width + 0.2, 0.4, length + 0.2);
      const slabMesh = new THREE.Mesh(slabGeo, roofSurfaceMat);
      slabMesh.position.set(plat.x, plat.topY - 0.2, centerZ);
      group.add(slabMesh);

      // Glowing Neon Runway Edges (Left & Right)
      const edgeMat = plat.edgeColor === 'amber' ? amberEdgeMat : cyanEdgeMat;
      const edgeGeo = new THREE.BoxGeometry(0.2, 0.15, length);

      const leftEdge = new THREE.Mesh(edgeGeo, edgeMat);
      leftEdge.position.set(plat.x - plat.width * 0.5, plat.topY + 0.08, centerZ);
      group.add(leftEdge);

      const rightEdge = new THREE.Mesh(edgeGeo, edgeMat);
      rightEdge.position.set(plat.x + plat.width * 0.5, plat.topY + 0.08, centerZ);
      group.add(rightEdge);

      // Takeoff & Landing Warning Strips (Front & Back edges)
      const crossGeo = new THREE.BoxGeometry(plat.width, 0.15, 0.3);
      const startCross = new THREE.Mesh(crossGeo, edgeMat);
      startCross.position.set(plat.x, plat.topY + 0.08, plat.zStart + 0.2);
      group.add(startCross);

      const endCross = new THREE.Mesh(crossGeo, edgeMat);
      endCross.position.set(plat.x, plat.topY + 0.08, plat.zEnd - 0.2);
      group.add(endCross);

      const razorDepth = Math.min(CONFIG.RAZOR_MARGIN, Math.max(0, length - 0.6));
      if (razorDepth > 0.4) {
        const razorGeo = new THREE.BoxGeometry(plat.width - 0.55, 0.05, razorDepth);
        const razorBand = new THREE.Mesh(razorGeo, razorMat);
        razorBand.position.set(plat.x, plat.topY + 0.06, plat.zStart + razorDepth * 0.5);
        razorBand.name = 'razor-lip';
        group.add(razorBand);
      }

      // Center Dash Guide Line along runway
      const dashCount = Math.floor(length / 8.0);
      for (let d = 0; d < dashCount; d++) {
        const dashZ = plat.zStart + 4.0 + d * 8.0;
        const dashGeo = new THREE.BoxGeometry(0.3, 0.02, 3.0);
        const dashMesh = new THREE.Mesh(dashGeo, edgeMat);
        dashMesh.position.set(plat.x, plat.topY + 0.02, dashZ);
        group.add(dashMesh);
      }

      // Add Props
      if (plat.props) {
        plat.props.forEach((prop) => {
          this.createProp(group, prop, plat.topY);
        });
      }

      this.scene.add(group);
      this.platformMeshes.push(group);
    });
  }

  createProp(parentGroup, prop, roofTopY) {
    if (prop.type === 'waterTank') {
      // Indian Sintex-style cylindrical water tank
      const tankMat = new THREE.MeshStandardMaterial({
        color: CONFIG.COLORS.WATER_TANK,
        roughness: 0.4,
        metalness: 0.3
      });
      const standMat = new THREE.MeshStandardMaterial({
        color: 0x333b47,
        roughness: 0.7,
        metalness: 0.6
      });

      // Tank cylinder
      const tankGeo = new THREE.CylinderGeometry(prop.radius, prop.radius, prop.height, 14);
      const tank = new THREE.Mesh(tankGeo, tankMat);
      tank.position.set(prop.x, roofTopY + prop.height * 0.5 + 0.6, prop.z);
      parentGroup.add(tank);

      // 4 Leg stand
      const standGeo = new THREE.BoxGeometry(prop.radius * 1.8, 0.6, prop.radius * 1.8);
      const stand = new THREE.Mesh(standGeo, standMat);
      stand.position.set(prop.x, roofTopY + 0.3, prop.z);
      parentGroup.add(stand);

      // Tank lid ring
      const ringGeo = new THREE.CylinderGeometry(prop.radius * 0.5, prop.radius * 0.5, 0.2, 10);
      const ring = new THREE.Mesh(ringGeo, standMat);
      ring.position.set(prop.x, roofTopY + prop.height + 0.7, prop.z);
      parentGroup.add(ring);
    } else if (prop.type === 'ventUnit') {
      // Industrial AC condenser / rooftop chiller
      const ventMat = new THREE.MeshStandardMaterial({
        color: 0x242c3a,
        roughness: 0.6,
        metalness: 0.5
      });
      const ventGeo = new THREE.BoxGeometry(prop.width, prop.height, prop.depth);
      const vent = new THREE.Mesh(ventGeo, ventMat);
      vent.position.set(prop.x, roofTopY + prop.height * 0.5, prop.z);
      parentGroup.add(vent);

      // Grill accent on top
      const grillGeo = new THREE.BoxGeometry(prop.width * 0.8, 0.08, prop.depth * 0.8);
      const grillMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
      const grill = new THREE.Mesh(grillGeo, grillMat);
      grill.position.set(prop.x, roofTopY + prop.height + 0.04, prop.z);
      parentGroup.add(grill);
    } else if (prop.type === 'solarArray') {
      // Tilted solar panels
      const panelMat = new THREE.MeshStandardMaterial({
        color: 0x0f284a,
        roughness: 0.2,
        metalness: 0.8
      });
      const panelGeo = new THREE.BoxGeometry(prop.width, 0.1, prop.depth);
      const panel = new THREE.Mesh(panelGeo, panelMat);
      panel.position.set(prop.x, roofTopY + 0.6, prop.z);
      panel.rotation.x = -0.25; // Tilted towards sunlight
      parentGroup.add(panel);
    } else if (prop.type === 'antenna') {
      // Tall radio / telecom mast with blinking red beacon
      const poleGeo = new THREE.CylinderGeometry(0.08, 0.18, prop.height, 8);
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x4a5568, metalness: 0.7 });
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(prop.x, roofTopY + prop.height * 0.5, prop.z);
      parentGroup.add(pole);

      // Blinking red warning beacon at tip
      const beaconGeo = new THREE.SphereGeometry(0.2, 8, 8);
      const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff1133 });
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.position.set(prop.x, roofTopY + prop.height + 0.1, prop.z);
      parentGroup.add(beacon);
    } else if (prop.type === 'satelliteDish') {
      // Telecom satellite dish
      const dishMat = new THREE.MeshStandardMaterial({ color: 0x8899aa, metalness: 0.5 });
      const dishGeo = new THREE.CylinderGeometry(prop.radius, prop.radius * 0.2, 0.4, 12, 1, true);
      const dish = new THREE.Mesh(dishGeo, dishMat);
      dish.position.set(prop.x, roofTopY + 1.2, prop.z);
      dish.rotation.x = 0.6;
      parentGroup.add(dish);

      const standGeo = new THREE.CylinderGeometry(0.1, 0.1, 1.2, 6);
      const stand = new THREE.Mesh(standGeo, dishMat);
      stand.position.set(prop.x, roofTopY + 0.6, prop.z);
      parentGroup.add(stand);
    } else if (prop.type === 'neonSign') {
      // Stylized neon billboard with glowing frame
      const frameGeo = new THREE.BoxGeometry(prop.isBanner ? 10.0 : 3.5, prop.isBanner ? 1.5 : 2.0, 0.2);
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x111622, metalness: 0.8 });
      const frame = new THREE.Mesh(frameGeo, frameMat);
      frame.position.set(prop.x, roofTopY + (prop.isBanner ? 2.5 : 2.0), prop.z);
      parentGroup.add(frame);

      // Glowing Neon Plate
      const glowMat = new THREE.MeshBasicMaterial({ color: prop.color });
      const glowPlate = new THREE.Mesh(
        new THREE.BoxGeometry(prop.isBanner ? 9.6 : 3.2, prop.isBanner ? 1.2 : 1.7, 0.05),
        glowMat
      );
      glowPlate.position.set(prop.x, roofTopY + (prop.isBanner ? 2.5 : 2.0), prop.z + 0.12);
      parentGroup.add(glowPlate);
    } else if (prop.type === 'helipad') {
      // Helipad landing circle with cyan glow
      const ringGeo = new THREE.RingGeometry(prop.radius * 0.7, prop.radius * 0.9, 32);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.set(prop.x, roofTopY + 0.03, prop.z);
      ring.rotation.x = -Math.PI / 2;
      parentGroup.add(ring);

      // 'H' geometry in center
      const hMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
      const bar1 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.02, 3.2), hMat);
      bar1.position.set(prop.x - 1.0, roofTopY + 0.04, prop.z);
      parentGroup.add(bar1);

      const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.02, 3.2), hMat);
      bar2.position.set(prop.x + 1.0, roofTopY + 0.04, prop.z);
      parentGroup.add(bar2);

      const crossBar = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.02, 0.4), hMat);
      crossBar.position.set(prop.x, roofTopY + 0.04, prop.z);
      parentGroup.add(crossBar);
    }
  }

  buildDistantSkyline() {
    // Distant background skyscrapers to create the futuristic city atmosphere
    const skylineMat = new THREE.MeshBasicMaterial({
      color: CONFIG.COLORS.BUILDING_DISTANT
    });

    const windowColors = [0x00f0ff, 0xffaa00, 0x00ff88, 0x3366ff];

    // Seeded random distribution
    let seed = 42;
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    const skylineGroup = new THREE.Group();

    for (let i = 0; i < 70; i++) {
      const side = rnd() > 0.5 ? 1 : -1;
      const x = side * (30.0 + rnd() * 85.0);
      const z = -40.0 + rnd() * 1100.0;
      const w = 15.0 + rnd() * 25.0;
      const d = 15.0 + rnd() * 25.0;
      const h = 40.0 + rnd() * 120.0;
      const y = -10.0 + h * 0.5;

      const towerGeo = new THREE.BoxGeometry(w, h, d);
      const tower = new THREE.Mesh(towerGeo, skylineMat);
      tower.position.set(x, y, z);
      skylineGroup.add(tower);

      // Window strips on buildings
      const stripCount = Math.floor(2 + rnd() * 4);
      for (let s = 0; s < stripCount; s++) {
        const stripW = w * 0.8;
        const stripY = y - h * 0.3 + s * (h * 0.15);
        const winColor = windowColors[Math.floor(rnd() * windowColors.length)];
        const winMat = new THREE.MeshBasicMaterial({ color: winColor });
        const stripGeo = new THREE.BoxGeometry(stripW, 0.6, d + 0.2);
        const winMesh = new THREE.Mesh(stripGeo, winMat);
        winMesh.position.set(x, stripY, z);
        skylineGroup.add(winMesh);
      }
    }

    this.scene.add(skylineGroup);
  }

  buildCollectibles() {
    this.cellObjects = [];

    CELLS_DATA.forEach((cellData) => {
      const group = new THREE.Group();
      group.position.set(cellData.x, cellData.y, cellData.z);

      // Glowing Diamond / Octahedron core
      const coreGeo = new THREE.OctahedronGeometry(0.45, 0);
      const coreMat = new THREE.MeshBasicMaterial({
        color: CONFIG.COLORS.CELL_CORE
      });
      const core = new THREE.Mesh(coreGeo, coreMat);
      group.add(core);

      // Outer rotating cyan energy halo
      const haloGeo = new THREE.TorusGeometry(0.7, 0.05, 8, 24);
      const haloMat = new THREE.MeshBasicMaterial({
        color: CONFIG.COLORS.CELL_GLOW
      });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.rotation.x = Math.PI / 3;
      group.add(halo);

      // Secondary vertical ring
      const halo2 = new THREE.Mesh(haloGeo, haloMat);
      halo2.rotation.y = Math.PI / 2;
      group.add(halo2);

      this.scene.add(group);

      this.cellObjects.push({
        data: cellData,
        group: group,
        core: core,
        halo: halo,
        halo2: halo2,
        baseY: cellData.y,
        isCollected: false
      });
    });
  }

  initRainSystem() {
    // 2500 monsoon rain streak particles
    const rainCount = 2500;
    const positions = new Float32Array(rainCount * 6); // Line segments (2 vertices per streak)
    const rainRangeX = 70;
    const rainRangeY = 40;
    const rainRangeZ = 90;
    const streakLength = 1.4;

    this.rainData = [];

    for (let i = 0; i < rainCount; i++) {
      const rx = (Math.random() - 0.5) * rainRangeX;
      const ry = Math.random() * rainRangeY;
      const rz = (Math.random() - 0.5) * rainRangeZ;
      const speed = 25.0 + Math.random() * 15.0;

      this.rainData.push({ x: rx, y: ry, z: rz, speed: speed });

      const idx = i * 6;
      // Vertex 1
      positions[idx] = rx;
      positions[idx + 1] = ry;
      positions[idx + 2] = rz;
      // Vertex 2 (angled backwards for monsoon wind slant)
      positions[idx + 3] = rx + 0.1;
      positions[idx + 4] = ry - streakLength;
      positions[idx + 5] = rz - 0.4;
    }

    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const rainMat = new THREE.LineBasicMaterial({
      color: CONFIG.COLORS.RAIN,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending
    });

    this.rainLines = new THREE.LineSegments(rainGeo, rainMat);
    this.scene.add(this.rainLines);
  }

  update(dt, playerPos, onCollectCell) {
    // 1. Animate Collectibles (Rotation and Floating Bob)
    const time = performance.now() * 0.001;
    this.cellObjects.forEach((cell) => {
      if (cell.isCollected) return;

      // Rotation
      cell.core.rotation.y = time * 2.5;
      cell.core.rotation.x = time * 1.5;
      cell.halo.rotation.z = time * 3.0;
      cell.halo2.rotation.y = time * 2.0;

      // Gentle vertical floating bob
      cell.group.position.y = cell.baseY + Math.sin(time * 3.0 + cell.data.id) * 0.18;

      // Check Collection overlap with player
      const dx = playerPos.x - cell.data.x;
      const dy = playerPos.y + 0.9 - cell.group.position.y; // check against player center
      const dz = playerPos.z - cell.data.z;
      const distSq = dx * dx + dy * dy + dz * dz;

      // Generous collection radius of 1.4m
      if (distSq < 1.4 * 1.4) {
        cell.isCollected = true;
        cell.group.visible = false;
        if (onCollectCell) onCollectCell(cell.data.id);
      }
    });

    // 2. Update Rain System (Continuous slanting monsoon rain centered around player)
    if (this.rainLines) {
      const positions = this.rainLines.geometry.attributes.position.array;
      const rainRangeX = 70;
      const rainRangeY = 40;
      const rainRangeZ = 90;
      const streakLength = 1.4;

      for (let i = 0; i < this.rainData.length; i++) {
        const drop = this.rainData[i];
        drop.y -= drop.speed * dt;
        drop.z -= (CONFIG.SPEED_FORWARD * 0.3) * dt; // Wind resistance

        // Recycle drop relative to player position
        if (drop.y < playerPos.y - 10.0 || Math.abs(drop.z - playerPos.z) > rainRangeZ * 0.55 || Math.abs(drop.x - playerPos.x) > rainRangeX * 0.55) {
          drop.y = playerPos.y + rainRangeY * 0.8;
          drop.x = playerPos.x + (Math.random() - 0.5) * rainRangeX;
          drop.z = playerPos.z + (Math.random() - 0.5) * rainRangeZ;
        }

        const idx = i * 6;
        positions[idx] = drop.x;
        positions[idx + 1] = drop.y;
        positions[idx + 2] = drop.z;

        positions[idx + 3] = drop.x + 0.15;
        positions[idx + 4] = drop.y - streakLength;
        positions[idx + 5] = drop.z - 0.5;
      }
      this.rainLines.geometry.attributes.position.needsUpdate = true;
    }

    // 3. Move directional light with player
    this.dirLight.position.set(playerPos.x + 15, playerPos.y + 35, playerPos.z + 25);
    this.dirLight.target.position.set(playerPos.x, playerPos.y, playerPos.z + 10);
    this.lightningLight.position.set(playerPos.x - 10, playerPos.y + 50, playerPos.z + 30);

    // 4. Lightning and Thunder Simulation
    this.lightningTimer -= dt;
    if (this.lightningTimer <= 0) {
      this.lightningTimer = 8.0 + Math.random() * 8.0;
      this.lightningDuration = 0.18;
      sound.playThunder();
    }

    if (this.lightningDuration > 0) {
      this.lightningDuration -= dt;
      const intensity = Math.sin((this.lightningDuration / 0.18) * Math.PI) * 4.0;
      this.lightningLight.intensity = Math.max(0, intensity);
      this.hemiLight.intensity = 2.0 + Math.max(0, intensity * 0.5);
    } else {
      this.lightningLight.intensity = 0;
      this.hemiLight.intensity = 2.0;
    }
  }

  resetCollectibles() {
    this.cellObjects.forEach((cell) => {
      cell.isCollected = false;
      cell.group.visible = true;
      cell.group.position.y = cell.baseY;
    });
  }
}
