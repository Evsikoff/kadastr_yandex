import Phaser from 'phaser';
import GameScene from './scenes/GameScene.js';
import WinScene from './scenes/WinScene.js';
import { YandexService } from './utils/YandexService.js';

const MOBILE_PORTRAIT_SIZE = { width: 1080, height: 1920 };
const MOBILE_LANDSCAPE_SIZE = { width: 1920, height: 1080 };
const isMobileDevice = /android|iphone|ipad|ipod|windows phone|mobile/i.test(
  navigator.userAgent ?? ''
);

const getGameSize = () => {
  if (!isMobileDevice) {
    return { width: 1920, height: 1080 };
  }

  const isPortrait = window.innerHeight > window.innerWidth;
  return isPortrait ? MOBILE_PORTRAIT_SIZE : MOBILE_LANDSCAPE_SIZE;
};

const initialSize = getGameSize();

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: initialSize.width,
  height: initialSize.height,
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

void YandexService.init();

const game = new Phaser.Game(config);

if (isMobileDevice) {
  const handleResize = () => {
    const { width, height } = getGameSize();
    game.scale.resize(width, height);
  };

  window.addEventListener('resize', handleResize);
  window.addEventListener('orientationchange', handleResize);
}
