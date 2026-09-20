const SESSION_KEY = 'feishu-oauth-session';

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

  const response = await fetch('/api/auth/status', {
    headers: { Authorization: `Bearer ${sessionId}` },
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
      '/api/auth/start',
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
      if (event.origin !== 'http://localhost:3001') {
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
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionId}` },
    });
  }
}
