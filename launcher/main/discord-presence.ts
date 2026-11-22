import { createConnection, type Socket } from 'node:net';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import discord from '../../shared/discord-app.json';

type GameActivity = { version: string; loader: string; started?: number };
type Activity = {
  type: 0;
  details: string;
  state: string;
  timestamps: { start: number };
  instance: boolean;
};
const maxFrame = 64 * 1024;
const interval = 15000;
function frame(opcode: number, body: Buffer | unknown) {
  const payload = Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body));
  const header = Buffer.alloc(8);
  header.writeUInt32LE(opcode, 0);
  header.writeUInt32LE(payload.length, 4);
  return Buffer.concat([header, payload]);
}

/** Presence-only local IPC. Does not request Discord identity, tokens, chat, or guilds. */
export class DiscordPresence {
  private enabled = false;
  private socket?: Socket;
  private ready = false;
  private bytes: Buffer = Buffer.alloc(0);
  private retry?: ReturnType<typeof setTimeout>;
  private handshake?: ReturnType<typeof setTimeout>;
  private pending?: ReturnType<typeof setTimeout>;
  private desired?: Activity;
  private last = '';
  private sentAt = 0;
  private readonly started = Math.floor(Date.now() / 1000);

  update(enabled: boolean, game?: GameActivity) {
    if (!enabled) {
      this.stop();
      return;
    }
    this.enabled = true;
    this.desired = game
      ? {
          type: 0,
          details: 'Minecraft ' + game.version,
          state: game.loader.toUpperCase() + (game.started ? ' · 플레이 중' : ' · 게임 시작 중'),
          timestamps: { start: game.started || this.started },
          instance: false,
        }
      : {
          type: 0,
          details: 'Dkkf Launcher',
          state: '인스턴스 준비 중',
          timestamps: { start: this.started },
          instance: false,
        };
    if (!this.socket && !this.retry) this.connect();
    this.flush();
  }

  private connect(index = 0) {
    if (!this.enabled || this.socket) return;
    const prefix =
      process.env.XDG_RUNTIME_DIR ||
      process.env.TMPDIR ||
      process.env.TMP ||
      process.env.TEMP ||
      '/tmp';
    const pipe =
      process.platform === 'win32'
        ? '\\\\?\\pipe\\discord-ipc-' + index
        : path.join(prefix, 'discord-ipc-' + index);
    const socket = createConnection(pipe);
    this.socket = socket;
    this.ready = false;
    this.bytes = Buffer.alloc(0);
    this.last = '';
    this.sentAt = 0;
    let opened = false;
    const disconnected = () => {
      if (this.socket !== socket) return;
      this.socket = undefined;
      this.ready = false;
      this.bytes = Buffer.alloc(0);
      clearTimeout(this.handshake);
      clearTimeout(this.pending);
      this.pending = undefined;
      socket.destroy();
      if (!this.enabled) return;
      const next = !opened && index < 9 ? index + 1 : 0;
      this.retry = setTimeout(
        () => {
          this.retry = undefined;
          this.connect(next);
        },
        next ? 100 : 30000,
      );
      this.retry.unref();
    };
    socket.on('error', disconnected);
    socket.on('close', disconnected);
    this.handshake = setTimeout(() => socket.destroy(), 5000);
    this.handshake.unref();
    socket.once('connect', () => {
      opened = true;
      socket.write(frame(0, { v: 1, client_id: discord.clientId }));
    });
    socket.on('data', (chunk) => {
      if (this.socket !== socket) return;
      if (this.bytes.length + chunk.length > maxFrame * 4) {
        socket.destroy();
        return;
      }
      this.bytes = Buffer.concat([this.bytes, chunk]);
      try {
        while (this.bytes.length >= 8) {
          const opcode = this.bytes.readUInt32LE(0),
            size = this.bytes.readUInt32LE(4);
          if (size > maxFrame) throw Error('Oversized Discord IPC frame');
          if (this.bytes.length < size + 8) break;
          const payload = this.bytes.subarray(8, size + 8);
          this.bytes = this.bytes.subarray(size + 8);
          if (opcode === 3) socket.write(frame(4, payload));
          else if (opcode === 2) {
            socket.destroy();
            return;
          } else if (opcode === 1) {
            const data = JSON.parse(payload.toString('utf8'));
            if (data.evt === 'READY') {
              clearTimeout(this.handshake);
              this.ready = true;
              this.flush();
            } else if (data.evt === 'ERROR') {
              socket.destroy();
              return;
            }
          }
        }
      } catch {
        socket.destroy();
      }
    });
  }

  private flush() {
    if (!this.enabled || !this.ready || !this.socket?.writable || !this.desired) return;
    const signature = JSON.stringify(this.desired);
    if (signature === this.last) return;
    const remaining = interval - (Date.now() - this.sentAt);
    if (remaining > 0) {
      if (!this.pending) {
        this.pending = setTimeout(() => {
          this.pending = undefined;
          this.flush();
        }, remaining);
        this.pending.unref();
      }
      return;
    }
    this.last = signature;
    this.sentAt = Date.now();
    this.socket.write(
      frame(1, {
        cmd: 'SET_ACTIVITY',
        args: { pid: process.pid, activity: this.desired },
        nonce: randomUUID(),
      }),
    );
  }

  stop() {
    this.enabled = false;
    this.desired = undefined;
    clearTimeout(this.retry);
    clearTimeout(this.pending);
    clearTimeout(this.handshake);
    this.retry = undefined;
    this.pending = undefined;
    const socket = this.socket,
      wasReady = this.ready;
    this.socket = undefined;
    this.ready = false;
    this.last = '';
    this.bytes = Buffer.alloc(0);
    if (socket && !socket.destroyed) {
      if (wasReady && socket.writable)
        socket.end(
          frame(1, {
            cmd: 'SET_ACTIVITY',
            args: { pid: process.pid, activity: null },
            nonce: randomUUID(),
          }),
        );
      else socket.destroy();
      const timeout = setTimeout(() => socket.destroy(), 1000);
      timeout.unref();
    }
  }
}
