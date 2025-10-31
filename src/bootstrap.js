const SDK_BASE_URL = 'https://yandex.ru/games/sdk/v2';
const appId = import.meta.env.VITE_YANDEX_GAME_APP_ID;

function buildSdkUrl(baseUrl, appIdValue) {
  if (!appIdValue) {
    return baseUrl;
  }

  const url = new URL(baseUrl);
  url.searchParams.set('app-id', appIdValue);
  return url.toString();
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.addEventListener('load', resolve, { once: true });
    script.addEventListener('error', () => {
      reject(new Error(`Failed to load script: ${src}`));
    }, { once: true });

    document.head.appendChild(script);
  });
}

async function bootstrap() {
  const sdkUrl = buildSdkUrl(SDK_BASE_URL, appId);

  try {
    await loadScript(sdkUrl);
  } catch (error) {
    console.error('[YSDK] Unable to load Yandex Games SDK', error);
    throw error;
  }

  await import('./main.js');
}

bootstrap();
