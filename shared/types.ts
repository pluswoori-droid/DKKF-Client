export type Loader = 'vanilla' | 'fabric' | 'quilt' | 'forge' | 'neoforge';
export interface Instance {
  id: string;
  name: string;
  version: string;
  loader: Loader;
  loaderVersion: string;
  ram: number;
  limitRam?: boolean;
  installationError?: string;
  created: string;
  lastPlayed?: string;
  profileId?: string;
  installed?: boolean;
  defaultContent?: boolean;
}
export interface Settings {
  javaPath: string;
  ram: number;
  limitRam: boolean;
  limitResolution: boolean;
  width: number;
  height: number;
  fullscreen: boolean;
  autoUpdate: boolean;
  discordRichPresence: boolean;
  serverBridge: boolean;
  channel: 'stable' | 'beta';
  microsoftClientId: string;
  updateUrl: string;
  updateKey: string;
  language: 'ko' | 'en' | 'mn';
}
export interface Account {
  id: string;
  name: string;
  expires: number;
  skinFace?: string;
}
export interface Mod {
  file: string;
  name: string;
  id: string;
  version: string;
  authors: string[];
  enabled: boolean;
  sha256: string;
  depends: string[];
  provides?: string[];
  source?: { provider: 'modrinth' | 'curseforge'; project: string; version: string };
  warnings: string[];
}
export interface Progress {
  task: string;
  message: string;
  current: number;
  total: number;
}
export type ContentKind = 'mod' | 'resourcepack' | 'shader' | 'world';
export interface ContentItem {
  kind: Exclude<ContentKind, 'mod'>;
  file: string;
  name: string;
  version?: string;
  size: number;
  enabled?: boolean;
  source?: Mod['source'];
  warnings: string[];
}
export interface PresetEntry {
  project: string;
  name: string;
  kind: Exclude<ContentKind, 'world'>;
  status: 'installed' | 'preserved' | 'disabled' | 'unsupported' | 'error';
  message: string;
}
export interface PresetReport {
  revision: number;
  completed: boolean;
  items: PresetEntry[];
}
export interface Snapshot {
  instances: Instance[];
  settings: Settings;
  accounts: Account[];
  selected?: string;
  running?: string;
  version: string;
  busy: boolean;
  update?: LauncherUpdateStatus;
}
export interface LauncherUpdateStatus {
  status:
    | 'idle'
    | 'checking'
    | 'unconfigured'
    | 'current'
    | 'available'
    | 'downloading'
    | 'ready'
    | 'installing'
    | 'error';
  version?: string;
  notes?: string;
  message?: string;
  canInstall?: boolean;
}
export interface Bridge {
  call<T = any>(method: string, args?: unknown): Promise<T>;
  onEvent(fn: (event: { type: string; data: any }) => void): () => void;
}
declare global {
  interface Window {
    dkkf: Bridge;
  }
}
