import crypto from 'node:crypto';
import express from 'express';
import dotenv from 'dotenv';

dotenv.config({ path: process.env.ENV_FILE || '.env.local' });

const {
  FEISHU_APP_ID,
  FEISHU_APP_SECRET,
  FEISHU_REDIRECT_URI = 'http://localhost:3001/api/auth/callback',
  FRONTEND_ORIGIN = 'http://localhost:5173',
  PORT = '3001',
} = process.env;

if (!FEISHU_APP_ID || !FEISHU_APP_SECRET) {
  throw new Error('Missing FEISHU_APP_ID or FEISHU_APP_SECRET in .env.local');
}

const app = express();
const pendingAuthorizations = new Map();
const sessions = new Map();
const scopes = ['base:record:update', 'offline_access'].join(' ');

app.use(express.json({ limit: '1mb' }));

function randomBase64Url(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function getSessionId(request) {
  const value = request.get('authorization') || '';
  return value.startsWith('Bearer ') ? value.slice(7) : '';
}

function sendOAuthResult(response, payload) {
  const serializedPayload = JSON.stringify(payload).replaceAll('<', '\\u003c');
  const serializedOrigin = JSON.stringify(FRONTEND_ORIGIN);
  response
    .status(200)
    .type('html')
    .set('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'")
    .send(`<!doctype html>
<html lang="zh-CN">
  <head><meta charset="utf-8"><title>飞书授权</title></head>
  <body>
    <p>授权处理完成，本窗口将自动关闭。</p>
    <script>
      if (window.opener) {
        window.opener.postMessage(${serializedPayload}, ${serializedOrigin});
      }
      window.close();
    </script>
  </body>
</html>`);
}

async function requestOAuthToken(body) {
  const response = await fetch('https://open.feishu.cn/open-apis/authen/v2/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      client_id: FEISHU_APP_ID,
      client_secret: FEISHU_APP_SECRET,
      ...body,
    }),
  });
  const payload = await response.json();
  if (!response.ok || payload.code !== 0 || !payload.access_token) {
    throw new Error(payload.error_description || payload.msg || `OAuth HTTP ${response.status}`);
  }
  return payload;
}

async function getAccessToken(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error('AUTH_REQUIRED');
  }

  if (session.expiresAt > Date.now() + 60_000) {
    return session.accessToken;
  }
  if (!session.refreshToken) {
    sessions.delete(sessionId);
    throw new Error('AUTH_EXPIRED');
  }

  const payload = await requestOAuthToken({
    grant_type: 'refresh_token',
    refresh_token: session.refreshToken,
  });
  session.accessToken = payload.access_token;
  session.refreshToken = payload.refresh_token || session.refreshToken;
  session.expiresAt = Date.now() + payload.expires_in * 1000;
  return session.accessToken;
}

app.get('/api/auth/start', (request, response) => {
  const state = randomBase64Url();
  const codeVerifier = randomBase64Url(48);
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

  pendingAuthorizations.set(state, {
    codeVerifier,
    expiresAt: Date.now() + 5 * 60_000,
  });

  const authorizeUrl = new URL('https://accounts.feishu.cn/open-apis/authen/v1/authorize');
  authorizeUrl.searchParams.set('client_id', FEISHU_APP_ID);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('redirect_uri', FEISHU_REDIRECT_URI);
  authorizeUrl.searchParams.set('scope', scopes);
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set('code_challenge', codeChallenge);
  authorizeUrl.searchParams.set('code_challenge_method', 'S256');
  response.redirect(authorizeUrl.toString());
});

app.get('/api/auth/callback', async (request, response) => {
  const { code, error, state } = request.query;
  const pending = typeof state === 'string' ? pendingAuthorizations.get(state) : undefined;
  if (typeof state === 'string') {
    pendingAuthorizations.delete(state);
  }

  if (error || typeof code !== 'string' || !pending || pending.expiresAt < Date.now()) {
    sendOAuthResult(response, {
      type: 'feishu-oauth-error',
      message: error === 'access_denied' ? '用户取消了授权。' : '授权请求无效或已过期。',
    });
    return;
  }

  try {
    const payload = await requestOAuthToken({
      grant_type: 'authorization_code',
      code,
      redirect_uri: FEISHU_REDIRECT_URI,
      code_verifier: pending.codeVerifier,
    });
    const sessionId = randomBase64Url(48);
    sessions.set(sessionId, {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      expiresAt: Date.now() + payload.expires_in * 1000,
    });
    sendOAuthResult(response, { type: 'feishu-oauth-success', sessionId });
  } catch (oauthError) {
    sendOAuthResult(response, {
      type: 'feishu-oauth-error',
      message: oauthError instanceof Error ? oauthError.message : '授权失败。',
    });
  }
});

app.get('/api/auth/status', async (request, response) => {
  const sessionId = getSessionId(request);
  try {
    await getAccessToken(sessionId);
    response.json({ authenticated: true });
  } catch {
    response.status(401).json({ authenticated: false });
  }
});

app.post('/api/base/batch-update', async (request, response) => {
  const sessionId = getSessionId(request);
  const { appToken, tableId, targetFieldName, records } = request.body || {};

  if (
    typeof appToken !== 'string'
    || typeof tableId !== 'string'
    || !tableId.startsWith('tbl')
    || typeof targetFieldName !== 'string'
    || !Array.isArray(records)
    || records.length < 1
    || records.length > 50
    || records.some((record) => (
      !record
      || typeof record.recordId !== 'string'
      || !Array.isArray(record.userIds)
      || record.userIds.length < 1
      || record.userIds.some((id) => typeof id !== 'string')
    ))
  ) {
    response.status(400).json({ code: 'INVALID_REQUEST', msg: '请求参数不合法。' });
    return;
  }

  try {
    const accessToken = await getAccessToken(sessionId);
    const apiResponse = await fetch(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${encodeURIComponent(appToken)}`
      + `/tables/${encodeURIComponent(tableId)}/records/batch_update?user_id_type=user_id`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          records: records.map((record) => ({
            record_id: record.recordId,
            fields: {
              [targetFieldName]: record.userIds.map((id) => ({ id })),
            },
          })),
        }),
      },
    );
    const responseText = await apiResponse.text();
    response.status(apiResponse.status).type('application/json').send(responseText);
  } catch (apiError) {
    const message = apiError instanceof Error ? apiError.message : 'UNKNOWN_ERROR';
    const status = message === 'AUTH_REQUIRED' || message === 'AUTH_EXPIRED' ? 401 : 500;
    response.status(status).json({ code: message, msg: message });
  }
});

app.post('/api/auth/logout', (request, response) => {
  sessions.delete(getSessionId(request));
  response.status(204).end();
});

app.use((error, _request, response, _next) => {
  console.error('Request failed', error);
  response.status(400).json({ code: 'INVALID_REQUEST', msg: '请求格式不正确。' });
});

app.listen(Number(PORT), () => {
  console.log(`OAuth server listening on http://localhost:${PORT}`);
});
