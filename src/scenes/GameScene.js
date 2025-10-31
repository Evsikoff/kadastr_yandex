import Phaser from 'phaser';
import { MapParser } from '../utils/MapParser.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');

    this.GRID_SIZE = 8;
    this.CELL_SIZE = 85;
    this.isMobile = false;
    this.currentOrientation = 'landscape';
    this.startMapIndex = 0;
    this.maps = [];
    this.currentMapIndex = 0;
    this.currentMap = null;
    this.grid = [];
    this.houses = [];
    this.blockedCells = new Set();
    this.hintCounter = 0;
    this.houseCount = 0;
    this.cellTexturesAvailable = false;
    this.baseHouseTexturesAvailable = false;
    this.correctHouseTexturesAvailable = false;
  }

  init(data = {}) {
    this.startMapIndex = data.mapIndex ?? 0;
    this.isMobile = !this.sys.game.device.os.desktop;
    this.currentOrientation =
      this.scale.orientation === Phaser.Scale.PORTRAIT ? 'portrait' : 'landscape';

    if (this.isMobile) {
      this.CELL_SIZE = this.currentOrientation === 'portrait' ? 70 : 80;
    } else {
      this.CELL_SIZE = 85;
    }
  }

  preload() {
    // Загружаем файл с картами
    this.load.text('maps', '/maps/kadastrmapsmall.txt');

    // Загружаем фоновое изображение
    this.load.image('background', '/back.jpg');

    // Проверяем наличие текстур ячеек и домов
    this.cellTexturesAvailable = this.checkCellTexturesAvailability();
    this.baseHouseTexturesAvailable = this.checkHouseTexturesAvailability('/houses/base');
    this.correctHouseTexturesAvailable = this.checkHouseTexturesAvailability('/houses/correct');

    // Создаем необходимые ассеты. Если текстуры отсутствуют — генерируем заглушки
    this.createPlaceholderAssets({
      includeCellPlaceholders: !this.cellTexturesAvailable,
      includeBaseHousePlaceholders: !this.baseHouseTexturesAvailable,
      includeHintHousePlaceholders: !this.correctHouseTexturesAvailable
    });

    const shouldListenForLoadErrors =
      this.cellTexturesAvailable ||
      this.baseHouseTexturesAvailable ||
      this.correctHouseTexturesAvailable;

    if (shouldListenForLoadErrors) {
      this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, this.onTextureLoadError, this);

      this.load.once(Phaser.Loader.Events.COMPLETE, () => {
        this.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, this.onTextureLoadError, this);

        this.createPlaceholderAssets({
          includeCellPlaceholders: !this.cellTexturesAvailable,
          includeBaseHousePlaceholders: !this.baseHouseTexturesAvailable,
          includeHintHousePlaceholders: !this.correctHouseTexturesAvailable
        });
      });
    }

    if (this.cellTexturesAvailable) {
      for (let i = 0; i < 8; i++) {
        this.load.image(`cell_${i}`, `/cells/cell_${i}.png`);
      }
    }

    if (this.baseHouseTexturesAvailable) {
      for (let i = 0; i < 4; i++) {
        this.load.image(`house_${i}`, `/houses/base/house_${i}.png`);
      }
    }

    if (this.correctHouseTexturesAvailable) {
      for (let i = 0; i < 4; i++) {
        this.load.image(`hint_house_${i}`, `/houses/correct/house_${i}.png`);
      }
    }
  }

  createPlaceholderAssets({
    includeCellPlaceholders = true,
    includeBaseHousePlaceholders = true,
    includeHintHousePlaceholders = true
  } = {}) {
    if (includeCellPlaceholders) {
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

    const houseSize = this.CELL_SIZE - 25;
    const houseOffset = 12;

    if (includeBaseHousePlaceholders) {
      // Создаем кадры анимации обычного дома
      const houseColors = [0xCCCCCC, 0x999999, 0x666666, 0xFF0000];
      for (let i = 0; i < 4; i++) {
        const houseGraphics = this.make.graphics({ x: 0, y: 0, add: false });
        houseGraphics.fillStyle(houseColors[i], 1);
        houseGraphics.fillRect(houseOffset, houseOffset, houseSize, houseSize);
        houseGraphics.generateTexture(`house_${i}`, this.CELL_SIZE, this.CELL_SIZE);
        houseGraphics.destroy();
      }
    }

    if (includeHintHousePlaceholders) {
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
  }

  checkCellTexturesAvailability() {
    if (typeof XMLHttpRequest === 'undefined') {
      return false;
    }

    try {
      for (let i = 0; i < 8; i++) {
        const request = new XMLHttpRequest();
        request.open('HEAD', `/cells/cell_${i}.png`, false);
        request.send(null);

        if (request.status < 200 || request.status >= 400) {
          return false;
        }
      }

      return true;
    } catch (error) {
      console.warn('Не удалось проверить наличие текстур ячеек:', error);
      return false;
    }
  }

  checkHouseTexturesAvailability(basePath) {
    if (typeof XMLHttpRequest === 'undefined') {
      return false;
    }

    try {
      for (let i = 0; i < 4; i++) {
        const request = new XMLHttpRequest();
        request.open('HEAD', `${basePath}/house_${i}.png`, false);
        request.send(null);

        if (request.status < 200 || request.status >= 400) {
          return false;
        }
      }

      return true;
    } catch (error) {
      console.warn(`Не удалось проверить наличие текстур домов по пути ${basePath}:`, error);
      return false;
    }
  }

  onTextureLoadError(file) {
    if (!file.key) return;

    if (file.key.startsWith('cell_')) {
      this.cellTexturesAvailable = false;
    }

    if (file.key.startsWith('house_')) {
      this.baseHouseTexturesAvailable = false;
    }

    if (file.key.startsWith('hint_house_')) {
      this.correctHouseTexturesAvailable = false;
    }
  }

  create() {
    this.screenWidth = this.scale.gameSize.width;
    this.screenHeight = this.scale.gameSize.height;
    this.currentOrientation =
      this.scale.orientation === Phaser.Scale.PORTRAIT ? 'portrait' : 'landscape';

    // Добавляем фоновое изображение как повторяющийся тайл, подстраиваем под текущие размеры сцены
    const bg = this.add.tileSprite(
      this.screenWidth / 2,
      this.screenHeight / 2,
      this.screenWidth,
      this.screenHeight,
      'background'
    );

    const targetTileSize = 1024;
    const backgroundSource = this.textures.get('background').getSourceImage();

    const tilesX = Math.max(1, Math.round(this.screenWidth / targetTileSize));
    const tilesY = Math.max(1, Math.round(this.screenHeight / targetTileSize));

    const tileScaleX = this.screenWidth / (backgroundSource.width * tilesX);
    const tileScaleY = this.screenHeight / (backgroundSource.height * tilesY);

    bg.setTileScale(tileScaleX, tileScaleY);

    const mapData = this.cache.text.get('maps');
    this.maps = MapParser.parseMapFile(mapData);

    this.createUI();

    this.loadMap(this.startMapIndex);

    this.scale.on(
      Phaser.Scale.Events.ORIENTATION_CHANGE,
      this.handleOrientationChange,
      this
    );

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(
        Phaser.Scale.Events.ORIENTATION_CHANGE,
        this.handleOrientationChange,
        this
      );
    });
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
    const startX = (this.screenWidth - this.layout.gridSize) / 2;
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
        cellBg.setDisplaySize(this.CELL_SIZE, this.CELL_SIZE);
        
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
    const startX = (this.screenWidth - this.layout.gridSize) / 2;
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
    this.layout = this.calculateLayout();

    this.createHeader(this.layout);
    this.drawGridFrame(this.layout);

    const aboutText = `Вы - работник кадастровой фирмы в выдуманном государстве. Ваша задача - спроектировать размещение 8 домов
 на участках коттеджного поселка.

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

    if (this.layout.about) {
      this.createPanel({
        ...this.layout.about,
        title: 'ОБ ИГРЕ',
        bodyText: aboutText
      });
    }

    if (this.layout.control) {
      this.createPanel({
        ...this.layout.control,
        title: 'УПРАВЛЕНИЕ',
        bodyText: controlText
      });
    }

    this.createHintButton(this.layout);
    this.createStatsSection(this.layout);

    // Для mobile-portrait создаем кнопки вместо панелей
    if (this.layout.type === 'mobile-portrait') {
      this.createInfoButtons(this.layout, aboutText, controlText);
    }
  }

  calculateLayout() {
    const width = this.screenWidth;
    const height = this.screenHeight;
    const gridSize = this.GRID_SIZE * this.CELL_SIZE;
    const isPortrait = this.currentOrientation === 'portrait';
    const layoutType = this.isMobile ? (isPortrait ? 'mobile-portrait' : 'mobile-landscape') : 'desktop';

    const layout = {
      type: layoutType,
      width,
      height,
      screenCenterX: width / 2,
      gridSize,
      gridPadding: this.isMobile ? (isPortrait ? 16 : 22) : 25,
      gridFramePadding: this.isMobile ? (isPortrait ? 14 : 18) : 20,
      gridFrameRadius: this.isMobile ? 14 : 15,
      gridFrameBorderWidth: 4,
      gridFrameBackgroundAlpha: 0.92,
      gridFrameShadowAlpha: this.isMobile ? 0.2 : 0.25,
      gridFrameShadowOffset: this.isMobile ? (isPortrait ? 10 : 12) : 15
    };

    layout.gridContainerSize = gridSize + layout.gridPadding * 2;

    if (layoutType === 'desktop') {
      const topMargin = 140;
      const sideMargin = 80;
      const bottomGap = 20;

      layout.header = {
        titleY: 25,
        subtitleY: 85,
        titleStyle: {
          fontSize: '52px',
          color: '#2F4858',
          fontFamily: 'Georgia',
          fontStyle: 'italic bold',
          stroke: '#9B2226',
          strokeThickness: 3,
          shadow: {
            offsetX: 2,
            offsetY: 2,
            color: '#f0e9db',
            blur: 6,
            fill: true
          }
        },
        subtitleStyle: {
          fontSize: '72px',
          color: '#3A7CA5',
          fontFamily: 'Georgia',
          fontStyle: 'bold',
          stroke: '#1B4965',
          strokeThickness: 4,
          shadow: {
            offsetX: 4,
            offsetY: 4,
            color: '#f0e9db',
            blur: 10,
            fill: true
          }
        }
      };

      layout.gridStartY = topMargin;
      layout.gridEndY = layout.gridStartY + layout.gridContainerSize;

      const aboutWidth = 320;
      const aboutHeight = 460;
      const aboutPadding = 20;
      const aboutLeft = sideMargin - aboutPadding;
      const aboutTop = layout.gridStartY - aboutPadding;

      layout.about = {
        containerLeft: aboutLeft,
        containerTop: aboutTop,
        containerWidth: aboutWidth + aboutPadding * 2,
        containerHeight: aboutHeight + aboutPadding * 2,
        radius: 18,
        backgroundColor: 0xF6F0E6,
        backgroundAlpha: 0.94,
        borderColor: 0xB56576,
        borderWidth: 3,
        shadowAlpha: 0.3,
        shadowOffset: 15,
        titleX: sideMargin,
        titleY: layout.gridStartY,
        titleStyle: {
          fontSize: '32px',
          color: '#9B2226',
          fontFamily: 'Georgia',
          fontStyle: 'bold',
          stroke: '#B56576',
          strokeThickness: 2
        },
        bodyX: sideMargin,
        bodyY: layout.gridStartY + 50,
        bodyStyle: {
          fontSize: '17px',
          color: '#2F4858',
          fontFamily: 'Arial',
          wordWrap: { width: aboutWidth },
          lineSpacing: 5
        }
      };

      const hintButtonWidth = layout.about.containerWidth;
      const hintButtonHeight = 70;
      const hintButtonX = aboutLeft + hintButtonWidth / 2;
      const hintButtonY =
        aboutTop + layout.about.containerHeight + hintButtonHeight / 2 + 20;

      layout.hintButton = {
        x: hintButtonX,
        y: hintButtonY,
        width: hintButtonWidth,
        height: hintButtonHeight,
        radius: 14,
        borderColor: 0x9B2226,
        borderWidth: 3,
        colors: [0x3A7CA5, 0x3A7CA5, 0x1B4965, 0x1B4965],
        hoverColors: [0x4F8FBF, 0x4F8FBF, 0x2F6690, 0x2F6690],
        textStyle: {
          fontSize: '24px',
          color: '#F6F0E6',
          fontFamily: 'Arial',
          fontStyle: 'bold',
          stroke: '#9B2226',
          strokeThickness: 2
        }
      };

      const controlWidth = 320;
      const controlHeight = 480;
      const controlPadding = 20;
      const controlX = width - sideMargin - controlWidth;
      const controlLeft = controlX - controlPadding;
      const controlTop = layout.gridStartY - controlPadding;

      layout.control = {
        containerLeft: controlLeft,
        containerTop: controlTop,
        containerWidth: controlWidth + controlPadding * 2,
        containerHeight: controlHeight + controlPadding * 2,
        radius: 18,
        backgroundColor: 0xF6F0E6,
        backgroundAlpha: 0.94,
        borderColor: 0x3A7CA5,
        borderWidth: 3,
        shadowAlpha: 0.3,
        shadowOffset: 15,
        titleX: controlX,
        titleY: layout.gridStartY,
        titleStyle: {
          fontSize: '32px',
          color: '#1B4965',
          fontFamily: 'Georgia',
          fontStyle: 'bold',
          stroke: '#3A7CA5',
          strokeThickness: 2
        },
        bodyX: controlX,
        bodyY: layout.gridStartY + 50,
        bodyStyle: {
          fontSize: '17px',
          color: '#2F4858',
          fontFamily: 'Arial',
          wordWrap: { width: controlWidth },
          lineSpacing: 5
        }
      };

      const statsWidth = 550;
      const statsHeight = 140;
      const statsPadding = 20;
      const statsContentTop = layout.gridEndY + bottomGap;
      const statsLeft = layout.screenCenterX - statsWidth / 2 - statsPadding;

      layout.stats = {
        mode: 'horizontal',
        containerLeft: statsLeft,
        containerTop: statsContentTop - statsPadding,
        containerWidth: statsWidth + statsPadding * 2,
        containerHeight: statsHeight + statsPadding * 2,
        radius: 18,
        backgroundColor: 0xF6F0E6,
        backgroundAlpha: 0.94,
        borderColor: 0xB56576,
        borderWidth: 3,
        shadowAlpha: 0.25,
        shadowOffset: 15,
        titleX: layout.screenCenterX,
        titleY: statsContentTop + 5,
        titleStyle: {
          fontSize: '28px',
          color: '#9B2226',
          fontFamily: 'Georgia',
          fontStyle: 'bold',
          stroke: '#B56576',
          strokeThickness: 2
        },
        baseX: layout.screenCenterX,
        labelY: statsContentTop + 50,
        valueOffset: 35,
        columnSpacing: 180,
        labelStyle: {
          fontSize: '18px',
          color: '#1B4965',
          fontFamily: 'Arial',
          fontStyle: 'bold'
        },
        valueStyles: {
          level: {
            fontSize: '32px',
            color: '#9B2226',
            fontFamily: 'Georgia',
            fontStyle: 'bold',
            stroke: '#B56576',
            strokeThickness: 2
          },
          hints: {
            fontSize: '32px',
            color: '#3A7CA5',
            fontFamily: 'Georgia',
            fontStyle: 'bold',
            stroke: '#1B4965',
            strokeThickness: 2
          },
          houses: {
            fontSize: '32px',
            color: '#3A7CA5',
            fontFamily: 'Georgia',
            fontStyle: 'bold',
            stroke: '#1B4965',
            strokeThickness: 2
          }
        }
      };
    } else if (layoutType === 'mobile-landscape') {
      const topMargin = 130;
      const sideMargin = 40;
      const bottomGap = 18;

      layout.header = {
        titleY: 40,
        subtitleY: 110,
        titleStyle: {
          fontSize: '46px',
          color: '#2F4858',
          fontFamily: 'Georgia',
          fontStyle: 'italic bold',
          stroke: '#9B2226',
          strokeThickness: 3
        },
        subtitleStyle: {
          fontSize: '64px',
          color: '#3A7CA5',
          fontFamily: 'Georgia',
          fontStyle: 'bold',
          stroke: '#1B4965',
          strokeThickness: 4
        }
      };

      layout.gridStartY = topMargin;
      layout.gridEndY = layout.gridStartY + layout.gridContainerSize;

      const aboutWidth = 280;
      const aboutHeight = 420;
      const aboutPadding = 18;
      const aboutLeft = sideMargin - aboutPadding;
      const aboutTop = layout.gridStartY - aboutPadding;

      layout.about = {
        containerLeft: aboutLeft,
        containerTop: aboutTop,
        containerWidth: aboutWidth + aboutPadding * 2,
        containerHeight: aboutHeight + aboutPadding * 2,
        radius: 16,
        backgroundColor: 0xF6F0E6,
        backgroundAlpha: 0.94,
        borderColor: 0xB56576,
        borderWidth: 3,
        shadowAlpha: 0.25,
        shadowOffset: 12,
        titleX: sideMargin,
        titleY: layout.gridStartY,
        titleStyle: {
          fontSize: '30px',
          color: '#9B2226',
          fontFamily: 'Georgia',
          fontStyle: 'bold',
          stroke: '#B56576',
          strokeThickness: 2
        },
        bodyX: sideMargin,
        bodyY: layout.gridStartY + 48,
        bodyStyle: {
          fontSize: '16px',
          color: '#2F4858',
          fontFamily: 'Arial',
          wordWrap: { width: aboutWidth },
          lineSpacing: 4
        }
      };

      const hintButtonWidth = layout.about.containerWidth;
      const hintButtonHeight = 68;
      const hintButtonX = aboutLeft + hintButtonWidth / 2;
      const hintButtonY =
        aboutTop + layout.about.containerHeight + hintButtonHeight / 2 + 16;

      layout.hintButton = {
        x: hintButtonX,
        y: hintButtonY,
        width: hintButtonWidth,
        height: hintButtonHeight,
        radius: 14,
        borderColor: 0x9B2226,
        borderWidth: 3,
        colors: [0x3A7CA5, 0x3A7CA5, 0x1B4965, 0x1B4965],
        hoverColors: [0x4F8FBF, 0x4F8FBF, 0x2F6690, 0x2F6690],
        textStyle: {
          fontSize: '22px',
          color: '#F6F0E6',
          fontFamily: 'Arial',
          fontStyle: 'bold',
          stroke: '#9B2226',
          strokeThickness: 2
        }
      };

      const controlWidth = 280;
      const controlHeight = 420;
      const controlPadding = 18;
      const controlX = width - sideMargin - controlWidth;
      const controlLeft = controlX - controlPadding;
      const controlTop = layout.gridStartY - controlPadding;

      layout.control = {
        containerLeft: controlLeft,
        containerTop: controlTop,
        containerWidth: controlWidth + controlPadding * 2,
        containerHeight: controlHeight + controlPadding * 2,
        radius: 16,
        backgroundColor: 0xF6F0E6,
        backgroundAlpha: 0.94,
        borderColor: 0x3A7CA5,
        borderWidth: 3,
        shadowAlpha: 0.25,
        shadowOffset: 12,
        titleX: controlX,
        titleY: layout.gridStartY,
        titleStyle: {
          fontSize: '30px',
          color: '#1B4965',
          fontFamily: 'Georgia',
          fontStyle: 'bold',
          stroke: '#3A7CA5',
          strokeThickness: 2
        },
        bodyX: controlX,
        bodyY: layout.gridStartY + 48,
        bodyStyle: {
          fontSize: '16px',
          color: '#2F4858',
          fontFamily: 'Arial',
          wordWrap: { width: controlWidth },
          lineSpacing: 4
        }
      };

      const statsWidth = 500;
      const statsHeight = 130;
      const statsPadding = 18;
      const statsContentTop = layout.gridEndY + bottomGap;
      const statsLeft = layout.screenCenterX - statsWidth / 2 - statsPadding;

      layout.stats = {
        mode: 'horizontal',
        containerLeft: statsLeft,
        containerTop: statsContentTop - statsPadding,
        containerWidth: statsWidth + statsPadding * 2,
        containerHeight: statsHeight + statsPadding * 2,
        radius: 16,
        backgroundColor: 0xF6F0E6,
        backgroundAlpha: 0.94,
        borderColor: 0xB56576,
        borderWidth: 3,
        shadowAlpha: 0.22,
        shadowOffset: 12,
        titleX: layout.screenCenterX,
        titleY: statsContentTop + 4,
        titleStyle: {
          fontSize: '26px',
          color: '#9B2226',
          fontFamily: 'Georgia',
          fontStyle: 'bold',
          stroke: '#B56576',
          strokeThickness: 2
        },
        baseX: layout.screenCenterX,
        labelY: statsContentTop + 46,
        valueOffset: 30,
        columnSpacing: 160,
        labelStyle: {
          fontSize: '17px',
          color: '#1B4965',
          fontFamily: 'Arial',
          fontStyle: 'bold'
        },
        valueStyles: {
          level: {
            fontSize: '28px',
            color: '#9B2226',
            fontFamily: 'Georgia',
            fontStyle: 'bold',
            stroke: '#B56576',
            strokeThickness: 2
          },
          hints: {
            fontSize: '28px',
            color: '#3A7CA5',
            fontFamily: 'Georgia',
            fontStyle: 'bold',
            stroke: '#1B4965',
            strokeThickness: 2
          },
          houses: {
            fontSize: '28px',
            color: '#3A7CA5',
            fontFamily: 'Georgia',
            fontStyle: 'bold',
            stroke: '#1B4965',
            strokeThickness: 2
          }
        }
      };
    } else {
      const headerTitleY = 60;
      const headerSubtitleY = 140;
      const statsContentTop = 220;
      const statsHeight = 130;
      const statsPadding = 22;
      const statsWidth = Math.min(width - 80, 920);

      layout.header = {
        titleY: headerTitleY,
        subtitleY: headerSubtitleY,
        titleStyle: {
          fontSize: '48px',
          color: '#2F4858',
          fontFamily: 'Georgia',
          fontStyle: 'italic bold',
          stroke: '#9B2226',
          strokeThickness: 3
        },
        subtitleStyle: {
          fontSize: '68px',
          color: '#3A7CA5',
          fontFamily: 'Georgia',
          fontStyle: 'bold',
          stroke: '#1B4965',
          strokeThickness: 4
        }
      };

      layout.stats = {
        mode: 'horizontal',
        containerLeft: width / 2 - (statsWidth + statsPadding * 2) / 2,
        containerTop: statsContentTop - statsPadding,
        containerWidth: statsWidth + statsPadding * 2,
        containerHeight: statsHeight + statsPadding * 2,
        radius: 18,
        backgroundColor: 0xF6F0E6,
        backgroundAlpha: 0.94,
        borderColor: 0xB56576,
        borderWidth: 3,
        shadowAlpha: 0.22,
        shadowOffset: 12,
        titleX: width / 2,
        titleY: statsContentTop + 5,
        titleStyle: {
          fontSize: '28px',
          color: '#9B2226',
          fontFamily: 'Georgia',
          fontStyle: 'bold',
          stroke: '#B56576',
          strokeThickness: 2
        },
        baseX: width / 2,
        labelY: statsContentTop + 48,
        valueOffset: 32,
        columnSpacing: 280,
        labelStyle: {
          fontSize: '18px',
          color: '#1B4965',
          fontFamily: 'Arial',
          fontStyle: 'bold'
        },
        valueStyles: {
          level: {
            fontSize: '30px',
            color: '#9B2226',
            fontFamily: 'Georgia',
            fontStyle: 'bold',
            stroke: '#B56576',
            strokeThickness: 2
          },
          hints: {
            fontSize: '30px',
            color: '#3A7CA5',
            fontFamily: 'Georgia',
            fontStyle: 'bold',
            stroke: '#1B4965',
            strokeThickness: 2
          },
          houses: {
            fontSize: '30px',
            color: '#3A7CA5',
            fontFamily: 'Georgia',
            fontStyle: 'bold',
            stroke: '#1B4965',
            strokeThickness: 2
          }
        }
      };

      layout.gridStartY = statsContentTop + statsHeight + 40;
      layout.gridEndY = layout.gridStartY + layout.gridContainerSize;

      const buttonWidth = Math.min(width - 80, 920);
      const buttonHeight = 85;
      const buttonGap = 18;

      const hintButtonY = layout.gridEndY + buttonHeight / 2 + 30;

      layout.hintButton = {
        x: width / 2,
        y: hintButtonY,
        width: buttonWidth,
        height: buttonHeight,
        radius: 16,
        borderColor: 0x9B2226,
        borderWidth: 3,
        colors: [0x3A7CA5, 0x3A7CA5, 0x1B4965, 0x1B4965],
        hoverColors: [0x4F8FBF, 0x4F8FBF, 0x2F6690, 0x2F6690],
        textStyle: {
          fontSize: '28px',
          color: '#F6F0E6',
          fontFamily: 'Arial',
          fontStyle: 'bold',
          stroke: '#9B2226',
          strokeThickness: 2
        }
      };

      // Кнопка "Об игре"
      layout.aboutButton = {
        x: width / 2,
        y: hintButtonY + buttonHeight / 2 + buttonGap + buttonHeight / 2,
        width: buttonWidth,
        height: buttonHeight,
        radius: 16,
        borderColor: 0xB56576,
        borderWidth: 3,
        colors: [0xB56576, 0xB56576, 0x9B2226, 0x9B2226],
        hoverColors: [0xC97585, 0xC97585, 0xAF3336, 0xAF3336],
        textStyle: {
          fontSize: '28px',
          color: '#F6F0E6',
          fontFamily: 'Arial',
          fontStyle: 'bold',
          stroke: '#9B2226',
          strokeThickness: 2
        }
      };

      // Кнопка "Управление"
      layout.controlButton = {
        x: width / 2,
        y: hintButtonY + buttonHeight / 2 + buttonGap + buttonHeight / 2 + buttonHeight + buttonGap,
        width: buttonWidth,
        height: buttonHeight,
        radius: 16,
        borderColor: 0x3A7CA5,
        borderWidth: 3,
        colors: [0x3A7CA5, 0x3A7CA5, 0x1B4965, 0x1B4965],
        hoverColors: [0x4F8FBF, 0x4F8FBF, 0x2F6690, 0x2F6690],
        textStyle: {
          fontSize: '28px',
          color: '#F6F0E6',
          fontFamily: 'Arial',
          fontStyle: 'bold',
          stroke: '#1B4965',
          strokeThickness: 2
        }
      };

      // Не создаем about и control панели для mobile-portrait
      // Они будут показываться как модальные окна
    }

    return layout;
  }

  createHeader(layout) {
    if (!layout.header) {
      return;
    }

    this.add
      .text(layout.screenCenterX, layout.header.titleY, 'Игра', layout.header.titleStyle)
      .setOrigin(0.5);

    this.add
      .text(layout.screenCenterX, layout.header.subtitleY, 'КАДАСТР', layout.header.subtitleStyle)
      .setOrigin(0.5);
  }

  drawGridFrame(layout) {
    const padding = layout.gridFramePadding;
    const gridContainerWidth = layout.gridContainerSize;
    const frameWidth = gridContainerWidth + padding * 2;
    const frameHeight = gridContainerWidth + padding * 2;
    const frameLeft = layout.screenCenterX - frameWidth / 2;
    const frameTop = layout.gridStartY - padding;

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, layout.gridFrameShadowAlpha);
    shadow.fillRoundedRect(
      frameLeft + layout.gridFrameShadowOffset,
      frameTop + layout.gridFrameShadowOffset,
      frameWidth,
      frameHeight,
      layout.gridFrameRadius
    );
    shadow.setDepth(-1);

    const frame = this.add.graphics();
    frame.fillStyle(0xF6F0E6, layout.gridFrameBackgroundAlpha);
    frame.fillRoundedRect(frameLeft, frameTop, frameWidth, frameHeight, layout.gridFrameRadius);
    frame.lineStyle(layout.gridFrameBorderWidth, 0x3A7CA5, 1);
    frame.strokeRoundedRect(frameLeft, frameTop, frameWidth, frameHeight, layout.gridFrameRadius);
  }

  createPanel(config) {
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, config.shadowAlpha ?? 0.25);
    shadow.fillRoundedRect(
      config.containerLeft + (config.shadowOffset ?? 0),
      config.containerTop + (config.shadowOffset ?? 0),
      config.containerWidth,
      config.containerHeight,
      config.radius
    );
    shadow.setDepth(-1);

    const container = this.add.graphics();
    container.fillStyle(config.backgroundColor, config.backgroundAlpha ?? 1);
    container.fillRoundedRect(
      config.containerLeft,
      config.containerTop,
      config.containerWidth,
      config.containerHeight,
      config.radius
    );
    container.lineStyle(config.borderWidth ?? 3, config.borderColor, 1);
    container.strokeRoundedRect(
      config.containerLeft,
      config.containerTop,
      config.containerWidth,
      config.containerHeight,
      config.radius
    );

    const title = this.add.text(config.titleX, config.titleY, config.title, config.titleStyle);
    if (config.titleOriginX !== undefined || config.titleOriginY !== undefined) {
      title.setOrigin(config.titleOriginX ?? 0, config.titleOriginY ?? 0);
    }

    const body = this.add.text(config.bodyX, config.bodyY, config.bodyText, config.bodyStyle);
    if (config.bodyOriginX !== undefined || config.bodyOriginY !== undefined) {
      body.setOrigin(config.bodyOriginX ?? 0, config.bodyOriginY ?? 0);
    }
  }

  createHintButton(layout) {
    const config = layout.hintButton;
    if (!config) {
      return;
    }

    this.hintButtonConfig = config;
    this.hintButton = this.add.graphics();
    this.drawHintButtonState('default');

    const interactiveRect = new Phaser.Geom.Rectangle(
      config.x - config.width / 2,
      config.y - config.height / 2,
      config.width,
      config.height
    );

    this.hintButton.setInteractive(interactiveRect, Phaser.Geom.Rectangle.Contains);
    this.hintButton.on('pointerdown', () => this.useHint());
    this.hintButton.on('pointerover', () => this.drawHintButtonState('hover'));
    this.hintButton.on('pointerout', () => this.drawHintButtonState('default'));

    const buttonLabel = config.label ?? 'Подсказка';
    this.hintButtonLabel = this.add.text(config.x, config.y, buttonLabel, config.textStyle).setOrigin(0.5);
  }

  drawHintButtonState(state) {
    if (!this.hintButton || !this.hintButtonConfig) {
      return;
    }

    const config = this.hintButtonConfig;
    const colors = state === 'hover' ? config.hoverColors : config.colors;

    this.hintButton.clear();
    this.hintButton.fillGradientStyle(colors[0], colors[1], colors[2], colors[3], 1);
    this.hintButton.fillRoundedRect(
      config.x - config.width / 2,
      config.y - config.height / 2,
      config.width,
      config.height,
      config.radius
    );
    this.hintButton.lineStyle(config.borderWidth ?? 3, config.borderColor, 1);
    this.hintButton.strokeRoundedRect(
      config.x - config.width / 2,
      config.y - config.height / 2,
      config.width,
      config.height,
      config.radius
    );
  }

  createStatsSection(layout) {
    const stats = layout.stats;
    if (!stats) {
      return;
    }

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, stats.shadowAlpha ?? 0.25);
    shadow.fillRoundedRect(
      stats.containerLeft + (stats.shadowOffset ?? 0),
      stats.containerTop + (stats.shadowOffset ?? 0),
      stats.containerWidth,
      stats.containerHeight,
      stats.radius
    );
    shadow.setDepth(-1);

    const container = this.add.graphics();
    container.fillStyle(stats.backgroundColor, stats.backgroundAlpha ?? 1);
    container.fillRoundedRect(
      stats.containerLeft,
      stats.containerTop,
      stats.containerWidth,
      stats.containerHeight,
      stats.radius
    );
    container.lineStyle(stats.borderWidth ?? 3, stats.borderColor, 1);
    container.strokeRoundedRect(
      stats.containerLeft,
      stats.containerTop,
      stats.containerWidth,
      stats.containerHeight,
      stats.radius
    );

    this.add.text(stats.titleX, stats.titleY, 'СТАТИСТИКА', stats.titleStyle).setOrigin(0.5);

    if (stats.mode === 'horizontal') {
      const labelY = stats.labelY;
      const valueY = labelY + stats.valueOffset;
      const baseX = stats.baseX;
      const spacing = stats.columnSpacing;

      this.add.text(baseX - spacing, labelY, 'Уровень', stats.labelStyle).setOrigin(0.5);
      this.levelText = this.add
        .text(baseX - spacing, valueY, `1/${this.maps.length}`, stats.valueStyles.level)
        .setOrigin(0.5);

      this.add.text(baseX, labelY, 'Подсказки', stats.labelStyle).setOrigin(0.5);
      this.hintCounterText = this.add
        .text(baseX, valueY, '0', stats.valueStyles.hints)
        .setOrigin(0.5);

      this.add.text(baseX + spacing, labelY, 'Домов', stats.labelStyle).setOrigin(0.5);
      this.houseCountText = this.add
        .text(baseX + spacing, valueY, '0/8', stats.valueStyles.houses)
        .setOrigin(0.5);
    } else {
      const baseX = stats.baseX;
      const valueOffset = stats.valueOffset;
      let rowY = stats.firstRowY;

      this.add.text(baseX, rowY, 'Уровень', stats.labelStyle).setOrigin(0.5);
      this.levelText = this.add
        .text(baseX, rowY + valueOffset, `1/${this.maps.length}`, stats.valueStyles.level)
        .setOrigin(0.5);

      rowY += stats.rowSpacing;
      this.add.text(baseX, rowY, 'Подсказки', stats.labelStyle).setOrigin(0.5);
      this.hintCounterText = this.add
        .text(baseX, rowY + valueOffset, '0', stats.valueStyles.hints)
        .setOrigin(0.5);

      rowY += stats.rowSpacing;
      this.add.text(baseX, rowY, 'Домов', stats.labelStyle).setOrigin(0.5);
      this.houseCountText = this.add
        .text(baseX, rowY + valueOffset, '0/8', stats.valueStyles.houses)
        .setOrigin(0.5);
    }
  }

  createInfoButtons(layout, aboutText, controlText) {
    // Сохраняем тексты для модальных окон
    this.aboutText = aboutText;
    this.controlText = controlText;

    // Создаем кнопку "Об игре"
    if (layout.aboutButton) {
      this.createButton(
        layout.aboutButton,
        'Об игре',
        () => this.showModal('about')
      );
    }

    // Создаем кнопку "Управление"
    if (layout.controlButton) {
      this.createButton(
        layout.controlButton,
        'Управление',
        () => this.showModal('control')
      );
    }
  }

  createButton(config, label, onClick) {
    const button = this.add.graphics();

    const drawButton = (state) => {
      const colors = state === 'hover' ? config.hoverColors : config.colors;
      button.clear();
      button.fillGradientStyle(colors[0], colors[1], colors[2], colors[3], 1);
      button.fillRoundedRect(
        config.x - config.width / 2,
        config.y - config.height / 2,
        config.width,
        config.height,
        config.radius
      );
      button.lineStyle(config.borderWidth ?? 3, config.borderColor, 1);
      button.strokeRoundedRect(
        config.x - config.width / 2,
        config.y - config.height / 2,
        config.width,
        config.height,
        config.radius
      );
    };

    drawButton('default');

    const interactiveRect = new Phaser.Geom.Rectangle(
      config.x - config.width / 2,
      config.y - config.height / 2,
      config.width,
      config.height
    );

    button.setInteractive(interactiveRect, Phaser.Geom.Rectangle.Contains);
    button.on('pointerdown', onClick);
    button.on('pointerover', () => drawButton('hover'));
    button.on('pointerout', () => drawButton('default'));

    const buttonLabel = this.add.text(config.x, config.y, label, config.textStyle).setOrigin(0.5);

    return { button, label: buttonLabel };
  }

  showModal(type) {
    // Закрываем текущее модальное окно, если оно открыто
    this.closeModal();

    const width = this.screenWidth;
    const height = this.screenHeight;
    const modalWidth = Math.min(width - 100, 860);
    const modalHeight = Math.min(height - 200, 1000);
    const modalX = width / 2 - modalWidth / 2;
    const modalY = height / 2 - modalHeight / 2;

    // Создаем контейнер для модального окна
    this.modalContainer = this.add.container(0, 0);
    this.modalContainer.setDepth(1000);

    // Полупрозрачный фон
    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.7);
    overlay.setOrigin(0, 0);
    overlay.setInteractive();
    overlay.on('pointerdown', () => this.closeModal());
    this.modalContainer.add(overlay);

    // Тень модального окна
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.3);
    shadow.fillRoundedRect(modalX + 15, modalY + 15, modalWidth, modalHeight, 20);
    this.modalContainer.add(shadow);

    // Основной фон модального окна
    const modalBg = this.add.graphics();
    modalBg.fillStyle(0xF6F0E6, 0.98);
    modalBg.fillRoundedRect(modalX, modalY, modalWidth, modalHeight, 20);

    const borderColor = type === 'about' ? 0xB56576 : 0x3A7CA5;
    modalBg.lineStyle(4, borderColor, 1);
    modalBg.strokeRoundedRect(modalX, modalY, modalWidth, modalHeight, 20);
    this.modalContainer.add(modalBg);

    // Заголовок
    const title = type === 'about' ? 'ОБ ИГРЕ' : 'УПРАВЛЕНИЕ';
    const titleColor = type === 'about' ? '#9B2226' : '#1B4965';
    const titleStroke = type === 'about' ? '#B56576' : '#3A7CA5';

    const titleText = this.add.text(
      width / 2,
      modalY + 40,
      title,
      {
        fontSize: '36px',
        color: titleColor,
        fontFamily: 'Georgia',
        fontStyle: 'bold',
        stroke: titleStroke,
        strokeThickness: 2
      }
    ).setOrigin(0.5, 0);
    this.modalContainer.add(titleText);

    // Контент
    const contentText = type === 'about' ? this.aboutText : this.controlText;
    const bodyText = this.add.text(
      modalX + 30,
      modalY + 100,
      contentText,
      {
        fontSize: '20px',
        color: '#2F4858',
        fontFamily: 'Arial',
        wordWrap: { width: modalWidth - 60 },
        lineSpacing: 6
      }
    );
    this.modalContainer.add(bodyText);

    // Кнопка закрытия (крестик)
    const closeButtonSize = 50;
    const closeX = modalX + modalWidth - closeButtonSize - 15;
    const closeY = modalY + 15;

    const closeBg = this.add.graphics();
    closeBg.fillStyle(0xFF0000, 0.8);
    closeBg.fillCircle(closeX + closeButtonSize / 2, closeY + closeButtonSize / 2, closeButtonSize / 2);
    closeBg.lineStyle(3, 0x9B2226, 1);
    closeBg.strokeCircle(closeX + closeButtonSize / 2, closeY + closeButtonSize / 2, closeButtonSize / 2);

    const closeCircle = new Phaser.Geom.Circle(closeX + closeButtonSize / 2, closeY + closeButtonSize / 2, closeButtonSize / 2);
    closeBg.setInteractive(closeCircle, Phaser.Geom.Circle.Contains);
    closeBg.on('pointerdown', () => this.closeModal());
    closeBg.on('pointerover', () => {
      closeBg.clear();
      closeBg.fillStyle(0xFF4444, 0.9);
      closeBg.fillCircle(closeX + closeButtonSize / 2, closeY + closeButtonSize / 2, closeButtonSize / 2);
      closeBg.lineStyle(3, 0x9B2226, 1);
      closeBg.strokeCircle(closeX + closeButtonSize / 2, closeY + closeButtonSize / 2, closeButtonSize / 2);
    });
    closeBg.on('pointerout', () => {
      closeBg.clear();
      closeBg.fillStyle(0xFF0000, 0.8);
      closeBg.fillCircle(closeX + closeButtonSize / 2, closeY + closeButtonSize / 2, closeButtonSize / 2);
      closeBg.lineStyle(3, 0x9B2226, 1);
      closeBg.strokeCircle(closeX + closeButtonSize / 2, closeY + closeButtonSize / 2, closeButtonSize / 2);
    });
    this.modalContainer.add(closeBg);

    const closeText = this.add.text(
      closeX + closeButtonSize / 2,
      closeY + closeButtonSize / 2,
      'X',
      {
        fontSize: '32px',
        color: '#FFFFFF',
        fontFamily: 'Arial',
        fontStyle: 'bold'
      }
    ).setOrigin(0.5);
    this.modalContainer.add(closeText);

    // Анимация появления
    this.modalContainer.setAlpha(0);
    this.tweens.add({
      targets: this.modalContainer,
      alpha: 1,
      duration: 300,
      ease: 'Power2'
    });
  }

  closeModal() {
    if (this.modalContainer) {
      this.tweens.add({
        targets: this.modalContainer,
        alpha: 0,
        duration: 200,
        ease: 'Power2',
        onComplete: () => {
          this.modalContainer.destroy();
          this.modalContainer = null;
        }
      });
    }
  }

  handleOrientationChange(orientation) {
    const newOrientation =
      orientation === Phaser.Scale.PORTRAIT ? 'portrait' : 'landscape';

    if (newOrientation === this.currentOrientation) {
      return;
    }

    this.currentOrientation = newOrientation;

    if (this.isMobile) {
      const targetSize =
        newOrientation === 'portrait'
          ? { width: 1080, height: 1920 }
          : { width: 1920, height: 1080 };

      this.scale.resize(targetSize.width, targetSize.height);
      this.scene.restart({ mapIndex: this.currentMapIndex });
    }
  }

  onCellClick(cell) {
    // Если в ячейке уже есть дом - удаляем его
    if (cell.house) {
      this.removeHouse(cell);
      return;
    }

    // Если ячейка заблокирована — подсвечиваем связанные X-метки
    if (this.blockedCells.has(`${cell.row},${cell.col}`)) {
      this.highlightBlockedMarks(cell);
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

    const house = this.add.image(
      cell.x + this.CELL_SIZE / 2,
      cell.y + this.CELL_SIZE / 2,
      frames[0]
    );
    house.setOrigin(0.5, 0.5);
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
    this.highlightBlockedMarks(clickedCell);
  }

  highlightBlockedMarks(targetCell) {
    // Находим дом, к которому относится эта X-метка
    const houseCell = this.findHouseBlockingCell(targetCell);

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
