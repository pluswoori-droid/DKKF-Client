import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { AccountIdentity } from '../launcher/renderer/AccountIdentity';
test('Home account identity is absent when disconnected and displays supplied verified-profile fields', () => {
  assert.equal(renderToStaticMarkup(<AccountIdentity />), '');
  // Synthetic presentation fixture only; no account is stored or authenticated by this test.
  const html = renderToStaticMarkup(
    <AccountIdentity
      account={{
        id: 'fixture',
        name: 'FixturePlayer',
        expires: 0,
        skinFace: 'data:image/png;base64,AA==',
      }}
    />,
  );
  assert.match(html, /FixturePlayer 스킨 얼굴/);
  assert.match(html, />FixturePlayer<\/span>/);
  assert.match(html, /class="skin-face"/);
  const fallback = renderToStaticMarkup(
    <AccountIdentity account={{ id: 'fixture', name: 'FixturePlayer', expires: 0 }} />,
  );
  assert.match(fallback, /스킨 얼굴을 불러올 수 없음/);
  assert(!fallback.includes('<img'));
});
