class YandexServiceClass {
  constructor() {
    this.ysdk = null;
    this.ysdkPromise = null;
    this.playerPromise = null;
    this.loadingReadyCalled = false;
  }

  async init() {
    if (this.ysdk) {
      return this.ysdk;
    }

    if (this.ysdkPromise) {
      return this.ysdkPromise;
    }

    if (typeof YaGames === 'undefined') {
      return null;
    }

    this.ysdkPromise = YaGames.init()
      .then(async (ysdk) => {
        this.ysdk = ysdk;

        await this.setDefaultLanguage();

        return this.ysdk;
      })
      .catch((error) => {
        console.warn('Failed to initialize Yandex SDK:', error);
        this.ysdkPromise = null;
        return null;
      });

    return this.ysdkPromise;
  }

  async setDefaultLanguage() {
    if (!this.ysdk?.environment?.i18n) {
      return;
    }

    try {
      const { i18n } = this.ysdk.environment;

      if (typeof i18n.setLang === 'function') {
        i18n.setLang('ru');
      } else if (typeof i18n.changeLang === 'function') {
        await i18n.changeLang('ru');
      }
    } catch (error) {
      console.warn('Failed to set default language to Russian:', error);
    }
  }

  async getSDK() {
    return this.init();
  }

  async getPlayer() {
    const ysdk = await this.init();
    if (!ysdk || typeof ysdk.getPlayer !== 'function') {
      return null;
    }

    if (this.playerPromise) {
      return this.playerPromise;
    }

    this.playerPromise = ysdk
      .getPlayer({ scopes: true })
      .catch((error) => {
        console.warn('Failed to get Yandex player:', error);
        this.playerPromise = null;
        return null;
      });

    return this.playerPromise;
  }

  async getCloudData(key) {
    const player = await this.getPlayer();
    if (!player || typeof player.getData !== 'function') {
      return null;
    }

    try {
      const data = await player.getData([key]);
      return data?.[key] ?? null;
    } catch (error) {
      console.warn('Failed to get cloud data:', error);
      return null;
    }
  }

  async setCloudData(key, value) {
    const player = await this.getPlayer();
    if (!player || typeof player.setData !== 'function') {
      return false;
    }

    try {
      await player.setData({ [key]: value }, true);
      return true;
    } catch (error) {
      console.warn('Failed to save cloud data:', error);
      return false;
    }
  }

  async clearCloudData(key) {
    return this.setCloudData(key, null);
  }

  async notifyGameReady() {
    const ysdk = await this.init();
    if (!ysdk?.features?.LoadingAPI?.ready || this.loadingReadyCalled) {
      return;
    }

    try {
      ysdk.features.LoadingAPI.ready();
      this.loadingReadyCalled = true;
    } catch (error) {
      console.warn('Failed to notify LoadingAPI about readiness:', error);
    }
  }

  async startGameplay() {
    const ysdk = await this.init();
    if (!ysdk?.features?.GameplayAPI?.start) {
      return;
    }

    try {
      ysdk.features.GameplayAPI.start();
    } catch (error) {
      console.warn('Failed to start GameplayAPI:', error);
    }
  }

  async stopGameplay() {
    const ysdk = await this.init();
    if (!ysdk?.features?.GameplayAPI?.stop) {
      return;
    }

    try {
      ysdk.features.GameplayAPI.stop();
    } catch (error) {
      console.warn('Failed to stop GameplayAPI:', error);
    }
  }

  async showFullscreenAdv() {
    const ysdk = await this.init();
    if (!ysdk?.adv?.showFullscreenAdv) {
      return { status: 'error', reason: 'unavailable' };
    }

    return new Promise((resolve) => {
      let resolved = false;

      const finalize = (status, extra = {}) => {
        if (!resolved) {
          resolved = true;
          resolve({ status, ...extra });
        }
      };

      ysdk.adv
        .showFullscreenAdv({
          callbacks: {
            onOpen: () => {
              void this.stopGameplay();
            },
            onClose: (wasShown) => {
              void this.startGameplay();
              finalize('closed', { wasShown });
            },
            onError: (error) => {
              console.warn('Fullscreen ad error:', error);
              void this.startGameplay();
              finalize('error', { error });
            }
          }
        })
        .catch((error) => {
          console.warn('Failed to show fullscreen ad:', error);
          void this.startGameplay();
          finalize('error', { error });
        });
    });
  }

  async showRewardedVideo() {
    const ysdk = await this.init();
    if (!ysdk?.adv?.showRewardedVideo) {
      return { status: 'error', reason: 'unavailable' };
    }

    return new Promise((resolve) => {
      let resolved = false;
      let rewarded = false;

      const finalize = (status, extra = {}) => {
        if (!resolved) {
          resolved = true;
          resolve({ status, ...extra });
        }
      };

      ysdk.adv
        .showRewardedVideo({
          callbacks: {
            onOpen: () => {
              void this.stopGameplay();
            },
            onRewarded: () => {
              rewarded = true;
            },
            onClose: () => {
              void this.startGameplay();
              if (rewarded) {
                finalize('rewarded');
              } else {
                finalize('closed');
              }
            },
            onError: (error) => {
              console.warn('Rewarded ad error:', error);
              void this.startGameplay();
              finalize('error', { error });
            }
          }
        })
        .catch((error) => {
          console.warn('Failed to show rewarded video:', error);
          void this.startGameplay();
          finalize('error', { error });
        });
    });
  }
}

export const YandexService = new YandexServiceClass();

