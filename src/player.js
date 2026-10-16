import * as THREE from 'three';
import { CONFIG } from './constants.js';
import { sound } from './audio.js';

export class Player {
  constructor(scene) {
    this.scene = scene;

    // State
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.velY = 0;
    this.velZ = CONFIG.SPEED_FORWARD;

    this.isGrounded = true;
    this.jumpHeld = false;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.currentPlatform = null;
    this.runAnimTime = 0;

    // Visual Mesh Group
    this.group = new THREE.Group();
    this.buildCharacterMesh();
    this.scene.add(this.group);

    this.reset();
  }

  buildCharacterMesh() {
    // Stylized Cyberpunk Courier
    const bodyMat = new THREE.MeshStandardMaterial({
      color: CONFIG.COLORS.PLAYER_BODY,
      roughness: 0.4,
      metalness: 0.6
    });

    const visorMat = new THREE.MeshBasicMaterial({
      color: CONFIG.COLORS.PLAYER_VISOR
    });

    const accentMat = new THREE.MeshStandardMaterial({
      color: CONFIG.COLORS.PLAYER_ACCENT,
      roughness: 0.3,
      metalness: 0.7
    });

    // Torso / Jacket
    const torsoGeo = new THREE.CapsuleGeometry(0.38, 0.65, 8, 16);
    this.torso = new THREE.Mesh(torsoGeo, bodyMat);
    this.torso.position.y = 1.05;
    this.group.add(this.torso);

    // Visor / Helmet
    const headGeo = new THREE.BoxGeometry(0.48, 0.35, 0.45);
    this.head = new THREE.Mesh(headGeo, bodyMat);
    this.head.position.set(0, 1.48, 0.05);
    this.group.add(this.head);

    const visorGeo = new THREE.BoxGeometry(0.44, 0.12, 0.1);
    this.visor = new THREE.Mesh(visorGeo, visorMat);
    this.visor.position.set(0, 1.5, 0.28);
    this.group.add(this.visor);

    // Battery Backpack with glowing energy cell
    const packGeo = new THREE.BoxGeometry(0.42, 0.55, 0.25);
    this.pack = new THREE.Mesh(packGeo, accentMat);
    this.pack.position.set(0, 1.1, -0.32);
    this.group.add(this.pack);

    // Backpack neon light strip
    const stripGeo = new THREE.BoxGeometry(0.12, 0.4, 0.04);
    const stripMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const strip = new THREE.Mesh(stripGeo, stripMat);
    strip.position.set(0, 1.1, -0.46);
    this.group.add(strip);

    // Left & Right legs for running animation
    const legGeo = new THREE.BoxGeometry(0.18, 0.6, 0.2);
    this.leftLeg = new THREE.Mesh(legGeo, bodyMat);
    this.leftLeg.position.set(-0.2, 0.4, 0);
    this.group.add(this.leftLeg);

    this.rightLeg = new THREE.Mesh(legGeo, bodyMat);
    this.rightLeg.position.set(0.2, 0.4, 0);
    this.group.add(this.rightLeg);

    // Small jet glow at feet
    const jetGeo = new THREE.CylinderGeometry(0.08, 0.15, 0.1, 8);
    const jetMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
    this.leftJet = new THREE.Mesh(jetGeo, jetMat);
    this.leftJet.position.set(-0.2, 0.05, 0);
    this.group.add(this.leftJet);

    this.rightJet = new THREE.Mesh(jetGeo, jetMat);
    this.rightJet.position.set(0.2, 0.05, 0);
    this.group.add(this.rightJet);
  }

  reset() {
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.velY = 0;
    this.velZ = CONFIG.SPEED_FORWARD;
    this.isGrounded = true;
    this.jumpHeld = false;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.currentPlatform = null;
    this.runAnimTime = 0;

    this.updateMeshTransform();
  }

  requestJump() {
    if (this.jumpHeld) return; // Holding jump must NOT trigger repeated jumps
    this.jumpHeld = true;

    if (this.isGrounded || this.coyoteTimer > 0) {
      this.executeJump();
    } else {
      // Buffer jump input for landing
      this.jumpBufferTimer = CONFIG.JUMP_BUFFER_TIME;
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
    sound.playJump();
  }

  update(dt, platforms, onFall) {
    // Clamp frame delta for numerical stability
    dt = Math.min(dt, CONFIG.MAX_FRAME_DELTA);

    // Update jump buffer timer
    if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer -= dt;
      if (this.jumpBufferTimer < 0) this.jumpBufferTimer = 0;
    }

    // Update coyote timer
    if (!this.isGrounded && this.coyoteTimer > 0) {
      this.coyoteTimer -= dt;
      if (this.coyoteTimer < 0) this.coyoteTimer = 0;
    }

    const prevY = this.y;
    const prevZ = this.z;

    // Integrate forward motion
    this.z += this.velZ * dt;

    // Apply gravity
    this.velY += CONFIG.GRAVITY * dt;
    let candidateY = this.y + this.velY * dt;

    // Collision detection against platforms
    // A landing occurs ONLY when the player crosses a rooftop’s top surface while descending.
    let landed = false;
    const playerRadius = CONFIG.PLAYER_RADIUS;

    for (let i = 0; i < platforms.length; i++) {
      const p = platforms[i];

      // Check for horizontal wall impact against building front face if below roof surface
      const halfW = p.width * 0.5;
      const inXBounds = this.x >= p.x - halfW - playerRadius * 0.5 && this.x <= p.x + halfW + playerRadius * 0.5;

      if (inXBounds && candidateY < p.topY - 0.2) {
        const wallZ = p.zStart - playerRadius * 0.35;
        if (this.z >= wallZ && prevZ < p.zStart + 1.0) {
          // Player impacted the building's vertical wall face
          this.z = wallZ;
          this.velZ = 0;
        }
      }

      if (this.velY <= 0) {
        // Z bounds: allow landing as front foot reaches start, up until back of platform
        if (this.z < p.zStart - playerRadius * 0.5 || this.z > p.zEnd) {
          continue;
        }

        if (!inXBounds) {
          continue;
        }

        // Descending check:
        // Must have been at or above top surface in previous frame
        // and candidate Y crosses onto or below top surface
        if (prevY >= p.topY - 0.15 && candidateY <= p.topY + 0.1) {
          candidateY = p.topY;
          this.velY = 0;
          landed = true;
          this.currentPlatform = p;

          if (!this.isGrounded) {
            // Player just touched down
            sound.playLand();
          }

          this.isGrounded = true;
          this.coyoteTimer = CONFIG.COYOTE_TIME;

          // Check if a jump was buffered right before landing
          if (this.jumpBufferTimer > 0) {
            this.executeJump();
          }
          break;
        }
      }
    }

    if (!landed) {
      if (this.isGrounded) {
        // Player stepped off an edge
        this.isGrounded = false;
        this.coyoteTimer = CONFIG.COYOTE_TIME;
      }
    }

    this.y = candidateY;

    // Check Fall / Game Over
    if (this.y < CONFIG.FALL_LIMIT_Y) {
      if (onFall) onFall();
    }

    // Animate runner limbs
    this.animate(dt);
    this.updateMeshTransform();
  }

  animate(dt) {
    if (this.isGrounded) {
      this.runAnimTime += dt * 18.0;
      const legSwing = Math.sin(this.runAnimTime) * 0.45;
      this.leftLeg.rotation.x = legSwing;
      this.rightLeg.rotation.x = -legSwing;
      this.torso.position.y = 1.05 + Math.abs(Math.sin(this.runAnimTime * 2)) * 0.06;
      this.group.rotation.x = 0.08; // Lean slightly forward while sprinting
    } else {
      // Airborne tuck pose
      this.leftLeg.rotation.x = -0.3;
      this.rightLeg.rotation.x = 0.4;
      this.torso.position.y = 1.05;
      this.group.rotation.x = this.velY > 0 ? 0.02 : 0.12;
    }
  }

  updateMeshTransform() {
    this.group.position.set(this.x, this.y, this.z);
  }

  dispose() {
    this.scene.remove(this.group);
  }
}
