# Игра Кадастр - Phaser 3

Игра-головоломка на сетке 8x8 с постройкой домов и логическими ограничениями.

## 🎮 Как играть

1. Кликайте на ячейки для постройки домов
2. Вокруг построенного дома появятся красные "X" - там нельзя строить
3. "X" также появляются во всей строке, столбце и во всех ячейках того же типа
4. Постройте 8 домов для прохождения уровня
5. Используйте кнопку "Подсказка" если застряли

## 🚀 Локальная разработка

```bash
npm install
npm run dev
```

## 📦 Развертывание на CodeSandbox

### Способ 1: Импорт из GitHub (Рекомендуется)

1. Загрузите проект на GitHub
2. Откройте CodeSandbox.io
3. Нажмите "+ Create" → "Import from GitHub"
4. Вставьте URL вашего репозитория
5. CodeSandbox автоматически установит зависимости и запустит проект

### Способ 2: Ручное создание

1. Перейдите на https://codesandbox.io
2. Нажмите "+ Create" → "Vite" template
3. Загрузите файлы проекта:
   - Перетащите все файлы из этого проекта
   - Или создайте файлы вручную, копируя содержимое

4. Структура проекта в CodeSandbox:
```
/
├── package.json
├── index.html
├── vite.config.js
├── src/
│   ├── main.js
│   ├── scenes/
│   │   ├── GameScene.js
│   │   └── WinScene.js
│   └── utils/
│       └── MapParser.js
└── public/
    └── maps/
        └── kadastrmapsmall.txt
```

5. CodeSandbox автоматически:
   - Установит зависимости из package.json
   - Запустит команду `npm run dev`
   - Откроет preview

### Способ 3: Прямая загрузка ZIP

1. Заархивируйте весь проект (kadastr-game.zip)
2. На CodeSandbox: "+ Create" → "Import project" → "Upload"
3. Загрузите ZIP файл

## 📝 Важные замечания для CodeSandbox

- **Зависимости**: CodeSandbox автоматически установит Phaser 3 и Vite
- **Hot Reload**: Изменения применяются мгновенно
- **Assets**: Все изображения должны быть в папке `public/`
- **Preview**: Используйте встроенный preview браузер CodeSandbox

## 🎨 Замена заглушек на реальные изображения

Сейчас игра использует процедурно сгенерированные заглушки. Чтобы добавить реальные PNG:

1. Создайте папки в `public/`:
```
public/
├── cells/
│   ├── cell_0.png
│   ├── cell_1.png
│   ├── ...
│   └── cell_7.png
├── fences/
│   ├── fence_h.png
│   └── fence_v.png
└── houses/
    ├── house_0.png (кадр 1)
    ├── house_1.png (кадр 2)
    ├── house_2.png (кадр 3)
    └── house_3.png (кадр 4)
```

2. В `GameScene.js` замените `createPlaceholderAssets()` на:
```javascript
preload() {
  // Загружаем файл с картами
  this.load.text('maps', '/maps/kadastrmapsmall.txt');
  
  // Загружаем реальные изображения
  for (let i = 0; i < 8; i++) {
    this.load.image(`cell_${i}`, `/cells/cell_${i}.png`);
  }
  
  this.load.image('fence_h', '/fences/fence_h.png');
  this.load.image('fence_v', '/fences/fence_v.png');
  
  for (let i = 0; i < 4; i++) {
    this.load.image(`house_${i}`, `/houses/house_${i}.png`);
  }
}

create() {
  // Удалите вызов createPlaceholderAssets()
  const mapData = this.cache.text.get('maps');
  this.maps = MapParser.parseMapFile(mapData);
  this.loadMap(0);
  this.createUI();
}
```

## 🐛 Возможные проблемы в CodeSandbox

1. **"Cannot find module 'phaser'"**
   - Решение: Подождите завершения установки пакетов (статус внизу справа)

2. **Черный экран**
   - Проверьте консоль браузера (F12)
   - Убедитесь что файл `kadastrmapsmall.txt` в `public/maps/`

3. **Медленная загрузка**
   - Первый запуск может занять 1-2 минуты
   - Последующие запуски будут быстрее

## 🔗 Полезные ссылки

- [Phaser 3 Documentation](https://photonstorm.github.io/phaser3-docs/)
- [CodeSandbox Documentation](https://codesandbox.io/docs)
- [Vite Documentation](https://vitejs.dev/)

## 📄 Лицензия

MIT
