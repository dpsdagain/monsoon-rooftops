import { sound } from './audio.js';

export class UIManager {
  constructor(callbacks) {
    this.callbacks = callbacks; // onStart, onResume, onRestart, onToggleMute

    // UI Elements
    this.startOverlay = document.getElementById('start-overlay');
    this.pauseOverlay = document.getElementById('pause-overlay');
    this.gameoverOverlay = document.getElementById('gameover-overlay');
    this.victoryOverlay = document.getElementById('victory-overlay');

    this.hudDistance = document.getElementById('hud-distance');
    this.hudProgressBar = document.getElementById('hud-progress-fill');
    this.hudTimer = document.getElementById('hud-timer');
    this.cellIcons = [
      document.getElementById('cell-1'),
      document.getElementById('cell-2'),
      document.getElementById('cell-3'),
      document.getElementById('cell-4'),
      document.getElementById('cell-5')
    ];

    this.btnMute = document.getElementById('btn-mute');
    this.btnPause = document.getElementById('btn-pause');
    this.btnMobileJump = document.getElementById('btn-mobile-jump');

    // Setup Listeners
    this.setupListeners();
    this.updateMuteButtonVisual();
  }

  setupListeners() {
    // Start Button
    const btnStart = document.getElementById('btn-start');
    if (btnStart) {
      btnStart.addEventListener('click', (e) => {
        e.stopPropagation();
        sound.init();
        if (this.callbacks.onStart) this.callbacks.onStart();
      });
    }

    // Resume Button
    const btnResume = document.getElementById('btn-resume');
    if (btnResume) {
      btnResume.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.callbacks.onResume) this.callbacks.onResume();
      });
    }

    // Pause Restart Button
    const btnPauseRestart = document.getElementById('btn-pause-restart');
    if (btnPauseRestart) {
      btnPauseRestart.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.callbacks.onRestart) this.callbacks.onRestart();
      });
    }

    // Game Over Restart Button
    const btnRestartFail = document.getElementById('btn-restart-fail');
    if (btnRestartFail) {
      btnRestartFail.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.callbacks.onRestart) this.callbacks.onRestart();
      });
    }

    // Victory Restart Button
    const btnRestartWin = document.getElementById('btn-restart-win');
    if (btnRestartWin) {
      btnRestartWin.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.callbacks.onRestart) this.callbacks.onRestart();
      });
    }

    // Mute Button
    if (this.btnMute) {
      this.btnMute.addEventListener('click', (e) => {
        e.stopPropagation();
        const muted = sound.toggleMute();
        this.updateMuteButtonVisual();
      });
    }

    // Pause Button in HUD
    if (this.btnPause) {
      this.btnPause.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.callbacks.onPause) this.callbacks.onPause();
      });
    }

    // Mobile Jump Button Touch Listeners
    if (this.btnMobileJump) {
      const handleJumpDown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.callbacks.onJumpDown) this.callbacks.onJumpDown();
      };

      const handleJumpUp = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.callbacks.onJumpUp) this.callbacks.onJumpUp();
      };

      this.btnMobileJump.addEventListener('touchstart', handleJumpDown, { passive: false });
      this.btnMobileJump.addEventListener('touchend', handleJumpUp, { passive: false });
      this.btnMobileJump.addEventListener('touchcancel', handleJumpUp, { passive: false });
      this.btnMobileJump.addEventListener('mousedown', handleJumpDown);
      this.btnMobileJump.addEventListener('mouseup', handleJumpUp);
    }
  }

  updateMuteButtonVisual() {
    if (!this.btnMute) return;
    this.btnMute.innerHTML = sound.isMuted ? '🔇' : '🔊';
    this.btnMute.setAttribute('aria-label', sound.isMuted ? 'Unmute Audio' : 'Mute Audio');
  }

  updateHUD(distance, maxDistance, timeSeconds, collectedCells, totalCells) {
    // Distance
    const distClamped = Math.min(Math.max(0, distance), maxDistance);
    if (this.hudDistance) {
      this.hudDistance.textContent = `${Math.floor(distClamped)}m / ${Math.floor(maxDistance)}m`;
    }

    // Progress Bar
    if (this.hudProgressBar) {
      const pct = (distClamped / maxDistance) * 100;
      this.hudProgressBar.style.width = `${pct}%`;
    }

    // Timer (mm:ss.s)
    if (this.hudTimer) {
      const mins = Math.floor(timeSeconds / 60);
      const secs = (timeSeconds % 60).toFixed(1);
      const padSecs = secs < 10 ? `0${secs}` : secs;
      this.hudTimer.textContent = `${mins < 10 ? '0' : ''}${mins}:${padSecs}`;
    }

    // Cells icons
    for (let i = 0; i < this.cellIcons.length; i++) {
      const icon = this.cellIcons[i];
      if (icon) {
        if (i < collectedCells) {
          icon.classList.add('active');
        } else {
          icon.classList.remove('active');
        }
      }
    }
  }

  showStartScreen() {
    this.hideAllModals();
    if (this.startOverlay) {
      this.startOverlay.classList.remove('hidden');
      const btn = document.getElementById('btn-start');
      if (btn) btn.focus();
    }
  }

  showPauseScreen() {
    this.hideAllModals();
    if (this.pauseOverlay) {
      this.pauseOverlay.classList.remove('hidden');
      const btn = document.getElementById('btn-resume');
      if (btn) btn.focus();
    }
  }

  showGameOver(distance, timeSeconds, cellsCount, totalCells) {
    this.hideAllModals();
    const statsDist = document.getElementById('fail-dist');
    const statsTime = document.getElementById('fail-time');
    const statsCells = document.getElementById('fail-cells');

    if (statsDist) statsDist.textContent = `${Math.floor(distance)}m`;
    if (statsTime) statsTime.textContent = `${timeSeconds.toFixed(1)}s`;
    if (statsCells) statsCells.textContent = `${cellsCount} / ${totalCells}`;

    if (this.gameoverOverlay) {
      this.gameoverOverlay.classList.remove('hidden');
      const btn = document.getElementById('btn-restart-fail');
      if (btn) btn.focus();
    }
  }

  showVictory(timeSeconds, cellsCount, totalCells, distance) {
    this.hideAllModals();
    const statsTime = document.getElementById('win-time');
    const statsCells = document.getElementById('win-cells');
    const statsDist = document.getElementById('win-dist');
    const statsRank = document.getElementById('win-rank');

    if (statsTime) statsTime.textContent = `${timeSeconds.toFixed(2)}s`;
    if (statsCells) statsCells.textContent = `${cellsCount} / ${totalCells}`;
    if (statsDist) statsDist.textContent = `${Math.floor(distance)}m`;

    if (statsRank) {
      if (cellsCount === 5) {
        statsRank.textContent = "RANK: S (OVERCHARGED COURIER)";
        statsRank.className = "rank-badge rank-s";
      } else if (cellsCount >= 3) {
        statsRank.textContent = "RANK: A (VETERAN RUNNER)";
        statsRank.className = "rank-badge rank-a";
      } else {
        statsRank.textContent = "RANK: B (SURVIVOR)";
        statsRank.className = "rank-badge rank-b";
      }
    }

    if (this.victoryOverlay) {
      this.victoryOverlay.classList.remove('hidden');
      const btn = document.getElementById('btn-restart-win');
      if (btn) btn.focus();
    }
  }

  hideAllModals() {
    if (this.startOverlay) this.startOverlay.classList.add('hidden');
    if (this.pauseOverlay) this.pauseOverlay.classList.add('hidden');
    if (this.gameoverOverlay) this.gameoverOverlay.classList.add('hidden');
    if (this.victoryOverlay) this.victoryOverlay.classList.add('hidden');
  }
}
