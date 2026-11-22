import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { WebSocket } from 'ws';
import { verifySigned } from '../launcher/main/security';

test(
  'local update REST service rejects unauthorized posts and broadcasts signed WebSocket notices',
  { timeout: 30000 },
  async () => {
    const root = path.resolve('.data/tests/' + randomUUID());
    await fs.mkdir(root, { recursive: true });
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const keyFile = path.join(root, 'fixture-key.pem');
    await fs.writeFile(keyFile, privateKey.export({ type: 'pkcs8', format: 'pem' }));
    await fs.writeFile(path.join(root, 'stable.json'), '{"fixture":true}');
    const server = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'backend/server.ts'], {
      env: {
        ...process.env,
        PORT: '18787',
        HOST: '127.0.0.1',
        DKKF_UPDATE_DIR: root,
        DKKF_ADMIN_TOKEN: 'local-fixture-only',
        DKKF_SIGNING_KEY: keyFile,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let socket: WebSocket | undefined;
    try {
      await new Promise<void>((resolve, reject) => {
        server.stdout.on('data', (data) => {
          if (data.toString().includes('listening')) resolve();
        });
        server.once('exit', (code) => reject(Error('Test server exited ' + code)));
        server.once('error', reject);
      });
      assert.equal((await fetch('http://127.0.0.1:18787/health')).status, 200);
      assert.deepEqual(await (await fetch('http://127.0.0.1:18787/stable.json')).json(), {
        fixture: true,
      });
      assert.equal(
        (await fetch('http://127.0.0.1:18787/api/announcement', { method: 'POST', body: '{}' }))
          .status,
        401,
      );
      socket = new WebSocket('ws://127.0.0.1:18787/announcements');
      await new Promise<void>((resolve, reject) => {
        socket!.once('open', resolve);
        socket!.once('error', reject);
      });
      const received = new Promise<any>((resolve, reject) => {
        socket!.once('message', (d) => resolve(JSON.parse(d.toString())));
        socket!.once('error', reject);
      });
      const result = await fetch('http://127.0.0.1:18787/api/announcement', {
        method: 'POST',
        headers: { Authorization: 'Bearer local-fixture-only', 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Local integration test, not a real announcement' }),
      });
      assert.equal(result.status, 202);
      const message = await received;
      verifySigned(
        message.payload,
        message.signature,
        publicKey.export({ type: 'spki', format: 'pem' }).toString(),
      );
      assert.equal(message.payload.message, 'Local integration test, not a real announcement');
    } finally {
      socket?.terminate();
      server.kill();
      await new Promise<void>((resolve) => {
        if (server.exitCode !== null) resolve();
        else server.once('exit', () => resolve());
      });
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);
