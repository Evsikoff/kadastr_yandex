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

    // Загружаем фоновое изображение
    this.load.image('background', '/back.jpg');

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

    // Создаем кадры анимации обычного дома
    const houseColors = [0xCCCCCC, 0x999999, 0x666666, 0xFF0000];
    for (let i = 0; i < 4; i++) {
      const houseGraphics = this.make.graphics({ x: 0, y: 0, add: false });
      houseGraphics.fillStyle(houseColors[i], 1);
      houseGraphics.fillRect(20, 20, 80, 80);
      houseGraphics.generateTexture(`house_${i}`, this.CELL_SIZE, this.CELL_SIZE);
      houseGraphics.destroy();
    }

    // Создаем кадры анимации "правильного" дома (зеленые)
    const hintHouseColors = [0xAAEEAA, 0x77DD77, 0x44CC44, 0x00AA00];
    for (let i = 0; i < 4; i++) {
      const hintHouseGraphics = this.make.graphics({ x: 0, y: 0, add: false });
      hintHouseGraphics.fillStyle(hintHouseColors[i], 1);
      hintHouseGraphics.fillRect(20, 20, 80, 80);
      hintHouseGraphics.generateTexture(`hint_house_${i}`, this.CELL_SIZE, this.CELL_SIZE);
      hintHouseGraphics.destroy();
    }
  }

  create() {
    // Добавляем фоновое изображение
    const bg = this.add.image(960, 540, 'background');
    bg.setDisplaySize(1920, 1080);

    // Парсим карты
    const mapData = this.cache.text.get('maps');
    this.maps = MapParser.parseMapFile(mapData);

    // Создаем UI
    this.createUI();

    // Загружаем первую карту
    this.loadMap(0);
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
    // Заголовок "Игра КАДАСТР" - каждое слово на своей строке
    this.add.text(960, 30, 'Игра', {
      fontSize: '48px',
      color: '#FFD700',
      fontFamily: 'Arial',
      fontStyle: 'italic bold'
    }).setOrigin(0.5);

    this.add.text(960, 85, 'КАДАСТР', {
      fontSize: '64px',
      color: '#FF6347',
      fontFamily: 'Georgia',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);

    // Блок "Об игре" - левая панель
    const aboutX = 50;
    const aboutY = 150;
    const aboutWidth = 350;

    this.add.text(aboutX, aboutY, 'ОБ ИГРЕ', {
      fontSize: '28px',
      color: '#FFD700',
      fontFamily: 'Arial',
      fontStyle: 'bold'
    });

    const aboutText = `Вы - работник кадастровой фирмы в выдуманном государстве. Ваша задача - спроектировать размещение 8 домов на участках коттеджного поселка.

ПРАВИЛА:
• На поле 8×8 есть участки 8 разных цветов
• В каждом ряду и столбце должно быть по одному дому
• Дома не могут стоять в соседних клетках (даже по диагонали)
• В каждой цветовой зоне должен быть ровно один дом`;

    this.add.text(aboutX, aboutY + 40, aboutText, {
      fontSize: '16px',
      color: '#ffffff',
      fontFamily: 'Arial',
      wordWrap: { width: aboutWidth },
      lineSpacing: 5
    });

    // Блок "Управление" - правая панель
    const controlX = 1520;
    const controlY = 150;
    const controlWidth = 350;

    this.add.text(controlX, controlY, 'УПРАВЛЕНИЕ', {
      fontSize: '28px',
      color: '#FFD700',
      fontFamily: 'Arial',
      fontStyle: 'bold'
    });

    const controlText = `• Клик по пустой ячейке - построить дом
• Клик по дому - снести дом
• Клик по "X" - показывает, какой дом блокирует эту ячейку
• Кнопка "Подсказка" - автоматически строит правильный дом

Символы "X" показывают ячейки, заблокированные построенными домами. При клике на "X" все связанные с ним метки подсвечиваются желтым цветом.`;

    this.add.text(controlX, controlY + 40, controlText, {
      fontSize: '16px',
      color: '#ffffff',
      fontFamily: 'Arial',
      wordWrap: { width: controlWidth },
      lineSpacing: 5
    });

    // Текст уровня (центр верх)
    this.levelText = this.add.text(960, 950, `Уровень: 1/${this.maps.length}`, {
      fontSize: '32px',
      color: '#ffffff',
      fontFamily: 'Arial',
      backgroundColor: '#000000aa',
      padding: { x: 15, y: 10 }
    }).setOrigin(0.5);

    // Счетчик подсказок
    this.hintCounterText = this.add.text(960, 1000, `Подсказки: 0`, {
      fontSize: '28px',
      color: '#ffffff',
      fontFamily: 'Arial',
      backgroundColor: '#000000aa',
      padding: { x: 15, y: 8 }
    }).setOrigin(0.5);

    // Счетчик домов
    this.houseCountText = this.add.text(960, 1045, `Домов: 0/8`, {
      fontSize: '28px',
      color: '#ffffff',
      fontFamily: 'Arial',
      backgroundColor: '#000000aa',
      padding: { x: 15, y: 8 }
    }).setOrigin(0.5);

    // Кнопка подсказки
    const hintButton = this.add.rectangle(960, 900, 200, 50, 0x4CAF50)
      .setInteractive({ useHandCursor: true });

    const hintButtonText = this.add.text(960, 900, 'Подсказка', {
      fontSize: '24px',
      color: '#ffffff',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    hintButton.on('pointerdown', () => this.useHint());
    hintButton.on('pointerover', () => hintButton.setFillStyle(0x45a049));
    hintButton.on('pointerout', () => hintButton.setFillStyle(0x4CAF50));
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

  buildHouse(cell, isHintHouse = false) {
    // Анимация постройки дома
    const prefix = isHintHouse ? 'hint_house' : 'house';
    const frames = [`${prefix}_0`, `${prefix}_1`, `${prefix}_2`, `${prefix}_3`];
    let frameIndex = 0;

    const house = this.add.image(cell.x, cell.y, frames[0]);
    house.setOrigin(0, 0);
    house.setAlpha(0);
    house.isHintHouse = isHintHouse;

    this.tweens.add({
      targets: house,
      alpha: 1,
      duration: 167,
      onComplete: () => {
        const frameTimer = this.time.addEvent({
          delay: 167,
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
    this.time.delayedCall(667, () => {
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

        // Добавляем обработчик клика на X-метку
        xMark.setInteractive({ useHandCursor: true });
        xMark.on('pointerdown', () => this.onXMarkClick(targetCell));

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

  findHouseBlockingCell(targetCell) {
    // Ищем дом, который блокирует данную ячейку
    for (const { cell: houseCell } of this.houses) {
      // Проверяем 8 соседних ячеек
      const neighbors = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],           [0, 1],
        [1, -1],  [1, 0],  [1, 1]
      ];

      for (const [dr, dc] of neighbors) {
        if (houseCell.row + dr === targetCell.row && houseCell.col + dc === targetCell.col) {
          return houseCell;
        }
      }

      // Проверяем ту же строку
      if (houseCell.row === targetCell.row) {
        return houseCell;
      }

      // Проверяем тот же столбец
      if (houseCell.col === targetCell.col) {
        return houseCell;
      }

      // Проверяем ту же цветовую область
      if (houseCell.type === targetCell.type) {
        return houseCell;
      }
    }

    return null;
  }

  getBlockedPositionsForHouse(houseCell) {
    // Возвращает Set всех позиций, заблокированных конкретным домом
    const blockedPositions = new Set();

    // Соседние ячейки (8 направлений)
    const neighbors = [
      [-1, -1], [-1, 0], [-1, 1],
      [0, -1],           [0, 1],
      [1, -1],  [1, 0],  [1, 1]
    ];

    for (const [dr, dc] of neighbors) {
      const newRow = houseCell.row + dr;
      const newCol = houseCell.col + dc;
      if (newRow >= 0 && newRow < this.GRID_SIZE && newCol >= 0 && newCol < this.GRID_SIZE) {
        blockedPositions.add(`${newRow},${newCol}`);
      }
    }

    // Вся строка
    for (let col = 0; col < this.GRID_SIZE; col++) {
      blockedPositions.add(`${houseCell.row},${col}`);
    }

    // Весь столбец
    for (let row = 0; row < this.GRID_SIZE; row++) {
      blockedPositions.add(`${row},${houseCell.col}`);
    }

    // Все ячейки того же типа
    for (let row = 0; row < this.GRID_SIZE; row++) {
      for (let col = 0; col < this.GRID_SIZE; col++) {
        if (this.grid[row][col].type === houseCell.type) {
          blockedPositions.add(`${row},${col}`);
        }
      }
    }

    return blockedPositions;
  }

  onXMarkClick(clickedCell) {
    // Показываем сообщение на 2 секунды
    this.showBlockedMessage();

    // Находим дом, к которому относится эта X-метка
    const houseCell = this.findHouseBlockingCell(clickedCell);

    if (!houseCell) {
      return;
    }

    // Получаем все позиции, заблокированные этим домом
    const blockedPositions = this.getBlockedPositionsForHouse(houseCell);

    // Находим все X-метки этого дома
    const xMarksToHighlight = [];
    blockedPositions.forEach(pos => {
      const [row, col] = pos.split(',').map(Number);
      const cell = this.grid[row][col];

      // Если в этой ячейке есть X-метка, добавляем её для подсветки
      if (cell.xMark && !cell.house) {
        xMarksToHighlight.push(cell.xMark);
      }
    });

    // Подсвечиваем все найденные X-метки желтым цветом на 0.5 секунды
    xMarksToHighlight.forEach(xMark => {
      const originalColor = xMark.style.color;

      // Меняем цвет на желтый
      xMark.setColor('#FFFF00');

      // Через 0.5 секунды возвращаем исходный цвет
      this.time.delayedCall(500, () => {
        xMark.setColor(originalColor);
      });
    });
  }

  useHint() {
    if (this.hintCounter >= 8) {
      return;
    }

    // Определяем координаты ячейки для подсказки
    const row = this.hintCounter; // Координата по вертикали
    const col = this.currentMap.aCode[this.hintCounter]; // Координата по горизонтали

    const cell = this.grid[row][col];

    // Случай 1: Если в ячейке нет "X" и нет дома
    if (!cell.house && !this.blockedCells.has(`${row},${col}`)) {
      // Строим "правильный" дом
      this.buildHouse(cell, true);
      this.hintCounter++;
      this.hintCounterText.setText(`Подсказки: ${this.hintCounter}`);
      return;
    }

    // Случай 2: Если в ячейке есть "X"
    if (this.blockedCells.has(`${row},${col}`) && !cell.house) {
      // Находим дом, к которому относится этот "X"
      const blockingHouse = this.findHouseBlockingCell(cell);

      if (blockingHouse) {
        // Сносим дом, к которому относится "X"
        this.removeHouse(blockingHouse);
      }

      // Строим "правильный" дом на данной ячейке
      this.buildHouse(cell, true);
      this.hintCounter++;
      this.hintCounterText.setText(`Подсказки: ${this.hintCounter}`);
      return;
    }

    // Случай 3: Если в ячейке уже есть дом
    if (cell.house) {
      // Увеличиваем счетчик и повторяем алгоритм
      this.hintCounter++;
      this.hintCounterText.setText(`Подсказки: ${this.hintCounter}`);
      this.useHint(); // Рекурсивный вызов
      return;
    }
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
