import { json } from './network';
import { z } from 'zod';
import target from '../../shared/target.json';

type Family = 'fabric' | 'quilt';
const gamesSchema = z.array(z.object({ version: z.string() }));
const loadersSchema = z.array(
  z.object({ loader: z.object({ version: z.string(), stable: z.boolean().optional() }) }),
);

/** Consult each loader's authoritative game list before requesting a version-specific endpoint. */
export class LoaderMetadata {
  private games = new Map<Family, { expires: number; versions: Set<string> }>();
  constructor(
    private read: typeof json = json,
    private now: () => number = Date.now,
  ) {}

  async list(loader: Family, gameVersion: string) {
    const base =
      loader === 'fabric' ? 'https://meta.fabricmc.net/v2' : 'https://meta.quiltmc.org/v3';
    let supported = this.games.get(loader);
    if (!supported || supported.expires <= this.now()) {
      const list = gamesSchema.parse(await this.read(base + '/versions/game'));
      supported = { versions: new Set(list.map((v) => v.version)), expires: this.now() + 300000 };
      this.games.set(loader, supported);
    }
    if (!supported.versions.has(gameVersion))
      throw Error(
        `${loader === 'fabric' ? 'Fabric' : 'Quilt'}는 Minecraft ${gameVersion}을 지원하지 않습니다(공식 지원 목록 기준). DKKF 기본 구성은 ${target.minecraft} Fabric입니다. 해당 게임 버전을 사용하려면 Vanilla 또는 지원되는 다른 로더를 선택하세요.`,
      );
    const list = loadersSchema.parse(
      await this.read(`${base}/versions/loader/${encodeURIComponent(gameVersion)}`),
    );
    return list.map((v) => ({
      version: v.loader.version,
      stable: v.loader.stable ?? !/(alpha|beta|snapshot|rc)/i.test(v.loader.version),
    }));
  }
}
