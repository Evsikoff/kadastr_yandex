import Phaser from 'phaser';
import { MapParser } from '../utils/MapParser.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');

    this.GRID_SIZE = 8;
    this.CELL_SIZE = 85;
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
    const houseSize = this.CELL_SIZE - 25;
    const houseOffset = 12;
    for (let i = 0; i < 4; i++) {
      const houseGraphics = this.make.graphics({ x: 0, y: 0, add: false });
      houseGraphics.fillStyle(houseColors[i], 1);
      houseGraphics.fillRect(houseOffset, houseOffset, houseSize, houseSize);
      houseGraphics.generateTexture(`house_${i}`, this.CELL_SIZE, this.CELL_SIZE);
      houseGraphics.destroy();
    }

    // Создаем кадры анимации "правильного" дома (зеленые)
    const hintHouseColors = [0xAAEEAA, 0x77DD77, 0x44CC44, 0x00AA00];
    for (let i = 0; i < 4; i++) {
      const hintHouseGraphics = this.make.graphics({ x: 0, y: 0, add: false });
      hintHouseGraphics.fillStyle(hintHouseColors[i], 1);
      hintHouseGraphics.fillRect(houseOffset, houseOffset, houseSize, houseSize);
      hintHouseGraphics.generateTexture(`hint_house_${i}`, this.CELL_SIZE, this.CELL_SIZE);
      hintHouseGraphics.destroy();
    }
  }

  create() {
    // Добавляем фоновое изображение как повторяющийся тайл, подобранный под соотношение 16:9
    const bg = this.add.tileSprite(960, 540, 1920, 1080, 'background');

    // Чтобы тайлы были визуально квадратными, подбираем размер, который кратен базовому разрешению 16×9
    const tilesY = 9;
    const tilesX = 16;
    const targetTileWidth = this.scale.gameSize.width / tilesX;
    const targetTileHeight = this.scale.gameSize.height / tilesY;
    const targetTileSize = Math.min(targetTileWidth, targetTileHeight);
    const backgroundSource = this.textures.get('background').getSourceImage();

    bg.setTileScale(
      targetTileSize / backgroundSource.width,
      targetTileSize / backgroundSource.height
    );

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
      this.levelText.setText(`${index + 1}/${this.maps.length}`);
    }

    if (this.hintCounterText) {
      this.hintCounterText.setText(`${this.hintCounter}`);
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

    // Используем layout для правильного позиционирования
    const startX = (1920 - this.layout.gridSize) / 2;
    const startY = this.layout.gridStartY + this.layout.gridPadding;
    
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
    // Используем layout для правильного позиционирования
    const startX = (1920 - this.layout.gridSize) / 2;
    const startY = this.layout.gridStartY + this.layout.gridPadding;
    
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
    // Система координат для правильного позиционирования
    const layout = {
      screenCenterX: 960,
      headerHeight: 110,
      gridSize: this.GRID_SIZE * this.CELL_SIZE, // 680px
      gridPadding: 25,
      topMargin: 140,
      bottomGap: 20,
      sideMargin: 80
    };

    // Рассчитываем позиции контейнеров
    layout.gridContainerSize = layout.gridSize + layout.gridPadding * 2; // 730px
    layout.gridStartY = layout.topMargin;
    layout.gridEndY = layout.gridStartY + layout.gridContainerSize; // 870px

    layout.statsStartY = layout.gridEndY + layout.bottomGap; // 890px
    layout.statsHeight = 140;

    // Сохраняем для use в createGrid
    this.layout = layout;

    // Заголовок "Игра КАДАСТР" - каждое слово на своей строке с улучшенным стилем
    this.add.text(960, 25, 'Игра', {
      fontSize: '52px',
      color: '#FFD700',
      fontFamily: 'Georgia',
      fontStyle: 'italic bold',
      stroke: '#8B4513',
      strokeThickness: 4,
      shadow: {
        offsetX: 3,
        offsetY: 3,
        color: '#000000',
        blur: 5,
        fill: true
      }
    }).setOrigin(0.5);

    this.add.text(960, 85, 'КАДАСТР', {
      fontSize: '72px',
      color: '#FF6B35',
      fontFamily: 'Georgia',
      fontStyle: 'bold',
      stroke: '#8B0000',
      strokeThickness: 5,
      shadow: {
        offsetX: 4,
        offsetY: 4,
        color: '#000000',
        blur: 8,
        fill: true
      }
    }).setOrigin(0.5);

    // Блок "Об игре" - левая панель (выравниваем с игровым полем)
    const aboutX = layout.sideMargin;
    const aboutY = layout.gridStartY;
    const aboutWidth = 320;
    const aboutHeight = layout.gridContainerSize;

    // Контейнер для "Об игре"
    const aboutContainer = this.add.graphics();
    aboutContainer.fillStyle(0x1a1a2e, 0.92);
    aboutContainer.fillRoundedRect(aboutX - 20, aboutY - 20, aboutWidth + 40, aboutHeight + 40, 15);
    aboutContainer.lineStyle(3, 0xFFD700, 1);
    aboutContainer.strokeRoundedRect(aboutX - 20, aboutY - 20, aboutWidth + 40, aboutHeight + 40, 15);

    // Тень для контейнера
    const aboutShadow = this.add.graphics();
    aboutShadow.fillStyle(0x000000, 0.5);
    aboutShadow.fillRoundedRect(aboutX - 15, aboutY - 15, aboutWidth + 40, aboutHeight + 40, 15);
    aboutShadow.setDepth(-1);

    this.add.text(aboutX, aboutY, 'ОБ ИГРЕ', {
      fontSize: '32px',
      color: '#FFD700',
      fontFamily: 'Georgia',
      fontStyle: 'bold',
      stroke: '#8B4513',
      strokeThickness: 2
    });

    const aboutText = `Вы - работник кадастровой фирмы в выдуманном государстве. Ваша задача - спроектировать размещение 8 домов на участках коттеджного поселка.

ПРАВИЛА:
• На поле 8×8 есть участки
  8 разных цветов
• В каждом ряду и столбце
  должно быть по одному дому
• Дома не могут стоять
  в соседних клетках
  (даже по диагонали)
• В каждой цветовой зоне
  должен быть ровно один дом`;

    this.add.text(aboutX, aboutY + 50, aboutText, {
      fontSize: '17px',
      color: '#E8E8E8',
      fontFamily: 'Arial',
      wordWrap: { width: aboutWidth },
      lineSpacing: 6
    });

    // Контейнер для игрового поля
    const gridContainerX = layout.screenCenterX;
    const gridContainerWidth = layout.gridContainerSize;

    const gridVisualContainer = this.add.graphics();
    gridVisualContainer.fillStyle(0x1a1a2e, 0.88);
    gridVisualContainer.fillRoundedRect(
      gridContainerX - gridContainerWidth / 2 - 20,
      layout.gridStartY - 20,
      gridContainerWidth + 40,
      gridContainerWidth + 40,
      15
    );
    gridVisualContainer.lineStyle(4, 0x4169E1, 1);
    gridVisualContainer.strokeRoundedRect(
      gridContainerX - gridContainerWidth / 2 - 20,
      layout.gridStartY - 20,
      gridContainerWidth + 40,
      gridContainerWidth + 40,
      15
    );

    // Тень для контейнера игрового поля
    const gridShadow = this.add.graphics();
    gridShadow.fillStyle(0x000000, 0.5);
    gridShadow.fillRoundedRect(
      gridContainerX - gridContainerWidth / 2 - 15,
      layout.gridStartY - 15,
      gridContainerWidth + 40,
      gridContainerWidth + 40,
      15
    );
    gridShadow.setDepth(-1);

    // Блок "Управление" - правая панель (выравниваем с игровым полем)
    const controlX = 1920 - layout.sideMargin - 320;
    const controlY = layout.gridStartY;
    const controlWidth = 320;
    const controlHeight = layout.gridContainerSize;

    // Контейнер для "Управление"
    const controlContainer = this.add.graphics();
    controlContainer.fillStyle(0x1a1a2e, 0.92);
    controlContainer.fillRoundedRect(controlX - 20, controlY - 20, controlWidth + 40, controlHeight + 40, 15);
    controlContainer.lineStyle(3, 0x4CAF50, 1);
    controlContainer.strokeRoundedRect(controlX - 20, controlY - 20, controlWidth + 40, controlHeight + 40, 15);

    // Тень для контейнера
    const controlShadow = this.add.graphics();
    controlShadow.fillStyle(0x000000, 0.5);
    controlShadow.fillRoundedRect(controlX - 15, controlY - 15, controlWidth + 40, controlHeight + 40, 15);
    controlShadow.setDepth(-1);

    this.add.text(controlX, controlY, 'УПРАВЛЕНИЕ', {
      fontSize: '32px',
      color: '#4CAF50',
      fontFamily: 'Georgia',
      fontStyle: 'bold',
      stroke: '#2E7D32',
      strokeThickness: 2
    });

    const controlText = `• Клик по пустой ячейке -
  построить дом
• Клик по дому - снести дом
• Клик по "X" - показывает,
  какой дом блокирует
  эту ячейку
• Кнопка "Подсказка" -
  автоматически строит
  правильный дом

Символы "X" показывают ячейки, заблокированные построенными домами. При клике на "X" все связанные метки подсвечиваются желтым.`;

    this.add.text(controlX, controlY + 50, controlText, {
      fontSize: '17px',
      color: '#E8E8E8',
      fontFamily: 'Arial',
      wordWrap: { width: controlWidth },
      lineSpacing: 6
    });

    // Панель статистики игры внизу (используем layout)
    const statsX = layout.screenCenterX;
    const statsY = layout.statsStartY;
    const statsWidth = 550;
    const statsHeight = layout.statsHeight;

    // Контейнер для статистики
    const statsContainer = this.add.graphics();
    statsContainer.fillStyle(0x1a1a2e, 0.92);
    statsContainer.fillRoundedRect(statsX - statsWidth/2 - 20, statsY - 20, statsWidth + 40, statsHeight + 40, 15);
    statsContainer.lineStyle(3, 0xFF6B35, 1);
    statsContainer.strokeRoundedRect(statsX - statsWidth/2 - 20, statsY - 20, statsWidth + 40, statsHeight + 40, 15);

    // Тень для контейнера статистики
    const statsShadow = this.add.graphics();
    statsShadow.fillStyle(0x000000, 0.5);
    statsShadow.fillRoundedRect(statsX - statsWidth/2 - 15, statsY - 15, statsWidth + 40, statsHeight + 40, 15);
    statsShadow.setDepth(-1);

    // Заголовок "СТАТИСТИКА"
    this.add.text(statsX, statsY + 5, 'СТАТИСТИКА', {
      fontSize: '28px',
      color: '#FF6B35',
      fontFamily: 'Georgia',
      fontStyle: 'bold',
      stroke: '#8B0000',
      strokeThickness: 2
    }).setOrigin(0.5);

    // Расположение элементов статистики в три колонки
    const colSpacing = 180;
    const statY = statsY + 50;

    // Левая колонка - Уровень
    this.add.text(statsX - colSpacing, statY, 'Уровень', {
      fontSize: '18px',
      color: '#FFD700',
      fontFamily: 'Arial',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.levelText = this.add.text(statsX - colSpacing, statY + 35, `1/${this.maps.length}`, {
      fontSize: '32px',
      color: '#FFD700',
      fontFamily: 'Georgia',
      fontStyle: 'bold',
      stroke: '#8B4513',
      strokeThickness: 2
    }).setOrigin(0.5);

    // Центральная колонка - Подсказки
    this.add.text(statsX, statY, 'Подсказки', {
      fontSize: '18px',
      color: '#87CEEB',
      fontFamily: 'Arial',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.hintCounterText = this.add.text(statsX, statY + 35, '0', {
      fontSize: '32px',
      color: '#87CEEB',
      fontFamily: 'Georgia',
      fontStyle: 'bold',
      stroke: '#4682B4',
      strokeThickness: 2
    }).setOrigin(0.5);

    // Правая колонка - Домов
    this.add.text(statsX + colSpacing, statY, 'Домов', {
      fontSize: '18px',
      color: '#98FB98',
      fontFamily: 'Arial',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.houseCountText = this.add.text(statsX + colSpacing, statY + 35, '0/8', {
      fontSize: '32px',
      color: '#98FB98',
      fontFamily: 'Georgia',
      fontStyle: 'bold',
      stroke: '#2E7D32',
      strokeThickness: 2
    }).setOrigin(0.5);

    // Кнопка подсказки - размещаем справа от игрового поля
    const hintButtonX = gridContainerX + gridContainerWidth / 2 + 110;
    const hintButtonY = layout.gridStartY + gridContainerWidth / 2;
    const hintButtonWidth = 180;
    const hintButtonHeight = 70;

    this.hintButton = this.add.graphics();
    this.hintButton.fillGradientStyle(0x66BB6A, 0x66BB6A, 0x4CAF50, 0x4CAF50, 1);
    this.hintButton.fillRoundedRect(hintButtonX - hintButtonWidth/2, hintButtonY - hintButtonHeight/2, hintButtonWidth, hintButtonHeight, 12);
    this.hintButton.lineStyle(3, 0x2E7D32, 1);
    this.hintButton.strokeRoundedRect(hintButtonX - hintButtonWidth/2, hintButtonY - hintButtonHeight/2, hintButtonWidth, hintButtonHeight, 12);
    this.hintButton.setInteractive(
      new Phaser.Geom.Rectangle(hintButtonX - hintButtonWidth/2, hintButtonY - hintButtonHeight/2, hintButtonWidth, hintButtonHeight),
      Phaser.Geom.Rectangle.Contains
    );

    const hintButtonText = this.add.text(hintButtonX, hintButtonY, 'Подсказка', {
      fontSize: '26px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold',
      stroke: '#2E7D32',
      strokeThickness: 2
    }).setOrigin(0.5);

    this.hintButton.on('pointerdown', () => this.useHint());
    this.hintButton.on('pointerover', () => {
      this.hintButton.clear();
      this.hintButton.fillGradientStyle(0x77CC77, 0x77CC77, 0x5DB85D, 0x5DB85D, 1);
      this.hintButton.fillRoundedRect(hintButtonX - hintButtonWidth/2, hintButtonY - hintButtonHeight/2, hintButtonWidth, hintButtonHeight, 12);
      this.hintButton.lineStyle(3, 0x2E7D32, 1);
      this.hintButton.strokeRoundedRect(hintButtonX - hintButtonWidth/2, hintButtonY - hintButtonHeight/2, hintButtonWidth, hintButtonHeight, 12);
    });
    this.hintButton.on('pointerout', () => {
      this.hintButton.clear();
      this.hintButton.fillGradientStyle(0x66BB6A, 0x66BB6A, 0x4CAF50, 0x4CAF50, 1);
      this.hintButton.fillRoundedRect(hintButtonX - hintButtonWidth/2, hintButtonY - hintButtonHeight/2, hintButtonWidth, hintButtonHeight, 12);
      this.hintButton.lineStyle(3, 0x2E7D32, 1);
      this.hintButton.strokeRoundedRect(hintButtonX - hintButtonWidth/2, hintButtonY - hintButtonHeight/2, hintButtonWidth, hintButtonHeight, 12);
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
            fontSize: '36px',
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
      this.hintCounterText.setText(`${this.hintCounter}`);
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
      this.hintCounterText.setText(`${this.hintCounter}`);
      return;
    }

    // Случай 3: Если в ячейке уже есть дом
    if (cell.house) {
      // Увеличиваем счетчик и повторяем алгоритм
      this.hintCounter++;
      this.hintCounterText.setText(`${this.hintCounter}`);
      this.useHint(); // Рекурсивный вызов
      return;
    }
  }

  updateHouseCount() {
    this.houseCountText.setText(`${this.houseCount}/8`);
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
