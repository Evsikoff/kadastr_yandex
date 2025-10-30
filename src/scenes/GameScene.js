import Phaser from 'phaser';
import { MapParser } from '../utils/MapParser.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    
    this.GRID_SIZE = 8;
    this.CELL_SIZE = 120;
    this.maps = [];
    this.currentMapIndex = 0;
    this.currentMap = null;
    this.grid = [];
    this.houses = [];
    this.blockedCells = new Set();
    this.hintCounter = 0;
    this.houseCount = 0;
  }

  preload() {
    // Загружаем файл с картами
    this.load.text('maps', '/maps/kadastrmapsmall.txt');
    
    // Загружаем заглушки для ассетов
    // В реальном проекте здесь будут реальные PNG файлы
    this.createPlaceholderAssets();
  }

  createPlaceholderAssets() {
    // Создаем заглушки для фонов ячеек (8 типов)
    const colors = [
      0x90EE90, // 0 - светло-зеленый
      0x87CEEB, // 1 - голубой
      0xFFB6C1, // 2 - розовый
      0xFFD700, // 3 - золотой
      0xDDA0DD, // 4 - сливовый
      0xF0E68C, // 5 - хаки
      0xFF6347, // 6 - томатный
      0x9370DB  // 7 - фиолетовый
    ];
    
    for (let i = 0; i < 8; i++) {
      const graphics = this.make.graphics({ x: 0, y: 0, add: false });
      graphics.fillStyle(colors[i], 1);
      graphics.fillRect(0, 0, this.CELL_SIZE, this.CELL_SIZE);
      graphics.generateTexture(`cell_${i}`, this.CELL_SIZE, this.CELL_SIZE);
      graphics.destroy();
    }
    
    // Создаем заборы
    const fenceGraphicsH = this.make.graphics({ x: 0, y: 0, add: false });
    fenceGraphicsH.fillStyle(0x8B4513, 1);
    fenceGraphicsH.fillRect(0, 0, this.CELL_SIZE, 8);
    fenceGraphicsH.generateTexture('fence_h', this.CELL_SIZE, 8);
    fenceGraphicsH.destroy();
    
    const fenceGraphicsV = this.make.graphics({ x: 0, y: 0, add: false });
    fenceGraphicsV.fillStyle(0x8B4513, 1);
    fenceGraphicsV.fillRect(0, 0, 8, this.CELL_SIZE);
    fenceGraphicsV.generateTexture('fence_v', 8, this.CELL_SIZE);
    fenceGraphicsV.destroy();
    
    // Создаем кадры анимации дома
    const houseColors = [0xCCCCCC, 0x999999, 0x666666, 0xFF0000];
    for (let i = 0; i < 4; i++) {
      const houseGraphics = this.make.graphics({ x: 0, y: 0, add: false });
      houseGraphics.fillStyle(houseColors[i], 1);
      houseGraphics.fillRect(20, 20, 80, 80);
      houseGraphics.generateTexture(`house_${i}`, this.CELL_SIZE, this.CELL_SIZE);
      houseGraphics.destroy();
    }
  }

  create() {
    // Парсим карты
    const mapData = this.cache.text.get('maps');
    this.maps = MapParser.parseMapFile(mapData);
    
    // Загружаем первую карту
    this.loadMap(0);
    
    // Создаем UI
    this.createUI();
  }

  loadMap(index) {
    // Очищаем предыдущую карту
    this.clearMap();
    
    this.currentMapIndex = index;
    this.currentMap = this.maps[index];
    this.hintCounter = 0;
    this.houseCount = 0;
    
    // Обновляем счетчик уровня
    if (this.levelText) {
      this.levelText.setText(`Уровень: ${index + 1}/${this.maps.length}`);
    }
    
    if (this.hintCounterText) {
      this.hintCounterText.setText(`Подсказки: ${this.hintCounter}`);
    }
    
    // Создаем сетку
    this.createGrid();
  }

  clearMap() {
    // Удаляем все объекты сетки
    if (this.gridContainer) {
      this.gridContainer.destroy();
    }
    
    this.grid = [];
    this.houses = [];
    this.blockedCells.clear();
  }

  createGrid() {
    this.gridContainer = this.add.container(0, 0);
    
    const startX = (1920 - this.GRID_SIZE * this.CELL_SIZE) / 2;
    const startY = (1080 - this.GRID_SIZE * this.CELL_SIZE) / 2 + 50;
    
    // Создаем ячейки
    for (let row = 0; row < this.GRID_SIZE; row++) {
      this.grid[row] = [];
      for (let col = 0; col < this.GRID_SIZE; col++) {
        const cellType = this.currentMap.regionMap[row][col];
        const x = startX + col * this.CELL_SIZE;
        const y = startY + row * this.CELL_SIZE;
        
        // Фон ячейки
        const cellBg = this.add.image(x, y, `cell_${cellType}`);
        cellBg.setOrigin(0, 0);
        
        // Контейнер для ячейки
        const cell = {
          row,
          col,
          type: cellType,
          x,
          y,
          bg: cellBg,
          house: null,
          xMark: null,
          interactive: this.add.rectangle(x, y, this.CELL_SIZE, this.CELL_SIZE, 0x000000, 0)
            .setOrigin(0, 0)
            .setInteractive({ useHandCursor: true })
        };
        
        cell.interactive.on('pointerdown', () => this.onCellClick(cell));
        
        this.grid[row][col] = cell;
        this.gridContainer.add([cellBg, cell.interactive]);
      }
    }
    
    // Рисуем границы и заборы
    this.drawBorders();
  }

  drawBorders() {
    const startX = (1920 - this.GRID_SIZE * this.CELL_SIZE) / 2;
    const startY = (1080 - this.GRID_SIZE * this.CELL_SIZE) / 2 + 50;
    
    // Горизонтальные границы
    for (let row = 0; row < this.GRID_SIZE - 1; row++) {
      for (let col = 0; col < this.GRID_SIZE; col++) {
        const currentType = this.currentMap.regionMap[row][col];
        const nextType = this.currentMap.regionMap[row + 1][col];
        
        const x = startX + col * this.CELL_SIZE;
        const y = startY + (row + 1) * this.CELL_SIZE;
        
        if (currentType === nextType) {
          // Полупрозрачная серая линия
          const line = this.add.rectangle(x, y - 2, this.CELL_SIZE, 4, 0x888888, 0.5);
          line.setOrigin(0, 0);
          this.gridContainer.add(line);
        } else {
          // Забор
          const fence = this.add.image(x, y - 4, 'fence_h');
          fence.setOrigin(0, 0);
          this.gridContainer.add(fence);
        }
      }
    }
    
    // Вертикальные границы
    for (let row = 0; row < this.GRID_SIZE; row++) {
      for (let col = 0; col < this.GRID_SIZE - 1; col++) {
        const currentType = this.currentMap.regionMap[row][col];
        const nextType = this.currentMap.regionMap[row][col + 1];
        
        const x = startX + (col + 1) * this.CELL_SIZE;
        const y = startY + row * this.CELL_SIZE;
        
        if (currentType === nextType) {
          // Полупрозрачная серая линия
          const line = this.add.rectangle(x - 2, y, 4, this.CELL_SIZE, 0x888888, 0.5);
          line.setOrigin(0, 0);
          this.gridContainer.add(line);
        } else {
          // Забор
          const fence = this.add.image(x - 4, y, 'fence_v');
          fence.setOrigin(0, 0);
          this.gridContainer.add(fence);
        }
      }
    }
  }

  createUI() {
    // Текст уровня
    this.levelText = this.add.text(50, 30, `Уровень: 1/${this.maps.length}`, {
      fontSize: '32px',
      color: '#ffffff',
      fontFamily: 'Arial'
    });
    
    // Счетчик подсказок
    this.hintCounterText = this.add.text(50, 80, `Подсказки: 0`, {
      fontSize: '28px',
      color: '#ffffff',
      fontFamily: 'Arial'
    });
    
    // Кнопка подсказки
    const hintButton = this.add.rectangle(1800, 60, 200, 60, 0x4CAF50)
      .setInteractive({ useHandCursor: true });
    
    const hintButtonText = this.add.text(1800, 60, 'Подсказка', {
      fontSize: '24px',
      color: '#ffffff',
      fontFamily: 'Arial'
    }).setOrigin(0.5);
    
    hintButton.on('pointerdown', () => this.useHint());
    hintButton.on('pointerover', () => hintButton.setFillStyle(0x45a049));
    hintButton.on('pointerout', () => hintButton.setFillStyle(0x4CAF50));
    
    // Счетчик домов
    this.houseCountText = this.add.text(50, 130, `Домов: 0/8`, {
      fontSize: '28px',
      color: '#ffffff',
      fontFamily: 'Arial'
    });
  }

  onCellClick(cell) {
    // Если в ячейке уже есть дом - удаляем его
    if (cell.house) {
      this.removeHouse(cell);
      return;
    }
    
    // Если ячейка заблокирована - показываем сообщение
    if (this.blockedCells.has(`${cell.row},${cell.col}`)) {
      this.showBlockedMessage();
      return;
    }
    
    // Строим дом
    this.buildHouse(cell);
  }

  buildHouse(cell) {
    // Анимация постройки дома
    const frames = ['house_0', 'house_1', 'house_2', 'house_3'];
    let frameIndex = 0;
    
    const house = this.add.image(cell.x, cell.y, frames[0]);
    house.setOrigin(0, 0);
    house.setAlpha(0);
    
    this.tweens.add({
      targets: house,
      alpha: 1,
      duration: 500,
      onComplete: () => {
        const frameTimer = this.time.addEvent({
          delay: 500,
          repeat: frames.length - 1,
          callback: () => {
            frameIndex++;
            if (frameIndex < frames.length) {
              house.setTexture(frames[frameIndex]);
            }
          }
        });
      }
    });
    
    cell.house = house;
    this.houses.push({ cell, house });
    this.gridContainer.add(house);
    
    this.houseCount++;
    this.updateHouseCount();
    
    // Добавляем заблокированные ячейки и X-метки
    this.time.delayedCall(2000, () => {
      this.addBlockedCells(cell);
    });
  }

  removeHouse(cell) {
    // Удаляем дом
    if (cell.house) {
      cell.house.destroy();
      cell.house = null;
    }
    
    // Удаляем из списка домов
    this.houses = this.houses.filter(h => h.cell !== cell);
    
    this.houseCount--;
    this.updateHouseCount();
    
    // Пересчитываем заблокированные ячейки
    this.recalculateBlockedCells();
  }

  addBlockedCells(cell) {
    const blockedPositions = new Set();
    
    // Соседние ячейки (8 направлений)
    const neighbors = [
      [-1, -1], [-1, 0], [-1, 1],
      [0, -1],           [0, 1],
      [1, -1],  [1, 0],  [1, 1]
    ];
    
    for (const [dr, dc] of neighbors) {
      const newRow = cell.row + dr;
      const newCol = cell.col + dc;
      if (newRow >= 0 && newRow < this.GRID_SIZE && newCol >= 0 && newCol < this.GRID_SIZE) {
        blockedPositions.add(`${newRow},${newCol}`);
      }
    }
    
    // Вся строка
    for (let col = 0; col < this.GRID_SIZE; col++) {
      blockedPositions.add(`${cell.row},${col}`);
    }
    
    // Весь столбец
    for (let row = 0; row < this.GRID_SIZE; row++) {
      blockedPositions.add(`${row},${cell.col}`);
    }
    
    // Все ячейки того же типа
    for (let row = 0; row < this.GRID_SIZE; row++) {
      for (let col = 0; col < this.GRID_SIZE; col++) {
        if (this.grid[row][col].type === cell.type) {
          blockedPositions.add(`${row},${col}`);
        }
      }
    }
    
    // Добавляем X-метки с анимацией
    blockedPositions.forEach(pos => {
      const [row, col] = pos.split(',').map(Number);
      const targetCell = this.grid[row][col];
      
      // Не ставим X на ячейки с домами
      if (targetCell.house) return;
      
      this.blockedCells.add(pos);
      
      if (!targetCell.xMark) {
        const xMark = this.add.text(
          targetCell.x + this.CELL_SIZE / 2,
          targetCell.y + this.CELL_SIZE / 2,
          'X',
          {
            fontSize: '48px',
            color: '#ff0000',
            fontFamily: 'Arial',
            fontStyle: 'bold'
          }
        ).setOrigin(0.5);
        
        // Случайная анимация появления
        xMark.setScale(0);
        xMark.setAlpha(0);
        xMark.setRotation(Phaser.Math.Between(-180, 180) * Math.PI / 180);
        
        this.tweens.add({
          targets: xMark,
          scale: 1,
          alpha: 1,
          rotation: 0,
          duration: Phaser.Math.Between(300, 800),
          delay: Phaser.Math.Between(0, 500),
          ease: 'Back.easeOut'
        });
        
        targetCell.xMark = xMark;
        this.gridContainer.add(xMark);
      }
    });
    
    // Проверяем победу
    if (this.houseCount >= 8) {
      this.time.delayedCall(1000, () => {
        this.showVictory();
      });
    }
  }

  recalculateBlockedCells() {
    // Удаляем все X-метки
    for (let row = 0; row < this.GRID_SIZE; row++) {
      for (let col = 0; col < this.GRID_SIZE; col++) {
        const cell = this.grid[row][col];
        if (cell.xMark) {
          cell.xMark.destroy();
          cell.xMark = null;
        }
      }
    }
    
    this.blockedCells.clear();
    
    // Пересчитываем для всех домов
    this.houses.forEach(({ cell }) => {
      this.addBlockedCells(cell);
    });
  }

  showBlockedMessage() {
    if (this.blockedMessage) return;
    
    this.blockedMessage = this.add.text(
      960,
      540,
      'Здесь нельзя построить дом,\nпока не снесен тот, который ему мешает',
      {
        fontSize: '32px',
        color: '#ffffff',
        fontFamily: 'Arial',
        align: 'center',
        backgroundColor: '#000000',
        padding: { x: 20, y: 20 }
      }
    ).setOrigin(0.5);
    
    this.time.delayedCall(2000, () => {
      if (this.blockedMessage) {
        this.blockedMessage.destroy();
        this.blockedMessage = null;
      }
    });
  }

  useHint() {
    if (this.hintCounter >= 8) {
      return;
    }
    
    const row = this.hintCounter;
    const col = this.currentMap.aCode[this.hintCounter];
    
    const cell = this.grid[row][col];
    
    // Если в ячейке уже есть дом или она заблокирована, ничего не делаем
    if (cell.house || this.blockedCells.has(`${row},${col}`)) {
      this.hintCounter++;
      this.hintCounterText.setText(`Подсказки: ${this.hintCounter}`);
      return;
    }
    
    this.buildHouse(cell);
    
    this.hintCounter++;
    this.hintCounterText.setText(`Подсказки: ${this.hintCounter}`);
  }

  updateHouseCount() {
    this.houseCountText.setText(`Домов: ${this.houseCount}/8`);
  }

  showVictory() {
    // Создаем салют
    this.createFireworks();
    
    // Показываем сообщение
    const victoryText = this.add.text(
      960,
      400,
      'Уровень пройден!',
      {
        fontSize: '72px',
        color: '#FFD700',
        fontFamily: 'Arial',
        fontStyle: 'bold'
      }
    ).setOrigin(0.5);
    
    victoryText.setScale(0);
    this.tweens.add({
      targets: victoryText,
      scale: 1,
      duration: 500,
      ease: 'Back.easeOut'
    });
    
    // Переход на следующий уровень
    this.time.delayedCall(3000, () => {
      victoryText.destroy();
      
      if (this.currentMapIndex < this.maps.length - 1) {
        this.loadMap(this.currentMapIndex + 1);
      } else {
        // Все уровни пройдены
        this.scene.start('WinScene');
      }
    });
  }

  createFireworks() {
    const colors = [0xFF0000, 0x00FF00, 0x0000FF, 0xFFFF00, 0xFF00FF, 0x00FFFF];
    
    for (let i = 0; i < 5; i++) {
      this.time.delayedCall(i * 400, () => {
        const x = Phaser.Math.Between(400, 1520);
        const y = Phaser.Math.Between(200, 600);
        
        const particles = this.add.particles(x, y, 'cell_0', {
          speed: { min: 100, max: 300 },
          angle: { min: 0, max: 360 },
          scale: { start: 0.3, end: 0 },
          tint: colors[i % colors.length],
          lifespan: 1000,
          quantity: 30,
          blendMode: 'ADD'
        });
        
        this.time.delayedCall(1000, () => {
          particles.destroy();
        });
      });
    }
  }
}
