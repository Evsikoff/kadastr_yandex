// Utility class for managing game progress in localStorage
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

  /**
   * Clear the saved progress
   */
  static clearProgress() {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to clear game progress:', error);
    }
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
