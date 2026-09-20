const SESSION_KEY = 'feishu-oauth-session';
const PLUGIN_KEY = 'id-to-user';

function resolveApiBaseUrl(): string {
  const value = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/u, '');
  if (!value) {
    throw new Error('缺少 VITE_API_BASE_URL，无法连接统一服务。');
  }
  return value;
}

const API_BASE_URL = resolveApiBaseUrl();

function getApiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

function getApiOrigin(): string {
  return new URL(API_BASE_URL, window.location.href).origin;
}

interface OAuthMessage {
  type?: string;
  sessionId?: string;
  message?: string;
}

export function getAuthSession(): string {
  return sessionStorage.getItem(SESSION_KEY) || '';
}

export async function checkAuthSession(): Promise<boolean> {
  const sessionId = getAuthSession();
  if (!sessionId) {
    return false;
  }

  const response = await fetch(getApiUrl('/api/v1/session/status'), {
    headers: {
      Authorization: `Bearer ${sessionId}`,
      'X-Plugin-Key': PLUGIN_KEY,
    },
  });
  if (!response.ok) {
    sessionStorage.removeItem(SESSION_KEY);
    return false;
  }
  return true;
}

export function startOAuth(): Promise<void> {
  return new Promise((resolve, reject) => {
    const popup = window.open(
      getApiUrl(
        `/api/v1/oauth/start?plugin=${encodeURIComponent(PLUGIN_KEY)}`
        + `&origin=${encodeURIComponent(window.location.origin)}`,
      ),
      'feishu-oauth',
      'popup=yes,width=560,height=720',
    );
    if (!popup) {
      reject(new Error('浏览器阻止了授权窗口，请允许插件打开弹窗后重试。'));
      return;
    }

    const timeout = window.setTimeout(() => {
      window.removeEventListener('message', onMessage);
      reject(new Error('授权等待超时，请重新授权。'));
    }, 5 * 60_000);

    function onMessage(event: MessageEvent<OAuthMessage>) {
      if (event.origin !== getApiOrigin()) {
        return;
      }
      if (event.data?.type === 'feishu-oauth-success' && event.data.sessionId) {
        window.clearTimeout(timeout);
        window.removeEventListener('message', onMessage);
        sessionStorage.setItem(SESSION_KEY, event.data.sessionId);
        resolve();
      } else if (event.data?.type === 'feishu-oauth-error') {
        window.clearTimeout(timeout);
        window.removeEventListener('message', onMessage);
        reject(new Error(event.data.message || '飞书授权失败。'));
      }
    }

    window.addEventListener('message', onMessage);
  });
}

export async function logoutOAuth(): Promise<void> {
  const sessionId = getAuthSession();
  sessionStorage.removeItem(SESSION_KEY);
  if (sessionId) {
    await fetch(getApiUrl('/api/v1/session/logout'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sessionId}`,
        'X-Plugin-Key': PLUGIN_KEY,
      },
    });
  }
}
