import Phaser from 'phaser';
import GameScene from './scenes/GameScene.js';
import WinScene from './scenes/WinScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 1920,
  height: 1080,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [GameScene, WinScene],
  backgroundColor: '#1a1a2e',
  pixelArt: false,
  antialias: true
};

// Блокировка контекстного меню
window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
});

const game = new Phaser.Game(config);
