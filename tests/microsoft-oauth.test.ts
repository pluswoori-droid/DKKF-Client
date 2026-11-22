import { test } from 'node:test';
import assert from 'node:assert/strict';
import { microsoftOAuthError, postMicrosoftForm } from '../launcher/main/microsoft-oauth';

test('Microsoft AADSTS70002 points to the public-client setting without exposing response secrets', () => {
  const message = microsoftOAuthError(401, {
    error: 'invalid_client',
    error_codes: [70002],
    error_description: 'AADSTS70002: client must be mobile. access_token=DO_NOT_DISPLAY',
    access_token: 'LIVE_SECRET',
  });
  assert.match(message, /AADSTS70002/);
  assert.match(message, /公開|공개 클라이언트 흐름 허용/);
  assert(!message.includes('DO_NOT_DISPLAY'));
  assert(!message.includes('LIVE_SECRET'));
  const alternate = microsoftOAuthError(400, {
    error: 'invalid_client',
    error_description: 'AADSTS7000218: missing assertion',
  });
  assert.match(alternate, /AADSTS7000218/);
  assert.match(alternate, /클라이언트 시크릿을 넣지/);
});

test('Device-code request keeps its form/authority and surfaces actual Microsoft error codes', async () => {
  const body = new URLSearchParams({
    client_id: 'fixture-public-id',
    scope: 'XboxLive.signin offline_access',
  });
  let observed = false;
  const fetcher: typeof fetch = async (url, init) => {
    assert.equal(String(url), 'https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode');
    assert.equal(init?.method, 'POST');
    assert.equal(init?.redirect, 'error');
    assert.equal((init?.body as URLSearchParams).get('client_id'), 'fixture-public-id');
    assert.equal((init?.body as URLSearchParams).has('client_secret'), false);
    observed = true;
    return Response.json({ error: 'invalid_client', error_codes: [70002] }, { status: 401 });
  };
  await assert.rejects(() => postMicrosoftForm('devicecode', body, { fetcher }), /AADSTS70002/);
  assert(observed);
});

test('Polling permits only expected waiting errors; refresh and malformed responses fail', async () => {
  const body = new URLSearchParams({ client_id: 'fixture' });
  for (const error of ['authorization_pending', 'slow_down']) {
    const fetcher: typeof fetch = async () => Response.json({ error }, { status: 400 });
    assert.equal(
      (await postMicrosoftForm('token', body, { allowPending: true, fetcher })).error,
      error,
    );
    await assert.rejects(
      () => postMicrosoftForm('token', body, { fetcher }),
      /Microsoft 인증 실패/,
    );
  }
  await assert.rejects(
    () =>
      postMicrosoftForm('token', body, {
        allowPending: true,
        fetcher: async () => Response.json({ error: 'invalid_grant' }, { status: 400 }),
      }),
    /다시 로그인/,
  );
  await assert.rejects(
    () =>
      postMicrosoftForm('token', body, {
        fetcher: async () => new Response('<html>upstream error</html>', { status: 502 }),
      }),
    /응답 형식 오류/,
  );
});
