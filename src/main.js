import { Game } from './game.js';

window.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('game-container');
  if (container) {
    window.gameInstance = new Game(container);
  }
});
