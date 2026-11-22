import { z } from 'zod';
export const id = z
  .string()
  .regex(/^[a-zA-Z0-9_.+-]{1,160}$/)
  .refine((v) => v !== '.' && v !== '..');
export const loader = z.enum(['vanilla', 'fabric', 'quilt', 'forge', 'neoforge']);
export const instanceInput = z.object({
  name: z.string().trim().min(1).max(70),
  version: id,
  loader,
  loaderVersion: z.string().max(160).default(''),
  ram: z.number().int().min(1024).max(65536),
  limitRam: z.boolean().default(false),
  defaultContent: z.boolean().default(true),
});
export const settingsInput = z.object({
  javaPath: z.string().min(1).max(1000),
  ram: z.number().int().min(1024).max(65536),
  width: z.number().int().min(640).max(7680),
  limitRam: z.boolean().default(false),
  limitResolution: z.boolean().default(false),
  height: z.number().int().min(480).max(4320),
  fullscreen: z.boolean(),
  autoUpdate: z.boolean(),
  discordRichPresence: z.boolean().default(true),
  serverBridge: z.boolean().default(false),
  channel: z.enum(['stable', 'beta']),
  microsoftClientId: z.string().max(100),
  updateUrl: z
    .string()
    .max(2000)
    .refine((v) => !v || v.startsWith('https://')),
  updateKey: z.string().max(3000),
  language: z.enum(['ko', 'en', 'mn']),
});
