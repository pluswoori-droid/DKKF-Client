import type { Instance, Settings } from '../../shared/types';
export function memoryArguments(instance: Pick<Instance, 'ram' | 'limitRam'>) {
  return instance.limitRam === false ? [] : [`-Xmx${instance.ram}M`, '-Xms512M'];
}
export function removeForcedResolution(
  args: string[],
  settings: Pick<Settings, 'limitResolution'>,
) {
  if (settings.limitResolution) return args;
  const result: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--width' || args[i] === '--height') {
      i++;
      continue;
    }
    if (/^--(?:width|height)=/.test(args[i])) continue;
    result.push(args[i]);
  }
  return result;
}

/** A server launcher has one destination; discard conflicting pack-supplied selectors. */
export function directServerArguments(args: string[], server: string, logPath: string) {
  const selectors = new Set([
    '--server',
    '--port',
    '--quickPlayPath',
    '--quickPlaySingleplayer',
    '--quickPlayMultiplayer',
    '--quickPlayRealms',
  ]);
  const result: string[] = [];
  for (let n = 0; n < args.length; n++) {
    const flag = args[n].split('=', 1)[0];
    if (selectors.has(flag)) {
      if (!args[n].includes('=') && n + 1 < args.length && !args[n + 1].startsWith('--')) n++;
      continue;
    }
    result.push(args[n]);
  }
  return [...result, '--quickPlayMultiplayer', server, '--quickPlayPath', logPath];
}
