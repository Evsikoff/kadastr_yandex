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

const markLoadingScreenAsHidden = () => {
  console.log('Завершён показ загрузочного экрана.');
  void YandexService.markLoadingScreenHidden();
};

window.addEventListener('game-loading-screen-hidden', markLoadingScreenAsHidden);

const loadingScreenElement = document.getElementById('loading-screen');
if (!loadingScreenElement || loadingScreenElement.classList.contains('hidden')) {
  markLoadingScreenAsHidden();
}

// Блокировка контекстного меню
window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
});

// Отслеживание изменения ориентации экрана на мобильных устройствах
if (isMobileDevice) {
  let currentOrientation = window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';

  window.addEventListener('resize', () => {
    const newOrientation = window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';

    // Если ориентация изменилась, перезагружаем страницу
    if (newOrientation !== currentOrientation) {
      currentOrientation = newOrientation;
      window.location.reload();
    }
  });
}

const game = new Phaser.Game(config);
