import { YandexService } from './YandexService.js';

// Utility class for managing game progress in localStorage and the Yandex cloud
export class GameProgress {
  static STORAGE_KEY = 'kadastr_game_level';

  /**
   * Save the current level to localStorage
   * @param {number} level - The current level index (0-based)
   */
  static saveLevel(level) {
    try {
      localStorage.setItem(this.STORAGE_KEY, level.toString());
    } catch (error) {
      console.warn('Failed to save game progress:', error);
    }

    YandexService.setCloudData(this.STORAGE_KEY, Number(level)).catch(() => {});
  }

  /**
   * Load the saved level from localStorage
   * @returns {number|null} - The saved level index or null if not found
   */
  static loadLevel() {
    try {
      const savedLevel = localStorage.getItem(this.STORAGE_KEY);
      if (savedLevel !== null) {
        const level = parseInt(savedLevel, 10);
        return isNaN(level) ? null : level;
      }
      return null;
    } catch (error) {
      console.warn('Failed to load game progress:', error);
      return null;
    }
  }

  static async loadLevelFromCloudOrLocal() {
    const cloudValue = await YandexService.getCloudData(this.STORAGE_KEY);

    if (cloudValue !== null && cloudValue !== undefined) {
      const level = parseInt(cloudValue, 10);

      if (!isNaN(level)) {
        try {
          localStorage.setItem(this.STORAGE_KEY, level.toString());
        } catch (error) {
          console.warn('Failed to sync cloud progress with local storage:', error);
        }

        return level;
      }
    }

    return this.loadLevel();
  }

  /**
   * Clear the saved progress
   */
  static clearProgress() {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to clear game progress:', error);
    }

    YandexService.clearCloudData(this.STORAGE_KEY).catch(() => {});
  }

  /**
   * Check if there is saved progress
   * @returns {boolean}
   */
  static hasSavedProgress() {
    try {
      return localStorage.getItem(this.STORAGE_KEY) !== null;
    } catch (error) {
      console.warn('Failed to check for saved progress:', error);
      return false;
    }
  }
}
