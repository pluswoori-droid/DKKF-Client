import { safeStorage } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { json } from './network';
import { postMicrosoftForm } from './microsoft-oauth';
import { z } from 'zod';
import { downloadSkinFace } from './skin';
import type { Store } from './store';
const scope = 'XboxLive.signin offline_access';
const deviceResponse = z.object({
  device_code: z.string().min(1),
  user_code: z.string().min(1),
  verification_uri: z.url().refine((v) => v.startsWith('https://')),
  interval: z.number().int().positive(),
  expires_in: z.number().int().positive(),
});
type Secret = { refresh: string; access: string; expires: number };
export class Auth {
  pending?: { device: string; interval: number; expires: number };
  constructor(private store: Store) {}
  private get client() {
    const id = this.store.settings.microsoftClientId;
    if (!/^[a-f\d-]{36}$/i.test(id))
      throw Error(
        'Settings에서 본인 Microsoft Entra 공개 클라이언트 앱 ID를 설정하세요. Xbox/Minecraft API 사용 승인도 필요합니다.',
      );
    return id;
  }
  private file(id: string) {
    if (!/^[a-f0-9]{32}$/i.test(id)) throw Error('프로필 ID 오류');
    return path.join(this.store.root, 'accounts', id + '.vault');
  }
  async begin() {
    this.pending = undefined;
    if (!safeStorage.isEncryptionAvailable())
      throw Error('Windows 보안 저장소를 사용할 수 없습니다.');
    const d = deviceResponse.parse(
      await postMicrosoftForm('devicecode', new URLSearchParams({ client_id: this.client, scope })),
    );
    this.pending = {
      device: d.device_code,
      interval: d.interval,
      expires: Date.now() + d.expires_in * 1000,
    };
    return {
      code: d.user_code,
      url: d.verification_uri,
      expires: d.expires_in,
      interval: d.interval,
    };
  }
  async poll() {
    const p = this.pending;
    if (!p || p.expires < Date.now()) {
      this.pending = undefined;
      throw Error('로그인 코드가 만료되었습니다.');
    }
    let d: Record<string, any>;
    try {
      d = await postMicrosoftForm(
        'token',
        new URLSearchParams({
          client_id: this.client,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          device_code: p.device,
        }),
        { allowPending: true },
      );
    } catch (error) {
      if (this.pending === p) this.pending = undefined;
      throw error;
    }
    if (this.pending !== p) throw Error('취소되었거나 교체된 로그인 요청입니다.');
    if (d.error === 'authorization_pending') return { pending: true, interval: p.interval };
    if (d.error === 'slow_down') {
      p.interval += 5;
      return { pending: true, interval: p.interval };
    }
    this.pending = undefined;
    const a = await this.exchange(d.access_token, d.refresh_token);
    return { pending: false, account: a };
  }
  private async exchange(msToken: string, refresh: string) {
    const post = (url: string, body: unknown) =>
      json(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    const xbox = await post('https://user.auth.xboxlive.com/user/authenticate', {
      Properties: {
        AuthMethod: 'RPS',
        SiteName: 'user.auth.xboxlive.com',
        RpsTicket: 'd=' + msToken,
      },
      RelyingParty: 'http://auth.xboxlive.com',
      TokenType: 'JWT',
    });
    const xsts = await post('https://xsts.auth.xboxlive.com/xsts/authorize', {
      Properties: { SandboxId: 'RETAIL', UserTokens: [xbox.Token] },
      RelyingParty: 'rp://api.minecraftservices.com/',
      TokenType: 'JWT',
    });
    const uhs = xsts.DisplayClaims?.xui?.[0]?.uhs;
    if (!uhs) throw Error('Xbox 사용자 인증 실패');
    const mc = await post('https://api.minecraftservices.com/authentication/login_with_xbox', {
      identityToken: `XBL3.0 x=${uhs};${xsts.Token}`,
    });
    const headers = { Authorization: 'Bearer ' + mc.access_token };
    const ent = await json('https://api.minecraftservices.com/entitlements/mcstore', { headers });
    if (
      !Array.isArray(ent.items) ||
      !ent.items.some((i: any) => ['game_minecraft', 'product_minecraft'].includes(i.name))
    )
      throw Error('Minecraft Java Edition 이용 권한을 확인할 수 없습니다.');
    const profile = await json('https://api.minecraftservices.com/minecraft/profile', { headers });
    if (!profile.id || !profile.name) throw Error('Minecraft 프로필이 없습니다.');
    const account = {
      id: profile.id,
      name: profile.name,
      expires: Date.now() + mc.expires_in * 1000,
      skinFace: await downloadSkinFace(profile),
    };
    await fs.mkdir(path.dirname(this.file(profile.id)), { recursive: true });
    const temp = this.file(profile.id) + '.tmp';
    await fs.writeFile(
      temp,
      safeStorage.encryptString(
        JSON.stringify({ refresh, access: mc.access_token, expires: account.expires }),
      ),
    );
    await fs.rename(temp, this.file(profile.id));
    this.store.set('accounts', [
      ...this.store.accounts.filter((a) => a.id !== account.id),
      account,
    ]);
    this.store.set('activeAccount', account.id);
    return account;
  }
  async credentials() {
    const id = this.store.get('activeAccount', '');
    const account = this.store.accounts.find((a) => a.id === id);
    if (!account) throw Error('Microsoft 계정으로 먼저 로그인하세요.');
    const secret: Secret = JSON.parse(safeStorage.decryptString(await fs.readFile(this.file(id))));
    if (secret.expires > Date.now() + 120000) return { ...account, token: secret.access };
    const d = await postMicrosoftForm(
      'token',
      new URLSearchParams({
        client_id: this.client,
        scope,
        grant_type: 'refresh_token',
        refresh_token: secret.refresh,
      }),
    );
    const a = await this.exchange(d.access_token, d.refresh_token || secret.refresh);
    return {
      ...a,
      token: JSON.parse(safeStorage.decryptString(await fs.readFile(this.file(a.id))))
        .access as string,
    };
  }
  async logout(id: string) {
    await fs.rm(this.file(id), { force: true });
    this.store.set(
      'accounts',
      this.store.accounts.filter((a) => a.id !== id),
    );
    if (this.store.get('activeAccount', '') === id)
      this.store.set('activeAccount', this.store.accounts[0]?.id || '');
  }
  async refreshAvatar() {
    const credentials = await this.credentials();
    const profile = await json('https://api.minecraftservices.com/minecraft/profile', {
      headers: { Authorization: 'Bearer ' + credentials.token },
    });
    if (profile.id !== credentials.id || typeof profile.name !== 'string')
      throw Error('Minecraft 프로필이 일치하지 않습니다.');
    const face = await downloadSkinFace(profile);
    const existing = this.store.accounts.find((a) => a.id === credentials.id);
    if (!existing || !face) return;
    const updated = { ...existing, name: profile.name, skinFace: face };
    this.store.set(
      'accounts',
      this.store.accounts.map((a) => (a.id === updated.id ? updated : a)),
    );
    return updated;
  }
  cancel() {
    this.pending = undefined;
  }
}
