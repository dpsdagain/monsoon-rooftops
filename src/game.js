import * as THREE from 'three';
import { CONFIG } from './constants.js';
import { PLATFORMS_DATA } from './level.js';
import { Player } from './player.js';
import { Environment } from './environment.js';
import { UIManager } from './ui.js';
import { sound } from './audio.js';
import { applyLanding, buildResult, classifyMargin, createRun, formatScore, readChallenge, totalScore } from './score.js';
import { loadBest, saveBest } from './records.js';

export const GAME_STATE = {
  START: 'START',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  GAMEOVER: 'GAMEOVER',
  VICTORY: 'VICTORY'
};

export class Game {
  constructor(canvasContainer) {
    this.container = canvasContainer;
    this.state = GAME_STATE.START;

    this.runTime = 0;
    this.collectedCellsCount = 0;
    this.totalCellsCount = CONFIG.TOTAL_CELLS;
    this.run = createRun();
    this.challenge = readChallenge(typeof window !== 'undefined' ? window.location.search : '');
    this.lastFrameTime = performance.now();

    // 1. Scene, Camera, Renderer
    this.scene = new THREE.Scene();
    
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      600
    );

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    // Limit pixel ratio on high-DPI screens for smooth performance
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);

    // 2. Systems
    this.environment = new Environment(this.scene);
    this.player = new Player(this.scene);

    this.ui = new UIManager({
      onStart: () => this.startGame(),
      onResume: () => this.resumeGame(),
      onRestart: () => this.restartGame(),
      onPause: () => this.pauseGame(),
      onJumpDown: () => this.handleJumpDown(),
      onJumpUp: () => this.handleJumpUp()
    });
    this.ui.setPrelude(loadBest(), this.challenge);

    // 3. Setup Listeners
    this.setupInputs();
    this.setupWindowListeners();

    // Initial camera placement
    this.updateCamera(0.016, true);
    this.ui.showStartScreen();

    // 4. Start Render Loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  setupInputs() {
    // Keyboard inputs
    window.addEventListener('keydown', (e) => {
      const tag = e.target && e.target.tagName;
      const onControl = tag === 'BUTTON' || tag === 'A' || tag === 'INPUT';
      if (e.code === 'Space') {
        if (onControl) return;
        e.preventDefault();
        if (this.state === GAME_STATE.PLAYING) {
          this.handleJumpDown();
        } else if (this.state === GAME_STATE.START) {
          sound.init();
          this.startGame();
          this.player.jumpHeld = true; // Prevent jump on launch frame
        } else if (this.state === GAME_STATE.GAMEOVER || this.state === GAME_STATE.VICTORY) {
          this.restartGame();
          this.player.jumpHeld = true;
        } else if (this.state === GAME_STATE.PAUSED) {
          this.resumeGame();
        }
      } else if (e.code === 'Enter') {
        if (onControl) return;
        if (this.state === GAME_STATE.START) {
          sound.init();
          this.startGame();
        } else if (this.state === GAME_STATE.GAMEOVER || this.state === GAME_STATE.VICTORY) {
          this.restartGame();
        } else if (this.state === GAME_STATE.PAUSED) {
          this.resumeGame();
        }
      } else if (e.code === 'KeyP' || e.code === 'Escape') {
        if (this.state === GAME_STATE.PLAYING) {
          this.pauseGame();
        } else if (this.state === GAME_STATE.PAUSED) {
          this.resumeGame();
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.handleJumpUp();
      }
    });

    // Canvas click / pointer inputs for desktop
    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      if (this.state === GAME_STATE.PLAYING) {
        this.handleJumpDown();
      }
    });

    // Mobile touch inputs directly on canvas
    dom.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (this.state === GAME_STATE.PLAYING) {
        this.handleJumpDown();
      }
    }, { passive: false });

    dom.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.handleJumpUp();
    }, { passive: false });

    dom.addEventListener('touchcancel', (e) => {
      e.preventDefault();
      this.handleJumpUp();
    }, { passive: false });

    dom.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

    // Catch pointer / touch releases anywhere in window to prevent stuck jump keys
    window.addEventListener('pointerup', () => this.handleJumpUp());
    window.addEventListener('pointercancel', () => this.handleJumpUp());
    window.addEventListener('mouseup', () => this.handleJumpUp());
    window.addEventListener('touchend', () => this.handleJumpUp());

    // Prevent context menu from hijacking game controls
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  setupWindowListeners() {
    // Window Resize
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    });

    // Tab blur / visibility loss
    window.addEventListener('blur', () => {
      if (this.state === GAME_STATE.PLAYING) {
        this.pauseGame();
      }
      sound.pause();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.state === GAME_STATE.PLAYING) {
          this.pauseGame();
        }
        sound.pause();
      } else {
        if (this.state === GAME_STATE.PLAYING) {
          sound.resume();
        }
      }
    });
  }

  handleJumpDown() {
    // Gameplay inputs are disabled when menus are active
    if (this.state !== GAME_STATE.PLAYING) return;
    this.player.requestJump();
  }

  handleJumpUp() {
    this.player.releaseJump();
  }

  startGame() {
    this.state = GAME_STATE.PLAYING;
    this.runTime = 0;
    this.collectedCellsCount = 0;
    this.run = createRun();
    this.player.reset();
    this.environment.resetCollectibles();
    this.ui.hideAllModals();
    this.pushHUD();
    this.lastFrameTime = null;
    sound.resume();
  }

  pauseGame() {
    if (this.state !== GAME_STATE.PLAYING) return;
    this.state = GAME_STATE.PAUSED;
    sound.pause();
    this.ui.showPauseScreen();
  }

  resumeGame() {
    if (this.state !== GAME_STATE.PAUSED) return;
    this.state = GAME_STATE.PLAYING;
    sound.resume();
    this.ui.hideAllModals();
    this.lastFrameTime = null;
  }

  restartGame() {
    this.startGame();
  }

  onFall() {
    if (this.state !== GAME_STATE.PLAYING) return;
    this.state = GAME_STATE.GAMEOVER;
    sound.playGameOver();
    const result = this.finishRun(false);
    this.pushHUD(result.score);
    this.ui.showGameOver(result);
  }

  onVictory() {
    if (this.state !== GAME_STATE.PLAYING) return;
    this.state = GAME_STATE.VICTORY;
    sound.playVictory();
    const result = this.finishRun(true);
    this.pushHUD(result.score);
    this.ui.showVictory(result);
  }

  onGapLand(gap) {
    if (this.state !== GAME_STATE.PLAYING) return;
    const kind = classifyMargin(gap.margin);
    const before = this.run.landingPoints;
    this.run = applyLanding(this.run, kind);
    if (kind === 'razor') {
      sound.playRazor();
      this.ui.flashSkill(`RAZOR +${formatScore(this.run.landingPoints - before)}`);
    }
    this.pushHUD();
  }

  liveScore() {
    return totalScore({
      distance: this.player.z,
      cells: this.collectedCellsCount,
      landingPoints: this.run.landingPoints,
      victory: false,
    });
  }

  hudExtras() {
    return {
      score: this.liveScore(),
      chain: this.run.chain,
      razors: this.run.razors,
      rivalScore: this.challenge ? this.challenge.score : null,
    };
  }

  pushHUD(scoreOverride) {
    const extras = this.hudExtras();
    if (scoreOverride != null) extras.score = scoreOverride;
    this.ui.updateHUD(
      this.player.z,
      CONFIG.FINISH_Z,
      this.runTime,
      this.collectedCellsCount,
      this.totalCellsCount,
      extras
    );
  }

  finishRun(victory) {
    const prev = loadBest();
    const result = buildResult({
      distance: victory ? CONFIG.FINISH_Z : this.player.z,
      timeSeconds: this.runTime,
      cells: this.collectedCellsCount,
      totalCells: this.totalCellsCount,
      run: this.run,
      victory,
      rival: this.challenge,
      bestScore: prev ? prev.score : null,
    });
    saveBest(result);
    this.ui.setPrelude(loadBest(), this.challenge);
    return result;
  }

  onCollectCell(cellId) {
    this.collectedCellsCount++;
    sound.playCellPickup(this.collectedCellsCount);
    this.pushHUD();
  }

  updateCamera(dt, instant = false) {
    const targetCamX = this.player.x + CONFIG.CAMERA_OFFSET.x;
    const targetCamY = Math.max(this.player.y, -2.0) + CONFIG.CAMERA_OFFSET.y;
    const targetCamZ = this.player.z + CONFIG.CAMERA_OFFSET.z;

    if (instant) {
      this.camera.position.set(targetCamX, targetCamY, targetCamZ);
    } else {
      const lerp = 1.0 - Math.exp(-12.0 * Math.min(dt || 0.016, 0.05));
      this.camera.position.x += (targetCamX - this.camera.position.x) * lerp;
      this.camera.position.y += (targetCamY - this.camera.position.y) * lerp;
      this.camera.position.z += (targetCamZ - this.camera.position.z) * lerp;
    }

    const lookAtX = this.player.x + CONFIG.CAMERA_LOOK_OFFSET.x;
    const lookAtY = Math.max(this.player.y, -2.0) + CONFIG.CAMERA_LOOK_OFFSET.y;
    const lookAtZ = this.player.z + CONFIG.CAMERA_LOOK_OFFSET.z;

    this.camera.lookAt(lookAtX, lookAtY, lookAtZ);
  }

  animate(currentTime) {
    requestAnimationFrame(this.animate);

    let rawDt = 0.016;
    if (this.lastFrameTime) {
      rawDt = (currentTime - this.lastFrameTime) * 0.001;
    }
    this.lastFrameTime = currentTime;

    // Guard against negative dt (e.g. clock jitter or rAF timestamp offset) or NaN
    if (rawDt <= 0 || isNaN(rawDt)) {
      rawDt = 0.016;
    }

    // Cap frame delta for tab switching or hiccups
    const dt = Math.min(rawDt, CONFIG.MAX_FRAME_DELTA);

    if (this.state === GAME_STATE.PLAYING) {
      this.runTime += dt;

      // Update Player Physics
      this.player.update(dt, PLATFORMS_DATA, () => this.onFall(), (gap) => this.onGapLand(gap));

      // Update Environment (rain, collectibles bobbing, lightning)
      this.environment.update(dt, this.player, (cellId) => this.onCollectCell(cellId));

      // Update Camera follow with frame-rate independent tracking
      this.updateCamera(dt);

      // Update HUD
      this.pushHUD();

      // Check Victory Condition
      if (this.player.z >= CONFIG.FINISH_Z) {
        this.onVictory();
      }
    } else {
      // In menu / paused / gameover, keep gentle rain and camera steady
      this.environment.update(dt * 0.5, this.player);
      this.updateCamera(dt * 0.5);
    }

    this.renderer.render(this.scene, this.camera);
  }
}
