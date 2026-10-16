import { Game } from './game.js';
import { StormlineGame } from './stormline.js';

window.addEventListener('DOMContentLoaded', () => {
  const options = new URLSearchParams(window.location.search);
  if (options.get('mode') !== 'classic' && !options.has('line')) {
    window.stormlineGame = new StormlineGame();
    return;
  }
  document.title = 'Monsoon Rooftops — Classic Runner';
  const container = document.getElementById('game-container');
  if (container) {
    window.gameInstance = new Game(container);
  }
});
