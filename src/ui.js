import { sound } from './audio.js';
import { describeBest, describeLine, formatScore, resultNote } from './score.js';
import { downloadShareCard, initialShareStatus, shareRun } from './share.js';

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
    this.hudScore = document.getElementById('hud-score');
    this.hudFlow = document.getElementById('hud-flow');
    this.hudRival = document.getElementById('hud-rival');
    this.skillPopup = document.getElementById('skill-popup');
    this.bestLine = document.getElementById('best-line');
    this.challengeLine = document.getElementById('challenge-line');
    this.btnStart = document.getElementById('btn-start');
    this.lastResult = null;
    this.best = null;
    this.challenge = null;

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

    const onShare = (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.shareLastResult();
    };
    const onSaveCard = (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (!this.lastResult) return;
      downloadShareCard(this.lastResult);
    };
    for (const id of ['btn-share-win', 'btn-share-fail']) {
      const btn = document.getElementById(id);
      if (btn) btn.addEventListener('click', onShare);
    }
    for (const id of ['btn-card-win', 'btn-card-fail']) {
      const btn = document.getElementById(id);
      if (btn) btn.addEventListener('click', onSaveCard);
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

  setPrelude(best, challenge) {
    this.best = best;
    this.challenge = challenge;
    if (this.bestLine) this.bestLine.textContent = describeBest(best);
    if (this.challengeLine) {
      if (challenge) {
        this.challengeLine.textContent = `LINE TO BEAT · ${describeLine(challenge)}`;
        this.challengeLine.classList.remove('hidden');
      } else {
        this.challengeLine.textContent = '';
        this.challengeLine.classList.add('hidden');
      }
    }
    if (this.btnStart) {
      this.btnStart.textContent = challenge ? 'CHASE THE LINE' : 'LAUNCH RUN';
    }
  }

  flashSkill(text) {
    const el = this.skillPopup;
    if (!el) return;
    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  setStatus(message) {
    for (const id of ['win-status', 'fail-status']) {
      const el = document.getElementById(id);
      const overlay = el && el.closest('.overlay');
      if (el && overlay && !overlay.classList.contains('hidden')) {
        el.textContent = message;
        el.classList.remove('hidden');
      }
    }
  }

  presentResult(result, prefix) {
    this.lastResult = result;
    const scoreEl = document.getElementById(`${prefix}-score`);
    const noteEl = document.getElementById(`${prefix}-note`);
    const razorEl = document.getElementById(`${prefix}-razors`);
    const statusEl = document.getElementById(`${prefix}-status`);
    if (scoreEl) scoreEl.textContent = formatScore(result.score);
    if (noteEl) noteEl.textContent = resultNote(result);
    if (razorEl) razorEl.textContent = String(result.razors);
    if (statusEl) {
      statusEl.textContent = initialShareStatus(window.location.hostname);
      statusEl.classList.remove('hidden');
    }
  }

  async shareLastResult() {
    if (!this.lastResult) return;
    const outcome = await shareRun(this.lastResult);
    if (outcome.status === 'copy') {
      const full = `${outcome.text}\n${outcome.url}`;
      try {
        await navigator.clipboard.writeText(full);
        this.setStatus('Copied. Paste it into a post on X.');
      } catch (e) {
        this.setStatus(full);
      }
    }
  }

  updateHUD(distance, maxDistance, timeSeconds, collectedCells, totalCells, extras = {}) {
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

    if (this.hudScore) this.hudScore.textContent = formatScore(extras.score || 0);

    if (this.hudFlow) {
      const chain = extras.chain || 0;
      const razors = extras.razors || 0;
      const label = razors === 1 ? 'RAZOR' : 'RAZORS';
      this.hudFlow.textContent = `x${chain} · ${razors} ${label}`;
    }

    if (this.hudRival) {
      if (extras.rivalScore == null) {
        this.hudRival.classList.add('hidden');
      } else {
        const delta = (extras.score || 0) - extras.rivalScore;
        const ahead = delta >= 0;
        this.hudRival.classList.remove('hidden');
        this.hudRival.classList.toggle('ahead', ahead);
        this.hudRival.classList.toggle('behind', !ahead);
        const word = ahead ? 'AHEAD' : 'BEHIND';
        this.hudRival.textContent = `${word} ${formatScore(Math.abs(delta))} · LINE ${formatScore(extras.rivalScore)}`;
      }
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

  showGameOver(result) {
    this.hideAllModals();
    this.presentResult(result, 'fail');
    const statsDist = document.getElementById('fail-dist');
    const statsCells = document.getElementById('fail-cells');

    if (statsDist) statsDist.textContent = `${Math.floor(result.distance)}m`;
    if (statsCells) statsCells.textContent = `${result.cells} / ${result.totalCells}`;

    if (this.gameoverOverlay) {
      this.gameoverOverlay.classList.remove('hidden');
      const btn = document.getElementById('btn-restart-fail');
      if (btn) btn.focus();
    }
  }

  showVictory(result) {
    this.hideAllModals();
    this.presentResult(result, 'win');
    const statsTime = document.getElementById('win-time');
    const statsCells = document.getElementById('win-cells');
    const statsRank = document.getElementById('win-rank');

    if (statsTime) statsTime.textContent = `${result.timeSeconds.toFixed(2)}s`;
    if (statsCells) statsCells.textContent = `${result.cells} / ${result.totalCells}`;

    if (statsRank) {
      const rankClass = result.rank === 'S+' ? 'sp' : result.rank.toLowerCase();
      statsRank.textContent = `RANK ${result.rank} · ${result.title}`;
      statsRank.className = `rank-badge rank-${rankClass}`;
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
    if (this.skillPopup) {
      this.skillPopup.classList.remove('show');
      this.skillPopup.textContent = '';
    }
  }
}
