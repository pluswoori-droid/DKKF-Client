import { translator } from '../../shared/localization';
import { app, BrowserWindow, ipcMain, dialog, shell, safeStorage } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { z } from 'zod';
import { WebSocket } from 'ws';
import { Store } from './store';
import { Auth } from './auth';
import { Minecraft } from './minecraft';
import { Mods } from './mods';
import { Packs } from './packs';
import { Updater } from './updater';
import { id, instanceInput, settingsInput } from '../../shared/schemas';
import { redact, httpsUrl, verifySigned, digest } from './security';
import type { Instance } from '../../shared/types';
import target from '../../shared/target.json';
import serverProfile from '../../shared/server-profile.json';
import { discoverJava } from './java';
import updateService from '../../shared/update-service.json';
import { Content } from './content';
import { DefaultContent } from './default-content';
import { DiscordPresence } from './discord-presence';
let discordPresence: DiscordPresence | undefined;
let gameStarted: number | undefined;
let win: BrowserWindow,
  store: Store,
  auth: Auth,
  mc: Minecraft,
  mods: Mods,
  packs: Packs,
  updater: Updater,
  content: Content,
  defaultContent: DefaultContent;
let controller: AbortController | undefined,
  running: string | undefined,
  closing = false,
  socket: WebSocket | undefined;
let eventStamp = 0;
let skipUpdateOnExit = false;
const emit = (type: string, data: any) => {
  if (type === 'progress' && Date.now() - eventStamp < 80 && data.current !== data.total) return;
  if (type === 'progress') eventStamp = Date.now();
  if (win && !win.isDestroyed()) win.webContents.send('dkkf:event', { type, data });
};
const state = () => ({
  instances: store.instances,
  settings: { ...store.settings, microsoftClientId: '' },
  accounts: store.accounts,
  selected: store.get('selected', ''),
  activeAccount: store.get('activeAccount', ''),
  running,
  version: app.getVersion(),
  busy: !!controller,
  update: updater?.status(),
  packs: store.get('packs', []),
});
const updatePresence = () => {
  const instance = running ? store.instances.find((i) => i.id === running) : undefined;
  discordPresence?.update(
    store.settings.discordRichPresence,
    instance
      ? { version: instance.version, loader: instance.loader, started: gameStarted }
      : undefined,
  );
};
const changed = () => {
  updatePresence();
  emit('state', state());
};
const idle = () => {
  if (running) throw Error('게임 실행 중에는 파일을 변경할 수 없습니다.');
  if (controller) throw Error('진행 중인 작업이 있습니다.');
};
async function task<T>(fn: (signal: AbortSignal) => Promise<T>) {
  idle();
  controller = new AbortController();
  changed();
  try {
    return await fn(controller.signal);
  } finally {
    controller.abort();
    controller = undefined;
    changed();
  }
}
const secretFile = (key: string) => path.join(store.root, 'secrets', key + '.vault');
async function getSecret(key: string) {
  try {
    return safeStorage.decryptString(await fs.readFile(secretFile(key)));
  } catch (e: any) {
    if (e.code === 'ENOENT') return '';
    throw e;
  }
}
async function setSecret(key: string, value: string) {
  if (!safeStorage.isEncryptionAvailable())
    throw Error('Windows 암호화 저장소를 사용할 수 없습니다.');
  await fs.mkdir(path.dirname(secretFile(key)), { recursive: true });
  if (!value) {
    await fs.rm(secretFile(key), { force: true });
    return;
  }
  const tmp = secretFile(key) + '.tmp';
  await fs.writeFile(tmp, safeStorage.encryptString(value));
  await fs.rename(tmp, secretFile(key));
}
function connectAnnouncements() {
  socket?.close();
  socket = undefined;
  const s = store.settings;
  if (!s.updateUrl || !s.updateKey) return;
  if (s.updateUrl.replace(/\/$/, '') === updateService.url) return;
  const url = new URL(s.updateUrl.replace(/\/$/, '') + '/announcements');
  url.protocol = 'wss:';
  socket = new WebSocket(url, { maxPayload: 12000 });
  socket.on('message', (raw) => {
    try {
      const d = JSON.parse(raw.toString());
      verifySigned(d.payload, d.signature, s.updateKey);
      const p = z
        .object({ message: z.string().max(2000), published: z.iso.datetime() })
        .parse(d.payload);
      if (Math.abs(Date.now() - Date.parse(p.published)) > 5 * 60000) throw Error('만료된 공지');
      emit('notice', p.message);
    } catch {
      emit('notice', '검증되지 않은 서버 공지를 차단했습니다.');
    }
  });
  socket.on('error', () => {});
}
async function chooseFile(extensions: string[], multiple = false) {
  const r = await dialog.showOpenDialog(win, {
    properties: multiple ? ['openFile', 'multiSelections'] : ['openFile'],
    filters: [{ name: 'Supported files', extensions }],
  });
  return r.canceled ? [] : r.filePaths;
}
async function initializeInstance(instance: Instance, signal: AbortSignal) {
  emit('progress', {
    task: 'install',
    message: '인스턴스 생성 및 게임 자동 설치',
    current: 0,
    total: 0,
  });
  try {
    await mc.install(instance, signal);
    emit('progress', {
      task: 'install',
      message: '기본 모드 및 필수 의존성 설치',
      current: 0,
      total: 0,
    });
    await defaultContent.ensure(instance.id, signal);
    const dependencyReport = await mods.ensureDependencies(instance.id, signal);
    if (dependencyReport.unresolved.length)
      emit(
        'notice',
        '필수 의존성 확인 필요: ' + dependencyReport.unresolved.slice(0, 3).join(' / '),
      );
    store.saveInstance({
      ...store.instance(instance.id),
      installed: true,
      installationError: undefined,
    });
  } catch (error) {
    const message = redact((error as Error).message);
    store.saveInstance({
      ...store.instance(instance.id),
      installed: false,
      installationError: message,
    });
    emit(
      'notice',
      '인스턴스를 생성했지만 초기 설치를 완료하지 못했습니다. 설치 재시도로 이어갈 수 있습니다. ' +
        message,
    );
  }
  return store.instance(instance.id);
}
const methods: Record<string, (a: any) => unknown> = {
  state: () => state(),
  versions: () => mc.manifest(),
  loaders: (a) => {
    const q = z.object({ loader: instanceInput.shape.loader, version: id }).parse(a);
    return mc.loaders(q.loader, q.version);
  },
  'instances.create': (a) =>
    task(async (signal) => {
      const v = instanceInput.parse(a);
      if (v.version !== serverProfile.minecraft || v.loader !== serverProfile.loader)
        throw Error('DKKF 서버용 인스턴스는 Minecraft 26.3 Fabric으로 생성하세요.');
      if (v.loader !== 'vanilla' && !v.loaderVersion) throw Error('로더 버전을 선택하세요.');
      if (v.loaderVersion) id.parse(v.loaderVersion);
      const all = await mc.manifest();
      if (!all.versions.some((x: any) => x.id === v.version))
        throw Error('공식 게임 버전이 아닙니다.');
      await mc.validateLoader(v);
      const item: Instance = { ...v, id: randomUUID(), created: new Date().toISOString() };
      await fs.mkdir(path.join(store.root, 'instances', item.id), { recursive: true });
      store.saveInstance(item);
      store.set('selected', item.id);
      changed();
      return initializeInstance(item, signal);
    }),
  'instances.select': (a) => {
    const i = store.instance(id.parse(a));
    store.set('selected', i.id);
    changed();
  },
  'instances.edit': (a) =>
    task(async () => {
      const q = z
        .object({
          id,
          name: z.string().trim().min(1).max(70),
          ram: z.number().int().min(1024).max(65536),
          limitRam: z.boolean().optional(),
          defaultContent: z.boolean().optional(),
        })
        .parse(a);
      store.saveInstance({ ...store.instance(q.id), name: q.name, ram: q.ram });
      store.saveInstance({
        ...store.instance(q.id),
        limitRam: q.limitRam ?? store.instance(q.id).limitRam,
        defaultContent: q.defaultContent ?? store.instance(q.id).defaultContent,
      });
      return store.instance(q.id);
    }),
  'instances.delete': (a) =>
    task(async () => {
      const key = id.parse(a);
      const i = store.instance(key);
      const r = await dialog.showMessageBox(
        win,
        localizedDialog({
          type: 'warning',
          message: `${i.name} 인스턴스와 저장된 월드를 삭제할까요?`,
          buttons: ['취소', '삭제'],
          defaultId: 0,
          cancelId: 0,
        }),
      );
      if (r.response !== 1) return;
      await fs.rm(store.dir(key), { recursive: true, force: true });
      store.set(
        'instances',
        store.instances.filter((i) => i.id !== key),
      );
      store.set(
        'packs',
        store.get<string[]>('packs', []).filter((x) => x !== key),
      );
      if (store.get('selected', '') === key) store.set('selected', store.instances[0]?.id || '');
    }),
  'instances.clone': (a) =>
    task(async () => {
      const i = store.instance(id.parse(a));
      const item = {
        ...i,
        id: randomUUID(),
        name: i.name + ' Copy',
        created: new Date().toISOString(),
        lastPlayed: undefined,
      };
      const dest = path.join(store.root, 'instances', item.id);
      try {
        await fs.cp(store.dir(i.id), dest, {
          recursive: true,
          filter: (src) => !['logs', 'backups', 'updates'].includes(path.basename(src)),
        });
        store.saveInstance(item);
        store.set('modSources:' + item.id, store.get('modSources:' + i.id, {}));
        store.set('contentSources:' + item.id, store.get('contentSources:' + i.id, {}));
        store.set('defaultContent:' + item.id, defaultContent.report(i.id));
        if (store.get<string[]>('packs', []).includes(i.id))
          store.set('packs', [...store.get<string[]>('packs', []), item.id]);
        return item;
      } catch (e) {
        await fs.rm(dest, { recursive: true, force: true });
        throw e;
      }
    }),
  'instances.folder': (a) => shell.openPath(store.dir(id.parse(a))),
  'game.install': (a) => task((signal) => initializeInstance(store.instance(id.parse(a)), signal)),
  'game.launch': async (a) => {
    idle();
    const i = store.instance(id.parse(a));
    if (!i.installed) throw Error('먼저 게임을 설치하세요.');
    if (i.version !== serverProfile.minecraft || i.loader !== serverProfile.loader)
      throw Error('DKKF 서버 자동 접속은 Minecraft 26.3 Fabric 인스턴스에서 지원합니다.');
    await task((signal) => defaultContent.ensure(i.id, signal));
    const dependencyReport = await task((signal) => mods.ensureDependencies(i.id, signal));
    if (dependencyReport.unresolved.length)
      throw Error(
        '필수 의존성을 준비하지 못했습니다. 설치된 모드에서 의존성 복구를 눌러 확인하세요. ' +
          dependencyReport.unresolved.slice(0, 3).join(' / '),
      );
    if (dependencyReport.warnings.length)
      emit('notice', '의존성 확인 안내: ' + dependencyReport.warnings.slice(0, 2).join(' / '));
    running = i.id;
    gameStarted = undefined;
    changed();
    try {
      const creds = await auth.credentials();
      const logDir = path.join(store.dir(i.id), 'logs');
      await fs.mkdir(logDir, { recursive: true });
      const logfile = path.join(logDir, 'launcher-' + Date.now() + '.log');
      const started = new Date().toISOString();
      let logQueue = Promise.resolve();
      await mc.launch(
        i,
        creds,
        (s) => {
          const clean = redact(s.replaceAll(creds.token, '[REDACTED]'));
          logQueue = logQueue.then(() => fs.appendFile(logfile, clean)).catch(() => {});
          emit('log', clean.slice(-8000));
        },
        (code) => {
          running = undefined;
          gameStarted = undefined;
          store.db.run('INSERT INTO history(instance,started,exit_code) VALUES (?,?,?)', [
            i.id,
            started,
            code,
          ]);
          store.flush();
          emit('notice', `게임 종료 (코드 ${code})`);
          changed();
        },
      );
      store.saveInstance({ ...i, lastPlayed: started });
      if (running === i.id) gameStarted = Math.floor(Date.now() / 1000);
      changed();
      return { started: true };
    } catch (e) {
      running = undefined;
      gameStarted = undefined;
      changed();
      throw e;
    }
  },
  history: () =>
    store.db
      .exec('SELECT instance,started,exit_code FROM history ORDER BY id DESC LIMIT 20')
      .map((r) => r.values)
      .flat(),
  'auth.begin': () => {
    if (running) throw Error('게임 종료 후 계정을 변경하세요.');
    return auth.begin();
  },
  'auth.poll': async () => {
    const r = await auth.poll();
    changed();
    return r;
  },
  'auth.cancel': () => auth.cancel(),
  'auth.avatar': async () => {
    const result = await auth.refreshAvatar();
    changed();
    return result;
  },
  'auth.select': (a) => {
    if (running) throw Error('게임 종료 후 변경하세요.');
    const key = id.parse(a);
    if (!store.accounts.some((x) => x.id === key)) throw Error('계정이 없습니다.');
    store.set('activeAccount', key);
    changed();
  },
  'auth.logout': async (a) => {
    if (running) throw Error('게임 종료 후 로그아웃하세요.');
    await auth.logout(id.parse(a));
    changed();
  },
  'mods.list': (a) => mods.list(id.parse(a)),
  'mods.import': (a) =>
    task(async (signal) => {
      const key = id.parse(a);
      const files = await chooseFile(['jar'], true);
      if (!files.length) return;
      const result = await dialog.showMessageBox(
        win,
        localizedDialog({
          type: 'warning',
          message:
            'JAR 모드는 게임과 동일한 권한으로 실행됩니다. 신뢰할 수 있는 제작자의 파일만 가져오세요.',
          buttons: ['취소', '가져오기'],
          defaultId: 0,
          cancelId: 0,
        }),
      );
      if (result.response === 1) {
        await mods.import(key, files);
        const report = await mods.ensureDependencies(key, signal, true);
        if (report.unresolved.length || report.warnings.length)
          emit('notice', [...report.unresolved, ...report.warnings].slice(0, 3).join(' / '));
        return mods.list(key);
      }
    }),
  'mods.toggle': (a) =>
    task(async () => {
      const q = z.object({ id, file: z.string().max(240) }).parse(a);
      await mods.toggle(q.id, q.file);
    }),
  'mods.remove': (a) =>
    task(async () => {
      const q = z.object({ id, file: z.string().max(240) }).parse(a);
      await mods.backup(q.id);
      await mods.remove(q.id, q.file);
    }),
  'mods.backup': (a) => task(() => mods.backup(id.parse(a))),
  'mods.backups': async (a) => {
    try {
      return await fs.readdir(path.join(store.dir(id.parse(a)), 'backups'));
    } catch {
      return [];
    }
  },
  'mods.restore': (a) =>
    task(() => {
      const q = z.object({ id, name: z.string() }).parse(a);
      return mods.restore(q.id, q.name);
    }),
  'mods.search': (a) => {
    const q = z
      .object({
        provider: z.enum(['modrinth', 'curseforge']),
        query: z.string().max(200),
        instance: id.optional(),
        sort: z.enum(['relevance', 'downloads', 'newest', 'updated']).default('relevance'),
        category: z.string().max(60).default(''),
        offset: z.number().int().min(0).max(100000).default(0),
      })
      .parse(a);
    return mods.searchPage(
      q.provider,
      q.query,
      q.instance ? store.instance(q.instance) : undefined,
      q.sort,
      q.category,
      q.offset,
    );
  },
  'mods.detail': (a) => {
    const q = z
      .object({ provider: z.enum(['modrinth', 'curseforge']), project: id, instance: id })
      .parse(a);
    return mods.detail(q.provider, q.project, store.instance(q.instance));
  },
  'mods.install': (a) =>
    task((signal) => {
      const q = z
        .object({ id, provider: z.enum(['modrinth', 'curseforge']), project: id, version: id })
        .parse(a);
      return mods.install(q.id, q.provider, q.project, q.version, signal);
    }),
  'mods.updates': (a) => mods.updates(id.parse(a)),
  'mods.dependencies': (a) => task((signal) => mods.ensureDependencies(id.parse(a), signal, true)),
  'preset.status': (a) => defaultContent.report(id.parse(a)),
  'preset.install': (a) => task((signal) => defaultContent.ensure(id.parse(a), signal, true)),
  'content.list': (a) => {
    const q = z.object({ id, kind: z.enum(['resourcepack', 'shader', 'world']) }).parse(a);
    return content.list(q.id, q.kind);
  },
  'content.search': (a) => {
    const q = z
      .object({
        instance: id,
        kind: z.enum(['resourcepack', 'shader']),
        query: z.string().max(200),
        sort: z.enum(['relevance', 'downloads', 'newest']).default('relevance'),
        offset: z.number().int().min(0).max(100000).default(0),
      })
      .parse(a);
    return content.searchPage(q.kind, q.query, store.instance(q.instance), q.sort, q.offset);
  },
  'content.detail': (a) => {
    const q = z
      .object({ instance: id, kind: z.enum(['resourcepack', 'shader']), project: id })
      .parse(a);
    return content.detail(q.kind, q.project, store.instance(q.instance));
  },
  'content.install': (a) =>
    task((signal) => {
      const q = z
        .object({ id, kind: z.enum(['resourcepack', 'shader']), project: id, version: id })
        .parse(a);
      return content.install(q.id, q.kind, q.project, q.version, signal);
    }),
  'content.import': (a) =>
    task(async () => {
      const q = z
        .object({
          id,
          kind: z.enum(['resourcepack', 'shader', 'world']),
          directory: z.boolean().default(false),
        })
        .parse(a);
      if (q.directory && q.kind !== 'world') throw Error('폴더 가져오기는 월드만 지원합니다.');
      const files = q.directory
        ? (await dialog.showOpenDialog(win, { properties: ['openDirectory'] })).filePaths
        : await chooseFile(['zip']);
      return files[0] ? content.import(q.id, q.kind, files[0]) : undefined;
    }),
  'content.activate': (a) =>
    task(async () => {
      const q = z
        .object({
          id,
          kind: z.enum(['resourcepack', 'shader']),
          file: z.string().min(1).max(240),
          enabled: z.boolean(),
        })
        .parse(a);
      if (
        q.kind === 'shader' &&
        q.enabled &&
        !(await mods.list(q.id)).some((m) => m.enabled && m.id === 'iris')
      )
        throw Error('쉐이더를 활성화하려면 호환 Iris 모드를 먼저 설치하세요.');
      return content.activate(q.id, q.kind, q.file, q.enabled);
    }),
  'content.remove': (a) =>
    task(async () => {
      const q = z
        .object({
          id,
          kind: z.enum(['resourcepack', 'shader', 'world']),
          file: z.string().min(1).max(240),
        })
        .parse(a);
      if (q.kind === 'world') {
        const answer = await dialog.showMessageBox(
          win,
          localizedDialog({
            type: 'question',
            message: q.file + ' 월드를 인스턴스에서 제거하고 보관함으로 옮길까요?',
            buttons: ['취소', '보관함으로 이동'],
            defaultId: 0,
            cancelId: 0,
          }),
        );
        if (answer.response !== 1) return;
      }
      return content.remove(q.id, q.kind, q.file);
    }),
  'content.folder': async (a) => {
    const q = z.object({ id, kind: z.enum(['resourcepack', 'shader', 'world']) }).parse(a);
    return shell.openPath(await content.folder(q.id, q.kind));
  },
  'packs.mark': (a) => {
    idle();
    const i = store.instance(id.parse(a));
    store.set('packs', Array.from(new Set([...store.get<string[]>('packs', []), i.id])));
    changed();
  },
  'packs.import': () =>
    task(async (signal) => {
      const files = await chooseFile(['mrpack', 'zip']);
      if (!files[0]) return;
      const instance = await packs.import(files[0], signal);
      store.set('selected', instance.id);
      changed();
      return initializeInstance(instance, signal);
    }),
  'packs.export': (a) =>
    task(async () => {
      const q = z.object({ id, format: z.enum(['mrpack', 'curseforge']) }).parse(a);
      const ext = q.format === 'mrpack' ? 'mrpack' : 'zip';
      const r = await dialog.showSaveDialog(win, {
        defaultPath: store.instance(q.id).name + '.' + ext,
        filters: [{ name: 'Modpack', extensions: [ext] }],
      });
      return !r.canceled && r.filePath ? packs.export(q.id, r.filePath, q.format) : undefined;
    }),
  'settings.save': (a) => {
    idle();
    store.set('settings', {
      ...settingsInput.parse(a),
      microsoftClientId: store.settings.microsoftClientId,
    });
    connectAnnouncements();
    changed();
  },
  'settings.language': (a) => {
    const language = settingsInput.shape.language.parse(a);
    store.set('settings', { ...store.settings, language });
    changed();
    return { language };
  },
  'settings.discordPresence': (a) => {
    const enabled = z.boolean().parse(a);
    store.set('settings', { ...store.settings, discordRichPresence: enabled });
    changed();
    return { enabled };
  },
  'settings.secret': async (a) => {
    const q = z.object({ key: z.literal('curseforge'), value: z.string().max(2000) }).parse(a);
    await setSecret(q.key, q.value);
    return { saved: true };
  },
  'settings.secrets': async () => ({
    curseforge: !!(await getSecret('curseforge')),
  }),
  'settings.java': async () => {
    const files = await chooseFile(['exe']);
    return files[0];
  },
  'settings.javaAuto': async () => {
    const found = await discoverJava(target.java);
    if (!found)
      throw Error(
        `Java ${target.java} 이상을 찾지 못했습니다. 설치 후 java.exe를 직접 선택하세요.`,
      );
    return found;
  },
  'settings.data': () => shell.openPath(store.root),
  'update.check': () => updater.check(),
  'update.status': () => updater.status(),
  'update.folder': async () => {
    const directory = updater.folder();
    await fs.mkdir(directory, { recursive: true });
    return shell.openPath(directory);
  },
  'update.download': () => task((signal) => updater.fetch(signal)),
  'update.install': () => {
    idle();
    return updater.install();
  },
  'task.cancel': () => controller?.abort(),
  external: (a) => {
    const u = httpsUrl(z.string().parse(a), [
      'modrinth.com',
      'curseforge.com',
      'microsoft.com',
      'microsoftonline.com',
    ]);
    return shell.openExternal(u.href);
  },
};
const userProfile =
  process.env.DKKF_ELECTRON_PROFILE || path.join(app.getPath('appData'), 'dkkf-client');
mkdirSync(userProfile, { recursive: true });
app.setPath('userData', userProfile);
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => {
    if (win) {
      win.show();
      win.focus();
    }
  });
  app
    .whenReady()
    .then(async () => {
      const wasm = app.isPackaged
        ? path.join(process.resourcesPath, 'sql-wasm.wasm')
        : path.join(app.getAppPath(), 'node_modules/sql.js/dist/sql-wasm.wasm');
      store = await new Store(
        process.env.DKKF_DATA_DIR || path.join(app.getPath('userData'), 'data'),
      ).init(wasm);
      discordPresence = new DiscordPresence();
      if (!store.get<{ javaPath?: string }>('settings', {}).javaPath) {
        const found = await discoverJava(target.java);
        if (found) store.set('settings', { ...store.settings, javaPath: found.path });
      }
      auth = new Auth(store);
      mc = new Minecraft(store, (p) => emit('progress', p));
      mods = new Mods(store, getSecret, (message, current, total) =>
        emit('progress', { task: 'dependencies', message, current, total }),
      );
      content = new Content(store, undefined, undefined, mods);
      defaultContent = new DefaultContent(
        store,
        mods,
        content,
        (message, current, total) =>
          emit('progress', { task: 'default-content', message, current, total }),
        app.isPackaged ? process.resourcesPath : path.join(app.getAppPath(), 'assets'),
      );
      packs = new Packs(store, mods);
      updater = new Updater(store, emit, {
        version: app.getVersion(),
        packaged: app.isPackaged,
        quit: () => app.quit(),
        executablePath: process.execPath,
        openInstaller: (file) => shell.openPath(file),
      });
      await updater.restore();
      const entry = path.join(__dirname, '../renderer/index.html');
      const dev = process.env.DKKF_DEV === '1' && !app.isPackaged;
      const trusted = dev ? 'http://127.0.0.1:5173/' : pathToFileURL(entry).href;
      win = new BrowserWindow({
        width: 1440,
        height: 940,
        minWidth: 1080,
        minHeight: 720,
        backgroundColor: '#080b13',
        title: 'Dkkf Launcher',
        icon: app.isPackaged
          ? path.join(process.resourcesPath, 'icon.png')
          : path.join(app.getAppPath(), 'assets/icon.png'),
        autoHideMenuBar: true,
        webPreferences: {
          preload: path.join(__dirname, 'preload.cjs'),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          webSecurity: true,
        },
      });
      win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      win.webContents.on('will-navigate', (e, url) => {
        if (url !== trusted) e.preventDefault();
      });
      win.webContents.session.setPermissionRequestHandler((_w, _p, cb) => cb(false));
      ipcMain.handle('dkkf:call', async (e, method: unknown, args: unknown) => {
        if (
          e.sender !== win.webContents ||
          e.senderFrame !== win.webContents.mainFrame ||
          e.senderFrame.url.split('#')[0] !== trusted
        )
          throw Error('신뢰되지 않은 IPC 발신자');
        if (typeof method !== 'string' || !Object.hasOwn(methods, method))
          throw Error('지원하지 않는 요청');
        try {
          return { ok: true, data: await methods[method](args) };
        } catch (error) {
          return {
            ok: false,
            error: redact(error instanceof Error ? error.message : String(error)),
          };
        }
      });
      if (dev) await win.loadURL(trusted);
      else await win.loadFile(entry);
      win.on('close', (e) => {
        if ((running || controller) && !closing) {
          e.preventDefault();
          void dialog.showMessageBox(
            win,
            localizedDialog({
              type: 'info',
              message: '진행 중인 작업을 취소하고 게임을 종료한 다음 런처를 닫으세요.',
              buttons: ['확인'],
            }),
          );
        } else if (!closing && !skipUpdateOnExit && store.settings.autoUpdate && updater.ready) {
          e.preventDefault();
          closing = true;
          void updater.install({ silent: false }).catch((error) => {
            emit('notice', '자동 업데이트 적용 실패: ' + (error as Error).message);
            skipUpdateOnExit = true;
            closing = false;
            win.show();
            win.focus();
          });
        }
      });
      connectAnnouncements();
      updatePresence();
      let checkingUpdate = false;
      const auto = async () => {
        if (
          !app.isPackaged ||
          checkingUpdate ||
          !store.settings.autoUpdate ||
          controller ||
          running
        )
          return;
        checkingUpdate = true;
        try {
          const r = await updater.check();
          if (
            r.status === 'available' &&
            !updater.ready &&
            store.settings.autoUpdate &&
            !controller &&
            !running
          ) {
            await task((signal) => updater.fetch(signal));
            emit(
              'notice',
              '런처 업데이트 준비 완료. 게임 종료 후 런처를 닫으면 설치 프로그램이 열립니다.',
            );
          }
        } catch (e) {
          emit('notice', '업데이트 확인 실패: ' + (e as Error).message);
        } finally {
          checkingUpdate = false;
        }
      };
      void auto();
      setInterval(() => void auto(), 300000).unref();
    })
    .catch((e) => {
      dialog.showErrorBox('DKKF 시작 실패', redact(String(e)));
      app.quit();
    });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => {
    closing = true;
    controller?.abort();
    socket?.close();
    discordPresence?.stop();
  });
}

function localizedDialog<T extends Electron.MessageBoxOptions>(options: T): T {
  const t = translator(store.settings.language);
  return {
    ...options,
    title: options.title ? t(options.title) : undefined,
    message: t(options.message),
    detail: options.detail ? t(options.detail) : undefined,
    buttons: options.buttons?.map((label) => t(label)),
  };
}
